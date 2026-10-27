import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Download, ShieldCheck, CircleHelp } from 'lucide-react';
import { useData } from '@/lib/store';
import { formatINR, formatDate, formatNumber } from '@/lib/format';
import { Card } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

type Issue = { severity: 'High' | 'Medium' | 'Info'; area: string; record: string; detail: string; action: string };

function downloadCSV(rows: Issue[]) {
  const headers = ['severity', 'area', 'record', 'detail', 'recommended_action'];
  const escape = (value: string) => {
    // Prevent CSV formula injection when a field is opened in spreadsheet software.
    const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [headers.join(','), ...rows.map((row) => [row.severity, row.area, row.record, row.detail, row.action].map(escape).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jainath-go-live-readiness-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function countDuplicates(values: string[]) {
  const counts = new Map<string, number>();
  values.map((v) => v.trim().toLowerCase()).filter(Boolean).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

export function GoLiveReadinessPage() {
  const data = useData();
  const audit = useMemo(() => {
    const issues: Issue[] = [];
    const add = (severity: Issue['severity'], area: string, record: string, detail: string, action: string) => issues.push({ severity, area, record, detail, action });

    for (const sku of countDuplicates(data.products.map((p) => p.sku))) add('High', 'Products', sku, 'Duplicate SKU found.', 'Keep one unique SKU per product and verify invoice line references before correcting.');
    for (const code of countDuplicates(data.customers.map((c) => c.customer_code))) add('High', 'Customers', code, 'Duplicate customer code found.', 'Resolve the duplicate code without merging financial history blindly.');
    for (const code of countDuplicates(data.suppliers.map((s) => s.supplier_code))) add('High', 'Suppliers', code, 'Duplicate supplier code found.', 'Resolve the duplicate code and preserve linked purchase/payment records.');
    for (const no of countDuplicates(data.salesInvoices.map((s) => s.invoice_no))) add('High', 'Sales invoices', no, 'Duplicate invoice number found.', 'Review invoice records and references before changing identifiers.');
    for (const no of countDuplicates(data.purchases.map((p) => p.invoice_no))) add('High', 'Purchase invoices', no, 'Duplicate purchase invoice number found.', 'Review supplier invoice references before changing identifiers.');

    for (const p of data.products) {
      if (Number(p.stock_qty) < 0) add('High', 'Stock', `${p.sku} — ${p.name}`, `Negative stock: ${formatNumber(Number(p.stock_qty))} ${p.unit}.`, 'Reconcile stock movements and invoices; do not simply overwrite quantity.');
      if (Number(p.purchase_cost) <= 0) add('High', 'Product costs', `${p.sku} — ${p.name}`, 'Purchase cost is zero or missing; margin reporting may be misleading.', 'Enter verified purchase cost after checking supplier invoices.');
      if (Number(p.selling_price) <= 0) add('Medium', 'Product prices', `${p.sku} — ${p.name}`, 'Selling price is zero or missing.', 'Confirm the selling price before using the product in a sale.');
      if (Number(p.stock_qty) <= Number(p.min_stock)) add('Info', 'Stock', `${p.sku} — ${p.name}`, `Stock ${formatNumber(Number(p.stock_qty))} is at or below minimum ${formatNumber(Number(p.min_stock))}.`, 'Review reorder suggestions and supplier lead time.');
    }

    const customerIds = new Set(data.customers.map((c) => c.id));
    const productIds = new Set(data.products.map((p) => p.id));
    const supplierIds = new Set(data.suppliers.map((s) => s.id));
    for (const inv of data.salesInvoices) {
      if (!customerIds.has(inv.customer_id)) add('High', 'Sales invoices', inv.invoice_no, 'Customer reference is missing from loaded customer master data.', 'Check the customer master and linked invoice before editing.');
      if (Number(inv.outstanding) > 0 && !inv.due_date) add('Medium', 'Receivables', inv.invoice_no, `Outstanding ${formatINR(Number(inv.outstanding))} but no due date is set.`, 'Set a verified due date to improve overdue follow-up.');
    }
    for (const purchase of data.purchases) {
      if (!supplierIds.has(purchase.supplier_id)) add('High', 'Purchase invoices', purchase.invoice_no, 'Supplier reference is missing from loaded supplier master data.', 'Check supplier master and purchase references.');
      if (Number(purchase.outstanding) > 0 && !purchase.due_date) add('Medium', 'Payables', purchase.invoice_no, `Outstanding ${formatINR(Number(purchase.outstanding))} but no due date is set.`, 'Set a verified supplier payment due date.');
    }
    for (const item of data.salesItems) {
      if (!productIds.has(item.product_id)) add('High', 'Sales line items', item.sku || item.description, 'Product reference is missing from loaded product master data.', 'Check product master and invoice line history.');
      if (Number(item.quantity) > 0 && Number(item.line_cogs) <= 0) add('High', 'Sales cost data', item.sku || item.description, 'Line cost of goods sold is zero or missing; gross profit can be overstated.', 'Verify historical unit cost and line COGS against the source invoice.');
    }
    const openDues = data.salesInvoices.filter((s) => Number(s.outstanding) > 0).length + data.purchases.filter((p) => Number(p.outstanding) > 0).length;
    if (openDues > 0) add('Info', 'Open balances', `${openDues} invoices`, 'Open customer receivables and/or supplier payables remain.', 'Reconcile the open balance lists against bank/cash records; open dues alone are not a data error.');
    return issues;
  }, [data]);

  const high = audit.filter((i) => i.severity === 'High').length;
  const medium = audit.filter((i) => i.severity === 'Medium').length;
  const info = audit.filter((i) => i.severity === 'Info').length;
  const highIssues = audit.filter((i) => i.severity === 'High');
  const mediumIssues = audit.filter((i) => i.severity === 'Medium');
  const infoIssues = audit.filter((i) => i.severity === 'Info');

  return (
    <PageContainer>
      <PageHeader title="Go-Live Readiness" subtitle="Read-only data checks before entering live business transactions" actions={<button onClick={() => downloadCSV(audit)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Download size={16} /> Export findings</button>} />
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <CircleHelp size={20} className="mt-0.5 shrink-0" />
        <div className="text-sm"><strong>Read-only audit.</strong> This page does not delete demo data, change prices, adjust stock, or modify invoices. Resolve findings deliberately and keep a backup before any cleanup.</div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Products checked" value={formatNumber(data.products.length)} detail="Product master" />
        <SummaryCard title="Invoices checked" value={formatNumber(data.salesInvoices.length + data.purchases.length)} detail={`${data.salesInvoices.length} sales · ${data.purchases.length} purchases`} />
        <SummaryCard title="High priority" value={formatNumber(high)} detail="Resolve before relying on reports" tone={high ? 'danger' : 'good'} />
        <SummaryCard title="Other findings" value={formatNumber(medium + info)} detail={`${medium} medium · ${info} informational`} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Readiness checklist">
          <div className="space-y-3 text-sm">
            <ChecklistRow done={high === 0} title="No high-priority data issues" detail={`${high} high-priority finding(s) detected`} />
            <ChecklistRow done={data.products.length > 0 && data.customers.length > 0 && data.suppliers.length > 0} title="Core master data exists" detail={`${data.products.length} products · ${data.customers.length} customers · ${data.suppliers.length} suppliers`} />
            <ChecklistRow done={data.salesInvoices.length > 0 && data.salesItems.length > 0} title="Sales records have invoice line data" detail={`${data.salesInvoices.length} invoices · ${data.salesItems.length} lines`} />
            <ChecklistRow done={data.purchases.length > 0 && data.purchaseItems.length > 0} title="Purchase records have line data" detail={`${data.purchases.length} purchases · ${data.purchaseItems.length} lines`} />
            <ChecklistRow done={medium === 0} title="No medium-priority findings" detail={`${medium} finding(s) need review`} />
          </div>
        </Card>
        <Card title="Before go-live">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-zinc-300">
            <li>Confirm the product, customer, supplier and employee master lists are real and current.</li>
            <li>Back up the database before removing sample records or correcting historical transactions.</li>
            <li>Reconcile opening stock to a physical count and review stock movement history.</li>
            <li>Verify historical invoice costs, outstanding balances and due dates against source documents.</li>
            <li>Test Admin and Viewer accounts, then confirm Supabase row-level security protects writes.</li>
          </ol>
        </Card>
      </div>
      <div className="space-y-6">
        <IssueSection title="High priority" issues={highIssues} empty="No high-priority findings detected by these checks." />
        <IssueSection title="Needs review" issues={mediumIssues} empty="No medium-priority findings detected." />
        <IssueSection title="Informational" issues={infoIssues} empty="No informational findings detected." />
      </div>
      <p className="mt-6 text-xs text-slate-500 dark:text-zinc-400">Checks use records currently loaded by the app and are not a substitute for database-wide constraints, accounting reconciliation, or a backup verification. Findings can include demo/sample records and require human review.</p>
    </PageContainer>
  );
}

function SummaryCard({ title, value, detail, tone = 'default' }: { title: string; value: string; detail: string; tone?: 'default' | 'danger' | 'good' }) {
  const color = tone === 'danger' ? 'text-rose-600 dark:text-rose-300' : tone === 'good' ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-900 dark:text-zinc-100';
  return <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><p className="text-sm text-slate-500 dark:text-zinc-400">{title}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p><p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{detail}</p></div>;
}

function ChecklistRow({ done, title, detail }: { done: boolean; title: string; detail: string }) {
  return <div className="flex items-start gap-3"><span className={done ? 'text-emerald-600' : 'text-amber-600'}>{done ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}</span><div><p className="font-medium text-slate-800 dark:text-zinc-100">{title}</p><p className="text-xs text-slate-500 dark:text-zinc-400">{detail}</p></div></div>;
}

function IssueSection({ title, issues, empty }: { title: string; issues: Issue[]; empty: string }) {
  return <Card title={`${title} (${issues.length})`}>
    {issues.length === 0 ? <p className="py-3 text-sm text-slate-500 dark:text-zinc-400">{empty}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-zinc-700 dark:text-zinc-400"><th className="py-3 pr-3">Area</th><th className="py-3 pr-3">Record</th><th className="py-3 pr-3">Finding</th><th className="py-3">Suggested action</th></tr></thead><tbody>{issues.map((issue, index) => <tr key={`${issue.area}-${issue.record}-${index}`} className="border-b border-slate-100 align-top last:border-0 dark:border-zinc-800"><td className="py-3 pr-3 whitespace-nowrap">{issue.area}</td><td className="py-3 pr-3 font-medium">{issue.record}</td><td className="py-3 pr-3">{issue.detail}</td><td className="py-3 text-slate-500 dark:text-zinc-400">{issue.action}</td></tr>)}</tbody></table></div>}
  </Card>;
}
