import { useEffect, useMemo, useState } from 'react';
import { IndianRupee, CalendarClock, BookOpen, Printer } from 'lucide-react';
import { useData } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatDate, formatINR } from '@/lib/format';
import { daysOverdue, ageingBucket } from '@/lib/calculations';
import type { SalesInvoice, Purchase } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, Label, LoadingState, Modal, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

type Tab = 'receivables' | 'payables';
type FollowUpFilter = 'all' | 'today' | 'overdue' | 'upcoming';

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
type FollowUp = {
  id: string;
  invoice_id: string;
  customer_id: string;
  follow_up_date: string;
  promised_payment_date: string | null;
  status: 'Open' | 'Contacted' | 'Promise to Pay' | 'No Response' | 'Completed';
  notes: string | null;
  created_at: string;
};
type FollowUpTarget = { id: string; invoiceNo: string; customerId: string; customerName: string; outstanding: number };

export function PaymentsPage() {
  const data = useData();
  const [tab, setTab] = useState<Tab>('receivables');
  const [payInvoice, setPayInvoice] = useState<{ id: string; invoiceNo: string; partyType: 'customer' | 'supplier'; partyId: string; outstanding: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [followUpTarget, setFollowUpTarget] = useState<FollowUpTarget | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRole(userId?: string) {
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData.user?.id;
      }

      if (!userId) {
        if (active) {
          setIsAdmin(false);
          setRoleLoading(false);
        }
        return;
      }

      const { data: roleData, error } = await supabase
        .from('app_user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (active) {
        setIsAdmin(!error && roleData?.role === 'admin');
        setRoleLoading(false);
      }
    }

    loadRole();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setRoleLoading(true);
      void loadRole(session?.user?.id);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadFollowUps() {
    setFollowUpLoading(true);
    const { data: rows, error } = await supabase
      .from('customer_payment_followups')
      .select('id, invoice_id, customer_id, follow_up_date, promised_payment_date, status, notes, created_at')
      .order('follow_up_date', { ascending: true });
    if (error) {
      setFollowUpError(error.message.includes('does not exist') || error.code === '42P01'
        ? 'Follow-up table is not installed yet. Run customer_payment_followups.sql in Supabase.'
        : error.message);
    } else {
      setFollowUps((rows ?? []) as FollowUp[]);
      setFollowUpError('');
    }
    setFollowUpLoading(false);
  }

  useEffect(() => { void loadFollowUps(); }, []);

  const todayKey = localDateKey();
  const openFollowUps = followUps.filter((f) => f.status !== 'Completed');
  const dueTodayCount = openFollowUps.filter((f) => f.follow_up_date === todayKey).length;
  const overdueFollowUpCount = openFollowUps.filter((f) => f.follow_up_date < todayKey).length;
  const upcomingFollowUpCount = openFollowUps.filter((f) => f.follow_up_date > todayKey).length;
  const visibleFollowUps = followUps.filter((f) => {
    if (followUpFilter === 'all') return true;
    if (f.status === 'Completed') return false;
    if (followUpFilter === 'today') return f.follow_up_date === todayKey;
    if (followUpFilter === 'overdue') return f.follow_up_date < todayKey;
    return f.follow_up_date > todayKey;
  });

  async function updateFollowUpStatus(id: string, status: FollowUp['status']) {
    if (!isAdmin) return;
    const { error } = await supabase.from('customer_payment_followups').update({ status }).eq('id', id);
    if (error) { setFollowUpError(error.message); return; }
    await loadFollowUps();
  }

  const customerMap = useMemo(() => new Map(data.customers.map((c) => [c.id, c])), [data.customers]);
  const supplierMap = useMemo(() => new Map(data.suppliers.map((s) => [s.id, s])), [data.suppliers]);

  const receivables = useMemo(() => {
    return data.salesInvoices
      .filter((s) => s.outstanding > 0)
      .map((s) => ({
        invoice: s,
        customer: customerMap.get(s.customer_id),
        days: daysOverdue(s.due_date),
        bucket: ageingBucket(daysOverdue(s.due_date)),
      }))
      .sort((a, b) => b.days - a.days);
  }, [data.salesInvoices, customerMap]);

  const payables = useMemo(() => {
    return data.purchases
      .filter((p) => p.outstanding > 0)
      .map((p) => ({
        purchase: p,
        supplier: supplierMap.get(p.supplier_id),
        days: daysOverdue(p.due_date),
        bucket: ageingBucket(daysOverdue(p.due_date)),
      }))
      .sort((a, b) => b.days - a.days);
  }, [data.purchases, supplierMap]);

  const totalReceivable = receivables.reduce((s, r) => s + r.invoice.outstanding, 0);
  const totalPayable = payables.reduce((s, p) => s + p.purchase.outstanding, 0);
  const overdueReceivable = receivables.filter((r) => r.days > 0).reduce((s, r) => s + r.invoice.outstanding, 0);
  const overduePayable = payables.filter((p) => p.days > 0).reduce((s, p) => s + p.purchase.outstanding, 0);

  // Ageing summary
  const ageingBuckets = ['Not due', '1-30 days', '31-60 days', '61-90 days', '90+ days'];
  const receivableAgeing = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const b of ageingBuckets) buckets[b] = 0;
    for (const r of receivables) buckets[r.bucket] = (buckets[r.bucket] ?? 0) + r.invoice.outstanding;
    return buckets;
  }, [receivables]);
  const payableAgeing = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const b of ageingBuckets) buckets[b] = 0;
    for (const p of payables) buckets[p.bucket] = (buckets[p.bucket] ?? 0) + p.purchase.outstanding;
    return buckets;
  }, [payables]);

  // Customer-level summary: roll up all currently outstanding invoices and the
  // most recent / next promised follow-up without changing accounting records.
  const customerDuesSummary = useMemo(() => {
    const grouped = new Map<string, {
      customerId: string;
      name: string;
      code: string;
      phone: string;
      invoiceCount: number;
      balance: number;
      overdue: number;
    }>();

    for (const row of receivables) {
      const id = row.invoice.customer_id;
      const customer = customerMap.get(id);
      const current = grouped.get(id) ?? {
        customerId: id,
        name: customer?.name ?? 'Unknown customer',
        code: customer?.customer_code ?? '',
        phone: customer?.phone ?? '',
        invoiceCount: 0,
        balance: 0,
        overdue: 0,
      };
      current.invoiceCount += 1;
      current.balance += Number(row.invoice.outstanding) || 0;
      if (row.days > 0) current.overdue += Number(row.invoice.outstanding) || 0;
      grouped.set(id, current);
    }

    return Array.from(grouped.values()).map((customer) => {
      const customerFollowUps = followUps
        .filter((f) => f.customer_id === customer.customerId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const openPromises = customerFollowUps
        .filter((f) => f.status !== 'Completed' && f.promised_payment_date)
        .sort((a, b) => (a.promised_payment_date ?? '').localeCompare(b.promised_payment_date ?? ''));
      return {
        ...customer,
        lastFollowUp: customerFollowUps[0] ?? null,
        nextPromisedPayment: openPromises[0] ?? null,
      };
    }).sort((a, b) => b.balance - a.balance);
  }, [receivables, customerMap, followUps]);

  const visibleCustomerDues = customerDuesSummary.filter((customer) => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return true;
    return customer.name.toLowerCase().includes(query)
      || customer.code.toLowerCase().includes(query)
      || customer.phone.toLowerCase().includes(query);
  });

  const ledgerCustomer = ledgerCustomerId ? customerMap.get(ledgerCustomerId) : undefined;
  const ledgerInvoices = useMemo(() => ledgerCustomerId
    ? data.salesInvoices.filter((invoice) => invoice.customer_id === ledgerCustomerId)
        .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date))
    : [], [data.salesInvoices, ledgerCustomerId]);
  const ledgerPayments = useMemo(() => ledgerCustomerId
    ? data.payments.filter((payment) => payment.party_type === 'customer' && payment.party_id === ledgerCustomerId)
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
    : [], [data.payments, ledgerCustomerId]);
  const ledgerBilled = ledgerInvoices.reduce((sum, invoice) => sum + (Number(invoice.total_amount) || 0), 0);
  const ledgerPaid = ledgerInvoices.reduce((sum, invoice) => sum + (Number(invoice.amount_paid) || 0), 0);
  const ledgerOutstanding = ledgerInvoices.reduce((sum, invoice) => sum + (Number(invoice.outstanding) || 0), 0);

  function printCustomerStatement() {
    if (!ledgerCustomer) return;
    const printWindow = window.open('', '_blank', 'width=1000,height=750');
    if (!printWindow) {
      window.alert('The statement window was blocked. Please allow pop-ups for this dashboard and try again.');
      return;
    }
    const escapeHtml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
    const invoiceRows = ledgerInvoices.map((invoice) => `
      <tr><td>${escapeHtml(invoice.invoice_no)}</td><td>${escapeHtml(formatDate(invoice.invoice_date))}</td>
      <td>${escapeHtml(formatDate(invoice.due_date))}</td><td class="num">${escapeHtml(formatINR(invoice.total_amount))}</td>
      <td class="num">${escapeHtml(formatINR(invoice.amount_paid))}</td><td class="num">${escapeHtml(formatINR(invoice.outstanding))}</td></tr>`).join('');
    const paymentRows = ledgerPayments.map((payment) => {
      const invoice = data.salesInvoices.find((item) => item.id === payment.invoice_id);
      return `<tr><td>${escapeHtml(formatDate(payment.payment_date))}</td><td>${escapeHtml(invoice?.invoice_no ?? '—')}</td>
      <td>${escapeHtml(payment.payment_method || '—')}</td><td>${escapeHtml(payment.reference_no || '—')}</td>
      <td class="num">${escapeHtml(formatINR(payment.amount))}</td></tr>`;
    }).join('');
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Customer Statement - ${escapeHtml(ledgerCustomer.name)}</title>
      <style>body{font-family:Arial,sans-serif;color:#111;margin:32px}h1{margin-bottom:4px}h2{margin-top:28px;font-size:16px}.muted{color:#555}.summary{display:flex;gap:24px;margin:22px 0}.summary div{border:1px solid #ddd;padding:12px;flex:1}.summary strong{display:block;font-size:18px;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px 7px;border-bottom:1px solid #ddd;text-align:left}th{background:#f3f4f6}.num{text-align:right;white-space:nowrap}.footer{margin-top:30px;color:#666;font-size:11px}@media print{body{margin:15mm}button{display:none}}</style></head><body>
      <h1>Jainath Sales</h1><div class="muted">Customer Account Statement</div><hr>
      <h2>${escapeHtml(ledgerCustomer.name)}</h2><div>Customer code: ${escapeHtml(ledgerCustomer.customer_code || '—')} &nbsp; Phone: ${escapeHtml(ledgerCustomer.phone || '—')}</div>
      <div class="summary"><div>Total invoiced<strong>${escapeHtml(formatINR(ledgerBilled))}</strong></div><div>Total paid<strong>${escapeHtml(formatINR(ledgerPaid))}</strong></div><div>Outstanding<strong>${escapeHtml(formatINR(ledgerOutstanding))}</strong></div></div>
      <h2>Invoice history</h2><table><thead><tr><th>Invoice</th><th>Date</th><th>Due date</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>${invoiceRows || '<tr><td colspan="6">No invoices found.</td></tr>'}</tbody></table>
      <h2>Payment history</h2><table><thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead><tbody>${paymentRows || '<tr><td colspan="5">No payment records found.</td></tr>'}</tbody></table>
      <div class="footer">Generated ${escapeHtml(new Date().toLocaleString('en-IN'))}. Please contact Jainath Sales if you have questions about this statement.</div>
      <script>window.onload=function(){window.focus();window.print();};<\/script></body></html>`);
    printWindow.document.close();
  }

  return (
    <PageContainer>
      <PageHeader title="Payments & Outstanding Dues" subtitle="Customer receivables and supplier payables" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">Total Receivable</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(totalReceivable, { compact: true })}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">Overdue Receivable</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{formatINR(overdueReceivable, { compact: true })}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">Total Payable</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(totalPayable, { compact: true })}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">Overdue Payable</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{formatINR(overduePayable, { compact: true })}</p>
        </Card>
      </div>

      {/* Ageing Summary */}
      <Card title="Ageing Summary" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 font-medium">Bucket</th>
                <th className="py-3 text-right font-medium">Receivable</th>
                <th className="py-3 text-right font-medium">Payable</th>
              </tr>
            </thead>
            <tbody>
              {ageingBuckets.map((b) => (
                <tr key={b} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-2">
                    <Badge tone={b === 'Not due' ? 'positive' : b === '90+ days' ? 'negative' : 'warning'}>{b}</Badge>
                  </td>
                  <td className="py-3 text-right text-slate-700 dark:text-slate-200">{formatINR(receivableAgeing[b] ?? 0)}</td>
                  <td className="py-3 text-right text-slate-700 dark:text-slate-200">{formatINR(payableAgeing[b] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Customer-level Dues Summary" className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">All unpaid invoices grouped by customer, with the latest follow-up and next promised payment date.</p>
          <div className="w-full sm:max-w-xs">
            <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search customer, code or phone..." />
          </div>
        </div>
        {visibleCustomerDues.length === 0 ? (
          <EmptyState message={customerSearch ? 'No customers match your search.' : 'No customers have outstanding balances.'} icon={<IndianRupee size={28} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 font-medium">Customer</th>
                  <th className="py-3 text-center font-medium">Open invoices</th>
                  <th className="py-3 text-right font-medium">Total outstanding</th>
                  <th className="py-3 text-right font-medium">Overdue amount</th>
                  <th className="py-3 font-medium">Last follow-up</th>
                  <th className="py-3 font-medium">Next promised payment</th>
                  <th className="py-3 font-medium">Follow-up status</th>
                  <th className="py-3 font-medium text-right">Ledger</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomerDues.map((customer) => {
                  const promiseDate = customer.nextPromisedPayment?.promised_payment_date ?? null;
                  const promiseIsLate = Boolean(promiseDate && promiseDate < todayKey);
                  return (
                    <tr key={customer.customerId} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{customer.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{[customer.code, customer.phone].filter(Boolean).join(' · ') || 'No code/phone'}</div>
                      </td>
                      <td className="py-3 text-center">{customer.invoiceCount}</td>
                      <td className="py-3 text-right font-semibold text-rose-600">{formatINR(customer.balance)}</td>
                      <td className="py-3 text-right text-amber-600">{formatINR(customer.overdue)}</td>
                      <td className="py-3">
                        {customer.lastFollowUp ? <><div>{formatDate(customer.lastFollowUp.follow_up_date)}</div><div className="text-xs text-slate-500 dark:text-slate-400">{customer.lastFollowUp.status}</div></> : <span className="text-slate-500 dark:text-slate-400">No follow-up</span>}
                      </td>
                      <td className={`py-3 ${promiseIsLate ? 'font-semibold text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                        {promiseDate ? formatDate(promiseDate) : 'Not promised'}
                        {promiseIsLate && <div className="text-xs">Promise overdue</div>}
                      </td>
                      <td className="py-3">
                        {customer.nextPromisedPayment ? <Badge tone={promiseIsLate ? 'negative' : customer.nextPromisedPayment.status === 'Promise to Pay' ? 'warning' : 'info'}>{customer.nextPromisedPayment.status}</Badge> : <span className="text-slate-500 dark:text-slate-400">—</span>}
                      </td>
                      <td className="py-3 text-right"><Button size="sm" variant="secondary" onClick={() => setLedgerCustomerId(customer.customerId)}><BookOpen size={14} /> View ledger</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <button onClick={() => setTab('receivables')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'receivables' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 dark:text-slate-300'}`}>
          Customer Receivables ({receivables.length})
        </button>
        <button onClick={() => setTab('payables')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'payables' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 dark:text-slate-300'}`}>
          Supplier Payables ({payables.length})
        </button>
      </div>

      <Card title="Customer Payment Follow-ups" className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Track calls, promised payment dates and next actions for overdue customer invoices.</p>
          <Badge tone="info">{openFollowUps.length} open</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <button type="button" onClick={() => setFollowUpFilter('today')} className={`rounded-xl border p-3 text-left transition-colors ${followUpFilter === 'today' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
            <span className="block text-sm text-slate-600 dark:text-slate-300">Due today</span><span className="text-2xl font-semibold text-blue-700 dark:text-blue-300">{dueTodayCount}</span>
          </button>
          <button type="button" onClick={() => setFollowUpFilter('overdue')} className={`rounded-xl border p-3 text-left transition-colors ${followUpFilter === 'overdue' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
            <span className="block text-sm text-slate-600 dark:text-slate-300">Overdue follow-ups</span><span className="text-2xl font-semibold text-rose-700 dark:text-rose-300">{overdueFollowUpCount}</span>
          </button>
          <button type="button" onClick={() => setFollowUpFilter('upcoming')} className={`rounded-xl border p-3 text-left transition-colors ${followUpFilter === 'upcoming' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
            <span className="block text-sm text-slate-600 dark:text-slate-300">Upcoming</span><span className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{upcomingFollowUpCount}</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-slate-600 dark:text-slate-300">Show:</span>
          {(['all', 'today', 'overdue', 'upcoming'] as FollowUpFilter[]).map((filter) => (
            <Button key={filter} size="sm" variant={followUpFilter === filter ? 'primary' : 'secondary'} onClick={() => setFollowUpFilter(filter)}>
              {filter === 'all' ? 'All follow-ups' : filter === 'today' ? 'Due today' : filter === 'overdue' ? 'Overdue' : 'Upcoming'}
            </Button>
          ))}
        </div>
        {followUpError && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-3 text-sm text-rose-700 dark:text-rose-300">{followUpError}</div>}
        {followUpLoading ? <LoadingState /> : followUps.length === 0 ? (
          <EmptyState message="No payment follow-ups yet. Add one from a customer receivable below." icon={<CalendarClock size={28} />} />
        ) : visibleFollowUps.length === 0 ? (
          <EmptyState message={followUpFilter === 'today' ? 'No follow-ups are due today.' : followUpFilter === 'overdue' ? 'No overdue follow-ups.' : followUpFilter === 'upcoming' ? 'No upcoming follow-ups.' : 'No follow-ups match this filter.'} icon={<CalendarClock size={28} />} />
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700"><th className="py-2">Follow-up date</th><th>Customer</th><th>Invoice</th><th className="text-right">Balance</th><th>Promised date</th><th>Status</th><th>Notes</th>{isAdmin && <th>Update</th>}</tr></thead>
            <tbody>{visibleFollowUps.map(f => {
              const inv = data.salesInvoices.find(s => s.id === f.invoice_id);
              const customer = customerMap.get(f.customer_id);
              return <tr key={f.id} className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${f.status !== 'Completed' && f.follow_up_date < todayKey ? 'bg-rose-50/70 dark:bg-rose-950/20' : f.status !== 'Completed' && f.follow_up_date === todayKey ? 'bg-blue-50/70 dark:bg-blue-950/20' : ''}`}>
                <td className="py-3">{formatDate(f.follow_up_date)}</td><td>{customer?.name ?? 'Former/unavailable customer'}</td><td>{inv?.invoice_no ?? '-'}</td><td className="text-right text-rose-600">{formatINR(inv?.outstanding ?? 0)}</td><td>{formatDate(f.promised_payment_date)}</td><td><Badge tone={f.status === 'Completed' ? 'positive' : f.status === 'Promise to Pay' ? 'warning' : 'info'}>{f.status}</Badge></td><td className="max-w-xs whitespace-pre-wrap">{f.notes || '-'}</td>
                {isAdmin && <td><Select value={f.status} onChange={e => void updateFollowUpStatus(f.id, e.target.value as FollowUp['status'])}><option>Open</option><option>Contacted</option><option>Promise to Pay</option><option>No Response</option><option>Completed</option></Select></td>}
              </tr>;
            })}</tbody>
          </table></div>
        )}
      </Card>

      {data.loading || roleLoading ? <LoadingState /> : tab === 'receivables' ? (
        <ReceivablesTable canManage={isAdmin} rows={receivables} onFollowUp={(r) => setFollowUpTarget({ id: r.invoice.id, invoiceNo: r.invoice.invoice_no, customerId: r.invoice.customer_id, customerName: r.customer?.name ?? 'Customer', outstanding: r.invoice.outstanding })} onPay={(r) => setPayInvoice({
          id: r.invoice.id, invoiceNo: r.invoice.invoice_no, partyType: 'customer',
          partyId: r.invoice.customer_id, outstanding: r.invoice.outstanding,
        })} />
      ) : (
        <PayablesTable canManage={isAdmin} rows={payables} onPay={(p) => setPayInvoice({
          id: p.purchase.id, invoiceNo: p.purchase.invoice_no, partyType: 'supplier',
          partyId: p.purchase.supplier_id, outstanding: p.purchase.outstanding,
        })} />
      )}

      {isAdmin && payInvoice && (
        <PaymentForm invoice={payInvoice} onClose={() => setPayInvoice(null)} onSaved={() => data.refresh()} />
      )}
      {isAdmin && followUpTarget && (
        <FollowUpForm target={followUpTarget} onClose={() => setFollowUpTarget(null)} onSaved={async () => { setFollowUpTarget(null); await loadFollowUps(); }} />
      )}
      {ledgerCustomerId && (
        <Modal open={true} onClose={() => setLedgerCustomerId(null)} title={`Customer Ledger — ${ledgerCustomer?.name ?? 'Customer'}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><div className="text-xs text-slate-500 dark:text-slate-400">Total invoiced</div><div className="text-lg font-semibold">{formatINR(ledgerBilled)}</div></div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><div className="text-xs text-slate-500 dark:text-slate-400">Total paid</div><div className="text-lg font-semibold text-emerald-600">{formatINR(ledgerPaid)}</div></div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"><div className="text-xs text-slate-500 dark:text-slate-400">Outstanding</div><div className="text-lg font-semibold text-rose-600">{formatINR(ledgerOutstanding)}</div></div>
            </div>
            <div><h3 className="font-semibold mb-2">Invoices</h3>{ledgerInvoices.length === 0 ? <p className="text-sm text-slate-500">No invoices found for this customer.</p> : <div className="overflow-x-auto max-h-64"><table className="w-full text-sm"><thead className="sticky top-0 bg-white dark:bg-slate-900"><tr className="text-left border-b border-slate-200 dark:border-slate-700"><th className="py-2">Invoice</th><th>Date</th><th>Due date</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th></tr></thead><tbody>{ledgerInvoices.map(invoice => <tr key={invoice.id} className="border-b border-slate-100 dark:border-slate-800"><td className="py-2 font-medium">{invoice.invoice_no}</td><td>{formatDate(invoice.invoice_date)}</td><td>{formatDate(invoice.due_date)}</td><td className="text-right">{formatINR(invoice.total_amount)}</td><td className="text-right text-emerald-600">{formatINR(invoice.amount_paid)}</td><td className="text-right text-rose-600">{formatINR(invoice.outstanding)}</td></tr>)}</tbody></table></div>}</div>
            <div><h3 className="font-semibold mb-2">Payment history</h3>{ledgerPayments.length === 0 ? <p className="text-sm text-slate-500">No payment records found.</p> : <div className="overflow-x-auto max-h-52"><table className="w-full text-sm"><thead className="sticky top-0 bg-white dark:bg-slate-900"><tr className="text-left border-b border-slate-200 dark:border-slate-700"><th className="py-2">Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead><tbody>{ledgerPayments.map(payment => { const invoice = data.salesInvoices.find(item => item.id === payment.invoice_id); return <tr key={payment.id} className="border-b border-slate-100 dark:border-slate-800"><td className="py-2">{formatDate(payment.payment_date)}</td><td>{invoice?.invoice_no ?? '—'}</td><td>{payment.payment_method || '—'}</td><td>{payment.reference_no || '—'}</td><td className="text-right text-emerald-600">{formatINR(payment.amount)}</td></tr>; })}</tbody></table></div>}</div>
            <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={printCustomerStatement}><Printer size={14} /> Print statement</Button><Button variant="secondary" onClick={() => setLedgerCustomerId(null)}>Close ledger</Button></div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}

function ReceivablesTable({ rows, onPay, onFollowUp, canManage }: {
  canManage: boolean;
  rows: { invoice: SalesInvoice; customer?: { name: string; customer_code: string }; days: number; bucket: string }[];
  onPay: (r: { invoice: SalesInvoice; customer?: { name: string; customer_code: string }; days: number; bucket: string }) => void;
  onFollowUp: (r: { invoice: SalesInvoice; customer?: { name: string; customer_code: string }; days: number; bucket: string }) => void;
}) {
  if (rows.length === 0) return <EmptyState message="No outstanding customer payments" icon={<IndianRupee size={32} />} />;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <th className="py-3 font-medium">Invoice</th>
              <th className="py-3 font-medium">Customer</th>
              <th className="py-3 font-medium">Invoice Date</th>
              <th className="py-3 font-medium">Due Date</th>
              <th className="py-3 text-right font-medium">Total</th>
              <th className="py-3 text-right font-medium">Paid</th>
              <th className="py-3 text-right font-medium">Balance</th>
              <th className="py-3 text-center font-medium">Days Overdue</th>
              <th className="py-3 text-center font-medium">Bucket</th>
              {canManage && <th className="py-3 text-center font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoice.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-800">
                <td className="py-3 font-medium text-brand-700">{r.invoice.invoice_no}</td>
                <td className="py-3 text-slate-700 dark:text-slate-200">{r.customer?.name ?? '-'}</td>
                <td className="py-3 text-slate-600 dark:text-slate-300">{formatDate(r.invoice.invoice_date)}</td>
                <td className="py-3 text-slate-600 dark:text-slate-300">{formatDate(r.invoice.due_date)}</td>
                <td className="py-3 text-right text-slate-700 dark:text-slate-200">{formatINR(r.invoice.total_amount)}</td>
                <td className="py-3 text-right text-emerald-600">{formatINR(r.invoice.amount_paid)}</td>
                <td className="py-3 text-right text-rose-600 font-medium">{formatINR(r.invoice.outstanding)}</td>
                <td className="py-3 text-center text-rose-600">{r.days > 0 ? r.days : '-'}</td>
                <td className="py-3 text-center">
                  <Badge tone={r.bucket === 'Not due' ? 'positive' : r.bucket === '90+ days' ? 'negative' : 'warning'}>{r.bucket}</Badge>
                </td>
                {canManage && (
                  <td className="py-3 text-center">
                    <div className="flex flex-wrap justify-center gap-2"><Button size="sm" onClick={() => onPay(r)}>Record Payment</Button><Button size="sm" variant="secondary" onClick={() => onFollowUp(r)}><CalendarClock size={14} /> Follow-up</Button></div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PayablesTable({ rows, onPay, canManage }: {
  canManage: boolean;
  rows: { purchase: Purchase; supplier?: { name: string; supplier_code: string }; days: number; bucket: string }[];
  onPay: (p: { purchase: Purchase; supplier?: { name: string; supplier_code: string }; days: number; bucket: string }) => void;
}) {
  if (rows.length === 0) return <EmptyState message="No outstanding supplier payments" icon={<IndianRupee size={32} />} />;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <th className="py-3 font-medium">Invoice</th>
              <th className="py-3 font-medium">Supplier</th>
              <th className="py-3 font-medium">Invoice Date</th>
              <th className="py-3 font-medium">Due Date</th>
              <th className="py-3 text-right font-medium">Total</th>
              <th className="py-3 text-right font-medium">Paid</th>
              <th className="py-3 text-right font-medium">Balance</th>
              <th className="py-3 text-center font-medium">Days Overdue</th>
              <th className="py-3 text-center font-medium">Bucket</th>
              {canManage && <th className="py-3 text-center font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.purchase.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-800">
                <td className="py-3 font-medium text-brand-700">{r.purchase.invoice_no}</td>
                <td className="py-3 text-slate-700 dark:text-slate-200">{r.supplier?.name ?? '-'}</td>
                <td className="py-3 text-slate-600 dark:text-slate-300">{formatDate(r.purchase.invoice_date)}</td>
                <td className="py-3 text-slate-600 dark:text-slate-300">{formatDate(r.purchase.due_date)}</td>
                <td className="py-3 text-right text-slate-700 dark:text-slate-200">{formatINR(r.purchase.total_amount)}</td>
                <td className="py-3 text-right text-emerald-600">{formatINR(r.purchase.amount_paid)}</td>
                <td className="py-3 text-right text-rose-600 font-medium">{formatINR(r.purchase.outstanding)}</td>
                <td className="py-3 text-center text-rose-600">{r.days > 0 ? r.days : '-'}</td>
                <td className="py-3 text-center">
                  <Badge tone={r.bucket === 'Not due' ? 'positive' : r.bucket === '90+ days' ? 'negative' : 'warning'}>{r.bucket}</Badge>
                </td>
                {canManage && (
                  <td className="py-3 text-center">
                    <Button size="sm" onClick={() => onPay(r)}>Record Payment</Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FollowUpForm({ target, onClose, onSaved }: { target: FollowUpTarget; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().slice(0, 10));
  const [promisedDate, setPromisedDate] = useState('');
  const [status, setStatus] = useState<FollowUp['status']>('Open');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    if (!followUpDate) { setError('Choose a follow-up date.'); return; }
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Please sign in again.');
      const { data: role, error: roleError } = await supabase.from('app_user_roles').select('role').eq('user_id', auth.user.id).maybeSingle();
      if (roleError || role?.role !== 'admin') throw new Error('Only an Admin can create payment follow-ups.');
      const { error: insertError } = await supabase.from('customer_payment_followups').insert({
        invoice_id: target.id, customer_id: target.customerId, follow_up_date: followUpDate,
        promised_payment_date: promisedDate || null, status, notes: notes.trim() || null, created_by: auth.user.id,
      });
      if (insertError) throw insertError;
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save follow-up.'); }
    finally { setSaving(false); }
  }

  return <Modal open={true} onClose={onClose} title={`Payment Follow-up — ${target.invoiceNo}`} size="sm">
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm"><div className="font-medium">{target.customerName}</div><div className="text-slate-600 dark:text-slate-300">Outstanding: <span className="font-bold text-rose-600">{formatINR(target.outstanding)}</span></div></div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
      <div><Label>Next follow-up date</Label><Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} /></div>
      <div><Label>Promised payment date (optional)</Label><Input type="date" value={promisedDate} onChange={e => setPromisedDate(e.target.value)} /></div>
      <div><Label>Status</Label><Select value={status} onChange={e => setStatus(e.target.value as FollowUp['status'])}><option>Open</option><option>Contacted</option><option>Promise to Pay</option><option>No Response</option><option>Completed</option></Select></div>
      <div><Label>Call notes / next action</Label><textarea className="w-full min-h-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Spoke to accounts; promised UPI payment Friday." /></div>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Follow-up'}</Button></div>
    </div>
  </Modal>;
}

function PaymentForm({ invoice, onClose, onSaved }: {
  invoice: { id: string; invoiceNo: string; partyType: 'customer' | 'supplier'; partyId: string; outstanding: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(invoice.outstanding.toString());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const amt = parseFloat(amount) || 0;

  async function save() {
    setError('');
    if (amt <= 0) { setError('Amount must be greater than 0'); return; }
    if (amt > invoice.outstanding) { setError(`Amount cannot exceed outstanding balance of ${formatINR(invoice.outstanding)}`); return; }
    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error('Please sign in again before recording a payment.');

      const { data: roleData, error: roleError } = await supabase
        .from('app_user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (roleError || roleData?.role !== 'admin') {
        throw new Error('Only an Admin can record payments.');
      }

      // Insert payment
      const { error: payErr } = await supabase.from('payments').insert({
        payment_date: paymentDate,
        party_type: invoice.partyType,
        party_id: invoice.partyId,
        invoice_id: invoice.id,
        amount: amt,
        payment_method: method,
        reference_no: reference || null,
        notes: `Payment for ${invoice.invoiceNo}`,
      });
      if (payErr) throw payErr;

      // Update invoice outstanding
      const table = invoice.partyType === 'customer' ? 'sales_invoices' : 'purchases';
      // Fetch current invoice to get amount_paid
      const { data: current, error: currentError } = await supabase.from(table).select('amount_paid, outstanding').eq('id', invoice.id).single();
      if (currentError || !current) throw new Error('Invoice not found or could not be read.');
      const newAmountPaid = Number(current.amount_paid) + amt;
      const newOutstanding = Math.max(0, Number(current.outstanding) - amt);
      const newStatus = newOutstanding <= 0 ? 'Paid' : newAmountPaid > 0 ? 'Partial' : 'Unpaid';
      const { error: invErr } = await supabase.from(table).update({
        amount_paid: newAmountPaid,
        outstanding: newOutstanding,
        payment_status: newStatus,
      }).eq('id', invoice.id);
      if (invErr) throw invErr;

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Record Payment - ${invoice.invoiceNo}`} size="sm">
      <div className="space-y-4">
        {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">Outstanding Balance</span><span className="font-bold text-rose-600">{formatINR(invoice.outstanding)}</span></div>
        </div>
        <div><Label>Payment Amount (₹)</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><Label>Payment Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
        <div><Label>Payment Method</Label><Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Card</option>
        </Select></div>
        <div><Label>Reference No</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" /></div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
        </div>
      </div>
    </Modal>
  );
}
