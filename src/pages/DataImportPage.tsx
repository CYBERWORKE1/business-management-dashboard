import { useEffect, useState } from 'react';
import { Upload, Download, AlertTriangle, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { useData } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Button, Card, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

type ImportType = 'sales' | 'purchases' | 'inventory' | 'customers' | 'suppliers' | 'expenses';

const TEMPLATES: Record<ImportType, string> = {
  sales: 'invoice_no,invoice_date,customer_code,sku,quantity,unit,selling_price,unit_cost,discount_amount,amount_paid,due_date',
  purchases: 'purchase_invoice_no,purchase_date,supplier_name,sku,quantity,unit,unit_cost,amount_paid,due_date',
  inventory: 'sku,name,category,brand,diameter,length,pressure_rating,unit,purchase_cost,selling_price,stock_qty,min_stock,supplier_name',
  customers: 'customer_code,customer_name,city,phone,business_type,credit_limit',
  suppliers: 'supplier_code,supplier_name,contact_person,phone,city,products_supplied,payment_terms',
  expenses: 'expense_id,expense_date,category,description,vendor,amount,payment_method',
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += char; }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ',') { current.push(field); field = ''; }
      else if (char === '\n') { current.push(field); rows.push(current); current = []; field = ''; }
      else if (char === '\r') { /* skip */ }
      else { field += char; }
    }
  }
  if (field || current.length) { current.push(field); rows.push(current); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function downloadTemplate(type: ImportType) {
  const headers = TEMPLATES[type];
  const blob = new Blob([headers + '\n'], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataImportPage() {
  const data = useData();
  const [importType, setImportType] = useState<ImportType>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number; duplicates: number } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [permissionError, setPermissionError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadRole() {
      if (active) {
        setRoleLoading(true);
        setPermissionError('');
      }

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!user) {
          if (active) setIsAdmin(false);
          return;
        }

        const { data: roleRecord, error: roleError } = await supabase
          .from('app_user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError) throw roleError;
        if (active) setIsAdmin(roleRecord?.role === 'admin');
      } catch (err) {
        if (active) {
          setIsAdmin(false);
          setPermissionError(err instanceof Error ? err.message : 'Could not verify your permissions.');
        }
      } finally {
        if (active) setRoleLoading(false);
      }
    }

    void loadRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void loadRole();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function verifyAdminPermission() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Please sign in to continue.');

    const { data: roleRecord, error: roleError } = await supabase
      .from('app_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError) throw roleError;
    if (roleRecord?.role !== 'admin') {
      setIsAdmin(false);
      throw new Error('Admin permission is required for data imports and demo-data resets.');
    }
  }

  function handleFile(f: File) {
    setFile(f);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setHeaders(parsed[0]);
        setRows(parsed.slice(1));
        validate(parsed[0], parsed.slice(1));
      }
    };
    reader.readAsText(f);
  }

  function validate(hdrs: string[], dataRows: string[][]) {
    const errs: string[] = [];
    const warns: string[] = [];
    const expected = TEMPLATES[importType].split(',');
    const expectedMap = new Map(expected.map((h) => [h, true]));
    const headerMap = new Map(hdrs.map((h) => [h.trim(), h.trim()] as const));

    for (const exp of expected) {
      if (!headerMap.has(exp)) {
        errs.push(`Missing required column: "${exp}"`);
      }
    }
    for (const h of hdrs) {
      if (!expectedMap.has(h.trim())) {
        warns.push(`Unknown column: "${h}" — will be ignored`);
      }
    }
    if (dataRows.length === 0) {
      errs.push('No data rows found');
    }
    for (let i = 0; i < dataRows.length && i < 100; i++) {
      if (dataRows[i].length !== hdrs.length) {
        errs.push(`Row ${i + 2}: column count mismatch (expected ${hdrs.length}, got ${dataRows[i].length})`);
      }
    }
    setErrors(errs);
    setWarnings(warns);
  }

  function resetImport() {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setErrors([]);
    setWarnings([]);
    setImportResult(null);
  }

  async function doImport() {
    if (!isAdmin || roleLoading) {
      setPermissionError('Only Admin users can import data.');
      return;
    }
    if (errors.length > 0) return;
    setImporting(true);
    setImportResult(null);
    let success = 0;
    let errorCount = 0;
    let duplicates = 0;

    try {
      await verifyAdminPermission();
      const colMap = new Map(headers.map((h, i) => [h.trim(), i]));

      function getVal(row: string[], col: string): string {
        const idx = colMap.get(col);
        return idx !== undefined ? (row[idx] ?? '').trim() : '';
      }

      if (importType === 'customers') {
        const existing = new Set(data.customers.map((c) => c.customer_code));
        for (const row of rows) {
          const code = getVal(row, 'customer_code');
          if (existing.has(code)) { duplicates++; continue; }
          const { error } = await supabase.from('customers').insert({
            customer_code: code,
            name: getVal(row, 'customer_name'),
            city: getVal(row, 'city') || null,
            phone: getVal(row, 'phone') || null,
            business_type: getVal(row, 'business_type') || 'Retailer',
            credit_limit: parseFloat(getVal(row, 'credit_limit')) || 0,
          });
          if (error) { errorCount++; } else { success++; existing.add(code); }
        }
      } else if (importType === 'suppliers') {
        const existing = new Set(data.suppliers.map((s) => s.supplier_code));
        for (const row of rows) {
          const code = getVal(row, 'supplier_code');
          if (existing.has(code)) { duplicates++; continue; }
          const { error } = await supabase.from('suppliers').insert({
            supplier_code: code,
            name: getVal(row, 'supplier_name'),
            contact_person: getVal(row, 'contact_person') || null,
            phone: getVal(row, 'phone') || null,
            city: getVal(row, 'city') || null,
            products_supplied: getVal(row, 'products_supplied') || null,
            payment_terms: getVal(row, 'payment_terms') || '30 days',
          });
          if (error) { errorCount++; } else { success++; existing.add(code); }
        }
      } else if (importType === 'expenses') {
        const existing = new Set(data.expenses.map((e) => e.expense_id).filter(Boolean));
        for (const row of rows) {
          const eid = getVal(row, 'expense_id');
          if (eid && existing.has(eid)) { duplicates++; continue; }
          const { error } = await supabase.from('expenses').insert({
            expense_id: eid || null,
            expense_date: getVal(row, 'expense_date'),
            category: getVal(row, 'category'),
            description: getVal(row, 'description') || null,
            vendor: getVal(row, 'vendor') || null,
            amount: parseFloat(getVal(row, 'amount')) || 0,
            payment_method: getVal(row, 'payment_method') || 'Cash',
          });
          if (error) { errorCount++; } else { success++; if (eid) existing.add(eid); }
        }
      } else if (importType === 'inventory') {
        const existing = new Set(data.products.map((p) => p.sku));
        const supplierMap = new Map(data.suppliers.map((s) => [s.name, s.id]));
        for (const row of rows) {
          const sku = getVal(row, 'sku');
          if (existing.has(sku)) { duplicates++; continue; }
          const sname = getVal(row, 'supplier_name');
          const { error } = await supabase.from('products').insert({
            sku,
            name: getVal(row, 'name'),
            category: getVal(row, 'category'),
            brand: getVal(row, 'brand'),
            diameter: getVal(row, 'diameter') || null,
            length: getVal(row, 'length') || null,
            pressure_rating: getVal(row, 'pressure_rating') || null,
            unit: getVal(row, 'unit') || 'piece',
            purchase_cost: parseFloat(getVal(row, 'purchase_cost')) || 0,
            selling_price: parseFloat(getVal(row, 'selling_price')) || 0,
            stock_qty: parseFloat(getVal(row, 'stock_qty')) || 0,
            min_stock: parseFloat(getVal(row, 'min_stock')) || 0,
            supplier_id: sname ? (supplierMap.get(sname) ?? null) : null,
          });
          if (error) { errorCount++; } else { success++; existing.add(sku); }
        }
      } else if (importType === 'sales') {
        const customerMap = new Map(data.customers.map((c) => [c.customer_code, c.id]));
        const productMap = new Map(data.products.map((p) => [p.sku, p.id]));
        const existing = new Set(data.salesInvoices.map((s) => s.invoice_no));
        for (const row of rows) {
          const invNo = getVal(row, 'invoice_no');
          if (existing.has(invNo)) { duplicates++; continue; }
          const custId = customerMap.get(getVal(row, 'customer_code'));
          const prodId = productMap.get(getVal(row, 'sku'));
          if (!custId || !prodId) { errorCount++; continue; }
          const qty = parseFloat(getVal(row, 'quantity')) || 0;
          const price = parseFloat(getVal(row, 'selling_price')) || 0;
          const cost = parseFloat(getVal(row, 'unit_cost')) || 0;
          const disc = parseFloat(getVal(row, 'discount_amount')) || 0;
          const paid = parseFloat(getVal(row, 'amount_paid')) || 0;
          const subtotal = qty * price;
          const total = subtotal - disc;
          const outstanding = total - paid;
          const status = outstanding <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
          const { data: inv, error } = await supabase.from('sales_invoices').insert({
            invoice_no: invNo, invoice_date: getVal(row, 'invoice_date'), customer_id: custId,
            salesperson: 'Imported', subtotal, discount_amount: disc, gst_amount: 0,
            total_amount: total, amount_paid: paid, outstanding, payment_status: status,
            due_date: getVal(row, 'due_date') || null, status: 'confirmed',
          }).select().single();
          if (error || !inv) { errorCount++; continue; }
          await supabase.from('sales_invoice_items').insert({
            invoice_id: inv.id, product_id: prodId, sku: getVal(row, 'sku'),
            description: '', quantity: qty, unit: getVal(row, 'unit') || 'piece',
            selling_price: price, unit_cost: cost, discount_amount: disc, gst_amount: 0,
            line_total: total, line_cogs: qty * cost,
          });
          if (paid > 0) {
            await supabase.from('payments').insert({
              payment_date: getVal(row, 'invoice_date'), party_type: 'customer',
              party_id: custId, invoice_id: inv.id, amount: paid, payment_method: 'Imported',
              notes: `Import payment ${invNo}`,
            });
          }
          success++; existing.add(invNo);
        }
      } else if (importType === 'purchases') {
        const supplierMap = new Map(data.suppliers.map((s) => [s.name, s.id]));
        const productMap = new Map(data.products.map((p) => [p.sku, p.id]));
        const existing = new Set(data.purchases.map((p) => p.invoice_no));
        for (const row of rows) {
          const invNo = getVal(row, 'purchase_invoice_no');
          if (existing.has(invNo)) { duplicates++; continue; }
          const supId = supplierMap.get(getVal(row, 'supplier_name'));
          const prodId = productMap.get(getVal(row, 'sku'));
          if (!supId || !prodId) { errorCount++; continue; }
          const qty = parseFloat(getVal(row, 'quantity')) || 0;
          const cost = parseFloat(getVal(row, 'unit_cost')) || 0;
          const paid = parseFloat(getVal(row, 'amount_paid')) || 0;
          const subtotal = qty * cost;
          const outstanding = subtotal - paid;
          const { data: pur, error } = await supabase.from('purchases').insert({
            invoice_no: invNo, invoice_date: getVal(row, 'purchase_date'), supplier_id: supId,
            subtotal, discount_amount: 0, gst_amount: 0, total_amount: subtotal,
            amount_paid: paid, outstanding, due_date: getVal(row, 'due_date') || null,
            status: 'confirmed',
          }).select().single();
          if (error || !pur) { errorCount++; continue; }
          await supabase.from('purchase_items').insert({
            purchase_id: pur.id, product_id: prodId, sku: getVal(row, 'sku'),
            description: '', quantity: qty, unit: getVal(row, 'unit') || 'piece',
            unit_cost: cost, line_total: subtotal,
          });
          if (paid > 0) {
            await supabase.from('payments').insert({
              payment_date: getVal(row, 'purchase_date'), party_type: 'supplier',
              party_id: supId, invoice_id: pur.id, amount: paid, payment_method: 'Imported',
              notes: `Import payment ${invNo}`,
            });
          }
          success++; existing.add(invNo);
        }
      }

      setImportResult({ success, errors: errorCount, duplicates });
      await data.refresh();
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : 'Import failed.');
      setImportResult({ success, errors: errorCount + 1, duplicates });
    } finally {
      setImporting(false);
    }
  }

  async function resetDemoData() {
    if (!isAdmin || roleLoading) {
      setPermissionError('Only Admin users can reset demo data.');
      return;
    }
    if (!confirm('This will DELETE all current data and restore the original demo dataset. Continue?')) return;
    if (!confirm('Are you absolutely sure? All invoices, payments, and stock movements will be lost.')) return;
    setResetting(true);
    try {
      await verifyAdminPermission();
      // Delete all data in reverse dependency order
      await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('sales_invoice_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('sales_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('purchase_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('purchases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Re-seed by calling the edge function — but since we don't have one, we re-insert core data
      // Use the seed SQL via execute
      await reseed();
      await data.refresh();
      alert('Demo data has been reset successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setPermissionError(message);
      alert('Failed to reset: ' + message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Data Import" subtitle="Import CSV files, download templates, and manage demo data" />

      {permissionError && (
        <div className="mb-4 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
          {permissionError}
        </div>
      )}

      {!roleLoading && !isAdmin && (
        <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
          Viewer access: you can download CSV templates, but importing data and resetting demo data are restricted to Admin users.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Download Templates">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Download CSV templates for each dataset type.</p>
          <div className="space-y-2">
            {(Object.keys(TEMPLATES) as ImportType[]).map((t) => (
              <button
                key={t}
                onClick={() => downloadTemplate(t)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-brand-50 dark:hover:bg-slate-700 hover:text-brand-700 dark:hover:text-brand-300"
              >
                <span className="capitalize flex items-center gap-2"><FileText size={16} /> {t} Template</span>
                <Download size={14} />
              </button>
            ))}
          </div>
        </Card>

        {isAdmin && !roleLoading && <Card title="Import Data" className="lg:col-span-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Type</label>
              <Select value={importType} onChange={(e) => { setImportType(e.target.value as ImportType); resetImport(); }}>
                <option value="customers">Customers</option>
                <option value="suppliers">Suppliers</option>
                <option value="expenses">Expenses</option>
                <option value="inventory">Inventory</option>
                <option value="sales">Sales</option>
                <option value="purchases">Purchases</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Upload CSV File</label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center">
                {file ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-800 dark:text-slate-100">{file.name}</span>
                    <button onClick={resetImport} className="text-rose-500 text-sm">Remove</button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="mx-auto text-slate-400 mb-2" size={32} />
                    <p className="text-sm text-slate-600 dark:text-slate-300">Click to select a CSV file</p>
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  </label>
                )}
              </div>
            </div>

            {errors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-sm font-medium text-rose-700 mb-1">Errors ({errors.length}):</p>
                <ul className="text-sm text-rose-600 list-disc list-inside space-y-0.5">
                  {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-700 mb-1">Warnings:</p>
                <ul className="text-sm text-amber-600 list-disc list-inside space-y-0.5">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {headers.length > 0 && rows.length > 0 && errors.length === 0 && (
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">Preview (first 5 rows):</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        {headers.map((h, i) => <th key={i} className="py-1.5 px-2 font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                          {headers.map((_, j) => <td key={j} className="py-1.5 px-2 text-slate-700 dark:text-slate-200">{row[j] ?? '-'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{rows.length} rows detected</p>
                </div>
              </div>
            )}

            {importResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm mb-1">
                  <CheckCircle size={16} /> Import Complete
                </div>
                <p className="text-sm text-emerald-600">Imported: {importResult.success} | Duplicates skipped: {importResult.duplicates} | Errors: {importResult.errors}</p>
              </div>
            )}

            {headers.length > 0 && errors.length === 0 && (
              <Button onClick={doImport} disabled={importing || rows.length === 0}>
                {importing ? 'Importing...' : `Import ${rows.length} Rows`}
              </Button>
            )}
          </div>
        </Card>}
      </div>

      {isAdmin && !roleLoading && <Card title="Reset Demo Data" className="border-amber-300 dark:border-amber-800">
        <div className="flex items-start gap-4">
          <AlertTriangle className="text-amber-600 shrink-0" size={24} />
          <div className="flex-1">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              This will delete ALL current data and restore the original fictional demo dataset for Jainath Sales.
              This action cannot be undone.
            </p>
            <Button variant="danger" onClick={resetDemoData} disabled={resetting}>
              <RefreshCw size={16} className={resetting ? 'animate-spin' : ''} />
              {resetting ? 'Resetting...' : 'Reset Demo Data'}
            </Button>
          </div>
        </div>
      </Card>}
    </PageContainer>
  );
}

async function reseed() {
  // Re-seed core data via execute_sql
  // Suppliers
  await supabase.from('suppliers').insert([
    { supplier_code: 'S001', name: 'Shree Pipe Traders', contact_person: 'Ramesh Shree', phone: '9100000001', city: 'Patna', products_supplied: 'PVC, CPVC pipes', payment_terms: '30 days' },
    { supplier_code: 'S002', name: 'Metro Suppliers', contact_person: 'Suresh Mehta', phone: '9100000002', city: 'Gaya', products_supplied: 'UPVC, HDPE pipes', payment_terms: '30 days' },
    { supplier_code: 'S003', name: 'National Pipe Co', contact_person: 'Anil National', phone: '9100000003', city: 'Muzzafarpur', products_supplied: 'GI, MS pipes', payment_terms: '45 days' },
    { supplier_code: 'S004', name: 'Steel Distributors', contact_person: 'Rajesh Steel', phone: '9100000004', city: 'Patna', products_supplied: 'MS, GI pipes', payment_terms: '30 days' },
    { supplier_code: 'S005', name: 'Apex Polymers', contact_person: 'Mahesh Apex', phone: '9100000005', city: 'Bihar Sharif', products_supplied: 'PVC, HDPE pipes', payment_terms: '15 days' },
  ]);

  // Customers
  await supabase.from('customers').insert([
    { customer_code: 'C001', name: 'Sharma Hardware', phone: '9000000001', city: 'Patna', business_type: 'Retailer', credit_limit: 100000 },
    { customer_code: 'C002', name: 'Gupta Building Materials', phone: '9000000002', city: 'Gaya', business_type: 'Dealer', credit_limit: 200000 },
    { customer_code: 'C003', name: 'Modern Plumbing House', phone: '9000000003', city: 'Patna', business_type: 'Retailer', credit_limit: 75000 },
    { customer_code: 'C004', name: 'Patna Construction Co', phone: '9000000004', city: 'Patna', business_type: 'Contractor', credit_limit: 300000 },
    { customer_code: 'C005', name: 'Verma Sanitary Store', phone: '9000000005', city: 'Muzzafarpur', business_type: 'Retailer', credit_limit: 80000 },
    { customer_code: 'C006', name: 'National Builders', phone: '9000000006', city: 'Bihar Sharif', business_type: 'Contractor', credit_limit: 250000 },
    { customer_code: 'C007', name: 'City Pipe Centre', phone: '9000000007', city: 'Danapur', business_type: 'Dealer', credit_limit: 150000 },
    { customer_code: 'C008', name: 'Om Hardware', phone: '9000000008', city: 'Ara', business_type: 'Retailer', credit_limit: 60000 },
  ]);

  // Products
  const suppliers = await supabase.from('suppliers').select('id, supplier_code');
  const sMap = new Map((suppliers.data ?? []).map((s) => [s.supplier_code, s.id]));
  await supabase.from('products').insert([
    { sku: 'P001', name: 'PVC Pipe 1 inch 6m', category: 'PVC', brand: 'Prince', diameter: '25mm', length: '6m', pressure_rating: '4kg/cm2', unit: 'piece', purchase_cost: 120, selling_price: 155, stock_qty: 240, min_stock: 50, supplier_id: sMap.get('S001') },
    { sku: 'P002', name: 'CPVC Pipe 3/4 inch 6m', category: 'CPVC', brand: 'Astral', diameter: '20mm', length: '6m', pressure_rating: '6kg/cm2', unit: 'piece', purchase_cost: 160, selling_price: 205, stock_qty: 110, min_stock: 60, supplier_id: sMap.get('S001') },
    { sku: 'P003', name: 'UPVC Pipe 1.5 inch 6m', category: 'UPVC', brand: 'Finolex', diameter: '40mm', length: '6m', pressure_rating: '6kg/cm2', unit: 'piece', purchase_cost: 220, selling_price: 285, stock_qty: 5, min_stock: 40, supplier_id: sMap.get('S002') },
    { sku: 'P004', name: 'CPVC Pipe 1 inch 6m', category: 'CPVC', brand: 'Astral', diameter: '25mm', length: '6m', pressure_rating: '6kg/cm2', unit: 'piece', purchase_cost: 190, selling_price: 245, stock_qty: 70, min_stock: 50, supplier_id: sMap.get('S002') },
    { sku: 'P005', name: 'HDPE Pipe 2 inch coil 30m', category: 'HDPE', brand: 'Supreme', diameter: '50mm', length: '30m', pressure_rating: '8kg/cm2', unit: 'piece', purchase_cost: 260, selling_price: 330, stock_qty: 40, min_stock: 20, supplier_id: sMap.get('S005') },
    { sku: 'P006', name: 'GI Pipe 1 inch 6m', category: 'GI', brand: 'Jindal', diameter: '25mm', length: '6m', pressure_rating: 'medium', unit: 'piece', purchase_cost: 480, selling_price: 610, stock_qty: 38, min_stock: 30, supplier_id: sMap.get('S003') },
    { sku: 'P007', name: 'HDPE Pipe 4 inch coil 50m', category: 'HDPE', brand: 'Supreme', diameter: '110mm', length: '50m', pressure_rating: '10kg/cm2', unit: 'roll', purchase_cost: 2200, selling_price: 2800, stock_qty: 16, min_stock: 8, supplier_id: sMap.get('S005') },
    { sku: 'P008', name: 'MS Pipe 2 inch 6m', category: 'MS', brand: 'Tata', diameter: '50mm', length: '6m', pressure_rating: 'standard', unit: 'piece', purchase_cost: 650, selling_price: 820, stock_qty: 30, min_stock: 25, supplier_id: sMap.get('S004') },
    { sku: 'P009', name: 'MS Pipe 4 inch 6m', category: 'MS', brand: 'Tata', diameter: '100mm', length: '6m', pressure_rating: 'standard', unit: 'piece', purchase_cost: 1100, selling_price: 1380, stock_qty: 20, min_stock: 15, supplier_id: sMap.get('S004') },
    { sku: 'P010', name: 'UPVC Pipe 2 inch 6m', category: 'UPVC', brand: 'Finolex', diameter: '50mm', length: '6m', pressure_rating: '6kg/cm2', unit: 'piece', purchase_cost: 340, selling_price: 430, stock_qty: 50, min_stock: 40, supplier_id: sMap.get('S002') },
    { sku: 'P011', name: 'PVC Pipe 2 inch 6m', category: 'PVC', brand: 'Prince', diameter: '50mm', length: '6m', pressure_rating: '4kg/cm2', unit: 'piece', purchase_cost: 290, selling_price: 370, stock_qty: 10, min_stock: 50, supplier_id: sMap.get('S001') },
    { sku: 'P012', name: 'GI Pipe 1.5 inch 6m', category: 'GI', brand: 'Jindal', diameter: '40mm', length: '6m', pressure_rating: 'medium', unit: 'piece', purchase_cost: 780, selling_price: 980, stock_qty: 20, min_stock: 20, supplier_id: sMap.get('S003') },
    { sku: 'P013', name: 'HDPE Pipe 3 inch coil 30m', category: 'HDPE', brand: 'Supreme', diameter: '75mm', length: '30m', pressure_rating: '8kg/cm2', unit: 'roll', purchase_cost: 1800, selling_price: 2300, stock_qty: 5, min_stock: 6, supplier_id: sMap.get('S005') },
    { sku: 'P014', name: 'MS Pipe 3 inch 6m', category: 'MS', brand: 'Tata', diameter: '80mm', length: '6m', pressure_rating: 'standard', unit: 'piece', purchase_cost: 900, selling_price: 1120, stock_qty: 2, min_stock: 18, supplier_id: sMap.get('S004') },
    { sku: 'P015', name: 'MS Pipe 6 inch 6m', category: 'MS', brand: 'Tata', diameter: '150mm', length: '6m', pressure_rating: 'heavy', unit: 'piece', purchase_cost: 1750, selling_price: 2150, stock_qty: 9, min_stock: 10, supplier_id: sMap.get('S004') },
  ]);

  // Expenses
  await supabase.from('expenses').insert([
    { expense_id: 'EXP-001', expense_date: '2026-04-05', category: 'Transport', description: 'Delivery vehicle fuel', vendor: 'Local Fuel Station', amount: 4500, payment_method: 'Bank Transfer' },
    { expense_id: 'EXP-002', expense_date: '2026-04-15', category: 'Rent', description: 'Warehouse rent', vendor: 'Property Owner', amount: 18000, payment_method: 'Bank Transfer' },
    { expense_id: 'EXP-003', expense_date: '2026-05-10', category: 'Salaries', description: 'Staff salaries', vendor: 'Payroll', amount: 35000, payment_method: 'Bank Transfer' },
    { expense_id: 'EXP-004', expense_date: '2026-06-12', category: 'Electricity', description: 'Warehouse electricity', vendor: 'Electricity Board', amount: 3200, payment_method: 'UPI' },
    { expense_id: 'EXP-005', expense_date: '2026-07-08', category: 'Transport', description: 'Customer deliveries', vendor: 'Local Transporter', amount: 6500, payment_method: 'Cash' },
    { expense_id: 'EXP-006', expense_date: '2026-08-10', category: 'Repairs', description: 'Warehouse repairs', vendor: 'Local Contractor', amount: 2500, payment_method: 'UPI' },
    { expense_id: 'EXP-007', expense_date: '2026-09-05', category: 'Salaries', description: 'Staff salaries', vendor: 'Payroll', amount: 35000, payment_method: 'Bank Transfer' },
    { expense_id: 'EXP-008', expense_date: '2026-10-05', category: 'Packaging', description: 'Packing materials', vendor: 'Packaging Store', amount: 1800, payment_method: 'Cash' },
  ]);
}
