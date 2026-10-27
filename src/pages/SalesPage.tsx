import { useEffect, useMemo, useState } from 'react';
import { Plus, Eye, Edit, Trash2, IndianRupee, X } from 'lucide-react';
import { useData } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatDate, formatINR, formatNumber } from '@/lib/format';
import type { SalesInvoice, SalesInvoiceItem } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, Label, LoadingState, Modal, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

type FilterStatus = 'all' | 'Paid' | 'Partial' | 'Unpaid';

export function SalesPage() {
  const data = useData();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [viewInvoice, setViewInvoice] = useState<SalesInvoice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editInvoice, setEditInvoice] = useState<SalesInvoice | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [userRole, setUserRole] = useState<'admin' | 'viewer' | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const isAdmin = userRole === 'admin';

  // Resolve the signed-in user's role from Supabase. Controls stay hidden unless
  // the database explicitly confirms that the current user is an admin.
  useEffect(() => {
    let mounted = true;

    async function loadRole(userId?: string) {
      if (!userId) {
        if (mounted) {
          setUserRole(null);
          setRoleLoading(false);
        }
        return;
      }

      if (mounted) setRoleLoading(true);
      const { data: roleRecord, error } = await supabase
        .from('app_user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!mounted) return;
      setUserRole(!error && (roleRecord?.role === 'admin' || roleRecord?.role === 'viewer')
        ? roleRecord.role
        : null);
      setRoleLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      void loadRole(session?.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadRole(session?.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const customerMap = useMemo(() => new Map(data.customers.map((c) => [c.id, c])), [data.customers]);
  const productMap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const filtered = useMemo(() => {
    return data.salesInvoices.filter((s) => {
      const matchStatus = statusFilter === 'all' || s.payment_status === statusFilter;
      const customer = customerMap.get(s.customer_id);
      const matchSearch = !search ||
        s.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
        customer?.name.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [data.salesInvoices, statusFilter, search, customerMap]);

  const itemsForInvoice = (invoiceId: string): SalesInvoiceItem[] =>
    data.salesItems.filter((i) => i.invoice_id === invoiceId);

  async function deleteInvoice(invoice: SalesInvoice) {
    if (!isAdmin) return;
    if (!confirm(`Delete invoice ${invoice.invoice_no}? This will restore stock and cannot be undone.`)) return;
    const items = itemsForInvoice(invoice.id);
    // Restore stock
    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (product) {
        await supabase.from('products')
          .update({ stock_qty: product.stock_qty + item.quantity })
          .eq('id', product.id);
      }
    }
    await supabase.from('stock_movements').delete().eq('reference_id', invoice.invoice_no);
    await supabase.from('payments').delete().eq('invoice_id', invoice.id);
    await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id);
    await supabase.from('sales_invoices').delete().eq('id', invoice.id);
    await data.refresh();
    setRefresh((r) => r + 1);
  }

  return (
    <PageContainer>
      {!roleLoading && !userRole && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account role could not be verified. Sales changes are disabled; contact an administrator if you believe this is incorrect.
        </div>
      )}
      <PageHeader
        title="Sales"
        subtitle="Manage sales invoices and customer transactions"
        actions={isAdmin ? (
          <Button onClick={() => { setEditInvoice(null); setShowCreate(true); }}>
            <Plus size={18} /> New Invoice
          </Button>
        ) : undefined}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Search by invoice number or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FilterStatus)} className="max-w-xs">
          <option value="all">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partial</option>
          <option value="Unpaid">Unpaid</option>
        </Select>
      </div>

      <Card>
        {data.loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message="No sales invoices found" icon={<IndianRupee size={32} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 font-medium">Invoice No</th>
                  <th className="py-3 font-medium">Date</th>
                  <th className="py-3 font-medium">Customer</th>
                  <th className="py-3 font-medium">Salesperson</th>
                  <th className="py-3 text-right font-medium">Total</th>
                  <th className="py-3 text-right font-medium">Paid</th>
                  <th className="py-3 text-right font-medium">Outstanding</th>
                  <th className="py-3 text-center font-medium">Status</th>
                  <th className="py-3 text-center font-medium">{isAdmin ? 'Actions' : 'View'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const customer = customerMap.get(s.customer_id);
                  return (
                    <tr key={s.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="py-3 font-medium text-brand-700 dark:text-blue-300">{s.invoice_no}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{formatDate(s.invoice_date)}</td>
                      <td className="py-3 text-slate-700 dark:text-slate-100">{customer?.name ?? '-'}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{s.salesperson ?? '-'}</td>
                      <td className="py-3 text-right text-slate-700 dark:text-slate-100">{formatINR(s.total_amount)}</td>
                      <td className="py-3 text-right text-emerald-600">{formatINR(s.amount_paid)}</td>
                      <td className="py-3 text-right text-rose-600">{formatINR(s.outstanding)}</td>
                      <td className="py-3 text-center">
                        <Badge tone={s.payment_status === 'Paid' ? 'positive' : s.payment_status === 'Partial' ? 'warning' : 'negative'}>
                          {s.payment_status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewInvoice(s)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-blue-300 hover:bg-brand-50 dark:hover:bg-slate-700 rounded" title="View">
                            <Eye size={16} />
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => { setEditInvoice(s); setShowCreate(true); }} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700 rounded" title="Edit invoice">
                                <Edit size={16} />
                              </button>
                              <button onClick={() => void deleteInvoice(s)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-slate-700 rounded" title="Delete invoice">
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* View Invoice Modal */}
      {viewInvoice && (
        <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Invoice ${viewInvoice.invoice_no}`} size="lg">
          <ViewInvoice invoice={viewInvoice} items={itemsForInvoice(viewInvoice.id)}
            customerName={customerMap.get(viewInvoice.customer_id)?.name ?? '-'}
            products={data.products}
          />
        </Modal>
      )}

      {/* Create/Edit Invoice Modal */}
      {showCreate && isAdmin && !roleLoading && (
        <InvoiceForm
          editInvoice={editInvoice}
          onClose={() => { setShowCreate(false); setEditInvoice(null); }}
          onSaved={async () => { await data.refresh(); setRefresh((r) => r + 1); }}
        />
      )}
      <span className="hidden">{refresh}</span>
    </PageContainer>
  );
}

function ViewInvoice({ invoice, items, customerName, products }: {
  invoice: SalesInvoice;
  items: SalesInvoiceItem[];
  customerName: string;
  products: { id: string; name: string; sku: string }[];
}) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500">Customer</p>
          <p className="font-medium text-slate-800">{customerName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Salesperson</p>
          <p className="font-medium text-slate-800">{invoice.salesperson ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Invoice Date</p>
          <p className="font-medium text-slate-800">{formatDate(invoice.invoice_date)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Due Date</p>
          <p className="font-medium text-slate-800">{formatDate(invoice.due_date)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 font-medium">SKU</th>
              <th className="py-2 font-medium">Product</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Disc</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="py-2 text-brand-700 font-medium">{item.sku}</td>
                <td className="py-2 text-slate-700">{productMap.get(item.product_id)?.name ?? item.description}</td>
                <td className="py-2 text-right text-slate-600">{formatNumber(item.quantity)} {item.unit}</td>
                <td className="py-2 text-right text-slate-600">{formatINR(item.selling_price)}</td>
                <td className="py-2 text-right text-slate-600">{formatINR(item.discount_amount)}</td>
                <td className="py-2 text-right text-slate-700 font-medium">{formatINR(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-xs space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Subtotal</span>
          <span className="text-slate-700">{formatINR(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Discount</span>
          <span className="text-slate-700">-{formatINR(invoice.discount_amount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">GST</span>
          <span className="text-slate-700">{formatINR(invoice.gst_amount)}</span>
        </div>
        <div className="flex justify-between font-semibold text-base border-t pt-2">
          <span className="text-slate-800">Total</span>
          <span className="text-slate-800">{formatINR(invoice.total_amount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-emerald-600">Amount Paid</span>
          <span className="text-emerald-600">{formatINR(invoice.amount_paid)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-rose-600">Outstanding</span>
          <span className="text-rose-600">{formatINR(invoice.outstanding)}</span>
        </div>
      </div>
    </div>
  );
}

type LineItem = {
  product_id: string;
  quantity: number;
  selling_price: number;
  discount_amount: number;
};

function InvoiceForm({ editInvoice, onClose, onSaved }: {
  editInvoice: SalesInvoice | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const data = useData();
  const [invoiceNo, setInvoiceNo] = useState(editInvoice?.invoice_no ?? '');
  const [invoiceDate, setInvoiceDate] = useState(editInvoice?.invoice_date ?? new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState(editInvoice?.customer_id ?? '');
  const [salesperson, setSalesperson] = useState(editInvoice?.salesperson ?? '');
  const [employees, setEmployees] = useState<{ id: string; name: string; is_active: boolean }[]>([]);
  const [employeesError, setEmployeesError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadEmployees() {
      const { data: rows, error: loadError } = await supabase
        .from('employees')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (!mounted) return;
      if (loadError) {
        setEmployeesError(`Unable to load active employees: ${loadError.message}`);
        setEmployees([]);
        return;
      }
      const activeEmployees = (rows ?? []) as { id: string; name: string; is_active: boolean }[];
      setEmployees(activeEmployees);
      setEmployeesError('');
      if (!editInvoice && !salesperson && activeEmployees.length) setSalesperson(activeEmployees[0].name);
    }
    void loadEmployees();
    return () => { mounted = false; };
  }, [editInvoice?.id]);
  const [dueDate, setDueDate] = useState(editInvoice?.due_date ?? '');
  const [amountPaid, setAmountPaid] = useState(editInvoice?.amount_paid.toString() ?? '0');
  const [lines, setLines] = useState<LineItem[]>([{ product_id: '', quantity: 1, selling_price: 0, discount_amount: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const productMap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  function addLine() {
    setLines([...lines, { product_id: '', quantity: 1, selling_price: 0, discount_amount: 0 }]);
  }
  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, field: keyof LineItem, value: string | number) {
    setLines(lines.map((line, i) => {
      if (i !== idx) return line;
      const updated = { ...line, [field]: value };
      if (field === 'product_id') {
        const p = productMap.get(value as string);
        if (p) updated.selling_price = p.selling_price;
      }
      return updated;
    }));
  }

  const subtotal = lines.reduce((sum, l) => sum + (l.quantity * l.selling_price - l.discount_amount), 0);
  const totalDiscount = lines.reduce((sum, l) => sum + l.discount_amount, 0);
  const paid = parseFloat(amountPaid) || 0;
  const outstanding = subtotal - paid;
  const paymentStatus = outstanding <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';

  async function save() {
    setError('');
    if (!invoiceNo.trim()) { setError('Invoice number required'); return; }
    if (!customerId) { setError('Customer required'); return; }
    if (lines.some((l) => !l.product_id || l.quantity <= 0)) { setError('All line items must have a product and quantity > 0'); return; }

    if (!salesperson.trim()) { setError('Select an active employee as salesperson.'); return; }
    setSaving(true);
    try {
      // Check duplicate invoice number
      if (!editInvoice) {
        const existing = await supabase.from('sales_invoices').select('id').eq('invoice_no', invoiceNo).maybeSingle();
        if (existing.data) { setError('Invoice number already exists'); setSaving(false); return; }
      }

      // Check stock availability
      for (const line of lines) {
        const product = productMap.get(line.product_id);
        if (!product) continue;
        const existingItemQty = editInvoice ? data.salesItems.filter((i) => i.invoice_id === editInvoice.id && i.product_id === line.product_id).reduce((s, i) => s + i.quantity, 0) : 0;
        const available = product.stock_qty + existingItemQty;
        if (line.quantity > available) {
          setError(`Insufficient stock for ${product.name}. Available: ${available} ${product.unit}`);
          setSaving(false);
          return;
        }
      }

      let invoiceId = editInvoice?.id;

      if (editInvoice) {
        // Restore stock for old items
        const oldItems = data.salesItems.filter((i) => i.invoice_id === editInvoice.id);
        for (const item of oldItems) {
          const p = productMap.get(item.product_id);
          if (p) {
            await supabase.from('products').update({ stock_qty: p.stock_qty + item.quantity }).eq('id', p.id);
          }
        }
        await supabase.from('sales_invoice_items').delete().eq('invoice_id', editInvoice.id);
        await supabase.from('payments').delete().eq('invoice_id', editInvoice.id);
        await supabase.from('stock_movements').delete().eq('reference_id', editInvoice.invoice_no);

        await supabase.from('sales_invoices').update({
          invoice_no: invoiceNo,
          invoice_date: invoiceDate,
          customer_id: customerId,
          salesperson,
          subtotal,
          discount_amount: totalDiscount,
          gst_amount: 0,
          total_amount: subtotal,
          amount_paid: paid,
          outstanding,
          payment_status: paymentStatus,
          due_date: dueDate || null,
        }).eq('id', editInvoice.id);
      } else {
        const { data: newInvoice, error: invErr } = await supabase.from('sales_invoices').insert({
          invoice_no: invoiceNo,
          invoice_date: invoiceDate,
          customer_id: customerId,
          salesperson,
          subtotal,
          discount_amount: totalDiscount,
          gst_amount: 0,
          total_amount: subtotal,
          amount_paid: paid,
          outstanding,
          payment_status: paymentStatus,
          due_date: dueDate || null,
          status: 'confirmed',
        }).select().single();
        if (invErr) throw invErr;
        invoiceId = newInvoice.id;
      }

      // Insert items and deduct stock
      for (const line of lines) {
        const product = productMap.get(line.product_id);
        if (!product) continue;
        const lineTotal = line.quantity * line.selling_price - line.discount_amount;
        const lineCogs = line.quantity * product.purchase_cost;
        await supabase.from('sales_invoice_items').insert({
          invoice_id: invoiceId,
          product_id: line.product_id,
          sku: product.sku,
          description: product.name,
          quantity: line.quantity,
          unit: product.unit,
          selling_price: line.selling_price,
          unit_cost: product.purchase_cost,
          discount_amount: line.discount_amount,
          gst_amount: 0,
          line_total: lineTotal,
          line_cogs: lineCogs,
        });
        // Deduct stock
        const newStock = product.stock_qty - line.quantity;
        await supabase.from('products').update({ stock_qty: newStock }).eq('id', line.product_id);
        await supabase.from('stock_movements').insert({
          product_id: line.product_id,
          movement_date: invoiceDate,
          movement_type: 'sale_out',
          quantity: -line.quantity,
          balance_after: newStock,
          reference_type: 'sale',
          reference_id: invoiceNo,
          notes: `Sale ${invoiceNo}`,
        });
      }

      // Insert initial payment if any
      if (paid > 0) {
        await supabase.from('payments').insert({
          payment_date: invoiceDate,
          party_type: 'customer',
          party_id: customerId,
          invoice_id: invoiceId,
          amount: paid,
          payment_method: 'Cash',
          notes: `Payment for ${invoiceNo}`,
        });
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={editInvoice ? `Edit ${editInvoice.invoice_no}` : 'New Sales Invoice'} size="xl">
      <div className="space-y-4">
        {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>Invoice No</Label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="JS-26XXX" />
          </div>
          <div>
            <Label>Invoice Date</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer...</option>
              {data.customers
                .filter((c) => (c as typeof c & { is_active?: boolean }).is_active !== false || c.id === customerId)
                .map((c) => {
                  const inactive = (c as typeof c & { is_active?: boolean }).is_active === false;
                  return <option key={c.id} value={c.id}>{c.name} ({c.customer_code}){inactive ? ' — Inactive (existing invoice)' : ''}</option>;
                })}
            </Select>
          </div>
          <div>
            <Label>Salesperson</Label>
            <Select value={salesperson} onChange={(e) => setSalesperson(e.target.value)}>
              <option value="">Select active employee...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.name}>{employee.name}</option>
              ))}
              {editInvoice?.salesperson && !employees.some((employee) => employee.name === editInvoice.salesperson) && (
                <option value={editInvoice.salesperson}>{editInvoice.salesperson} (historical invoice)</option>
              )}
            </Select>
            {employeesError && <p className="mt-1 text-xs text-rose-600">{employeesError}</p>}
            {!employeesError && employees.length === 0 && !editInvoice && <p className="mt-1 text-xs text-amber-600">Add an active employee before creating a sales invoice.</p>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Line Items</Label>
            <Button size="sm" variant="secondary" onClick={addLine}><Plus size={14} /> Add Line</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 font-medium">Product</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Price</th>
                  <th className="py-2 text-right font-medium">Discount</th>
                  <th className="py-2 text-right font-medium">Total</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const product = productMap.get(line.product_id);
                  return (
                    <tr key={idx} className="border-b border-slate-50">
                      <td className="py-2">
                        <Select value={line.product_id} onChange={(e) => updateLine(idx, 'product_id', e.target.value)} className="min-w-[200px]">
                          <option value="">Select product...</option>
                          {data.products.map((p) => (
                            <option key={p.id} value={p.id}>{p.sku} - {p.name} (Stock: {p.stock_qty} {p.unit})</option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2 w-20">
                        <Input type="number" min="0" value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)} className="text-right" />
                      </td>
                      <td className="py-2 w-28">
                        <Input type="number" min="0" value={line.selling_price}
                          onChange={(e) => updateLine(idx, 'selling_price', parseFloat(e.target.value) || 0)} className="text-right" />
                      </td>
                      <td className="py-2 w-24">
                        <Input type="number" min="0" value={line.discount_amount}
                          onChange={(e) => updateLine(idx, 'discount_amount', parseFloat(e.target.value) || 0)} className="text-right" />
                      </td>
                      <td className="py-2 text-right font-semibold !text-slate-900 dark:!text-emerald-100">
                        {formatINR(line.quantity * line.selling_price - line.discount_amount)}
                      </td>
                      <td className="py-2">
                        {lines.length > 1 && (
                          <button onClick={() => removeLine(idx)} className="text-rose-500 hover:text-rose-700 p-1">
                            <X size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Amount Paid (₹)</Label>
            <Input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-slate-900/70 p-4 space-y-2">
          <div className="flex justify-between gap-4 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{formatINR(subtotal + totalDiscount)}</span>
          </div>
          <div className="flex justify-between gap-4 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-slate-600 dark:text-slate-400">Discount</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">-{formatINR(totalDiscount)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-2 text-base font-bold text-slate-900 dark:text-white">
            <span className="text-slate-900 dark:text-white">Total</span>
            <span className="text-slate-900 dark:text-white">{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between gap-4 text-sm text-emerald-700 dark:text-emerald-400">
            <span>Paid</span><span className="font-semibold">{formatINR(paid)}</span>
          </div>
          <div className="flex justify-between gap-4 text-sm text-rose-700 dark:text-rose-400">
            <span>Outstanding</span><span className="font-semibold">{formatINR(outstanding)}</span>
          </div>
          <div className="flex justify-between items-center gap-4 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Payment Status</span>
            <Badge tone={paymentStatus === 'Paid' ? 'positive' : paymentStatus === 'Partial' ? 'warning' : 'negative'}>{paymentStatus}</Badge>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : editInvoice ? 'Update Invoice' : 'Create Invoice'}</Button>
        </div>
      </div>
    </Modal>
  );
}
  