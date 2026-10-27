import { useEffect, useMemo, useState } from 'react';
import { Plus, Eye, Edit, Receipt, Wallet } from 'lucide-react';
import { useData } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatDate, formatINR, formatNumber } from '@/lib/format';
import type { Purchase, PurchaseItem } from '@/lib/types';
import { Button, Card, EmptyState, Input, Label, LoadingState, Modal, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

export function PurchasesPage() {
  const data = useData();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [canManage, setCanManage] = useState(false);

  // Fail closed: users have no write controls unless their role is confirmed as admin.
  useEffect(() => {
    let active = true;

    async function loadRole() {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        if (active) setCanManage(false);
        return;
      }

      const { data: roleRow, error: roleError } = await supabase
        .from('app_user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (active) setCanManage(!roleError && roleRow?.role === 'admin');
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, []);

  const supplierMap = useMemo(() => new Map(data.suppliers.map((s) => [s.id, s])), [data.suppliers]);
  const productMap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const filtered = useMemo(() => {
    return data.purchases.filter((p) => {
      const supplier = supplierMap.get(p.supplier_id);
      const matchSearch = !search ||
        p.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
        supplier?.name.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [data.purchases, search, supplierMap]);

  const itemsForPurchase = (purchaseId: string): PurchaseItem[] =>
    data.purchaseItems.filter((i) => i.purchase_id === purchaseId);

  // Purchase invoices are financial and stock history. This screen intentionally
  // does not hard-delete them; use a correction/adjustment workflow instead.

  const today = new Date().toISOString().slice(0, 10);
  const totalPurchaseValue = data.purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const totalOutstanding = data.purchases.reduce((sum, p) => sum + Math.max(0, Number(p.outstanding || 0)), 0);


  return (
    <PageContainer>
      <PageHeader
        title="Purchase Management"
        subtitle="Track supplier purchases and supplier dues"
        actions={canManage ? <Button onClick={() => { setEditPurchase(null); setShowCreate(true); }}><Plus size={18} /> New Purchase</Button> : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Card><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500 dark:text-zinc-400">Purchase value</p><p className="text-xl font-bold mt-1">{formatINR(totalPurchaseValue)}</p><p className="text-xs text-slate-500 mt-1">All recorded invoices</p></div><Receipt className="text-brand-600" size={21}/></div></Card>
        <Card><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500 dark:text-zinc-400">Supplier outstanding</p><p className="text-xl font-bold mt-1">{formatINR(totalOutstanding)}</p><p className="text-xs text-slate-500 mt-1">Across all purchase invoices</p></div><Wallet className="text-amber-600" size={21}/></div></Card>
      </div>



      <div className="mb-4">
        <Input placeholder="Search by invoice number or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <Card>
        {data.loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message="No purchase invoices found" icon={<Receipt size={32} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:text-zinc-400 dark:border-zinc-700">
                  <th className="py-3 font-medium">Invoice No</th>
                  <th className="py-3 font-medium">Date</th>
                  <th className="py-3 font-medium">Supplier</th>
                  <th className="py-3 font-medium">Due Date</th>
                  <th className="py-3 text-right font-medium">Total</th>
                  <th className="py-3 text-right font-medium">Paid</th>
                  <th className="py-3 text-right font-medium">Outstanding</th>
                  <th className="py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const supplier = supplierMap.get(p.supplier_id);
                  return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800/70">
                      <td className="py-3 font-medium text-brand-700 dark:text-blue-300">{p.invoice_no}</td>
                      <td className="py-3 text-slate-600 dark:text-zinc-300">{formatDate(p.invoice_date)}</td>
                      <td className="py-3 text-slate-700 dark:text-zinc-200">{supplier?.name ?? '-'}</td>
                      <td className="py-3 text-slate-600 dark:text-zinc-300">{formatDate(p.due_date)}</td>
                      <td className="py-3 text-right text-slate-700 dark:text-zinc-200">{formatINR(p.total_amount)}</td>
                      <td className="py-3 text-right text-emerald-600">{formatINR(p.amount_paid)}</td>
                      <td className="py-3 text-right text-rose-600">{formatINR(p.outstanding)}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button aria-label={`View purchase ${p.invoice_no}`} onClick={() => setViewPurchase(p)} className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded dark:text-zinc-300 dark:hover:bg-zinc-700"><Eye size={16} /></button>
                          {canManage && <>
                            <button aria-label={`Edit purchase ${p.invoice_no}`} onClick={() => { setEditPurchase(p); setShowCreate(true); }} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded dark:text-zinc-300 dark:hover:bg-zinc-700"><Edit size={16} /></button>
                          </>}
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

      {viewPurchase && (
        <Modal open={true} onClose={() => setViewPurchase(null)} title={`Purchase ${viewPurchase.invoice_no}`} size="lg">
          <PurchaseView purchase={viewPurchase} items={itemsForPurchase(viewPurchase.id)}
            supplierName={supplierMap.get(viewPurchase.supplier_id)?.name ?? '-'} products={data.products} />
        </Modal>
      )}

      {canManage && showCreate && (
        <PurchaseForm editPurchase={editPurchase} onClose={() => { setShowCreate(false); setEditPurchase(null); }} onSaved={() => data.refresh()} />
      )}
    </PageContainer>
  );
}

function PurchaseView({ purchase, items, supplierName, products }: {
  purchase: Purchase;
  items: PurchaseItem[];
  supplierName: string;
  products: { id: string; name: string; sku: string }[];
}) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-xs text-slate-500">Supplier</p><p className="font-medium text-slate-800 dark:text-zinc-100">{supplierName}</p></div>
        <div><p className="text-xs text-slate-500">Date</p><p className="font-medium text-slate-800 dark:text-zinc-100">{formatDate(purchase.invoice_date)}</p></div>
        <div><p className="text-xs text-slate-500">Due Date</p><p className="font-medium text-slate-800 dark:text-zinc-100">{formatDate(purchase.due_date)}</p></div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-500 border-b border-slate-100 dark:text-zinc-400 dark:border-zinc-700">
          <th className="py-2 font-medium">SKU</th><th className="py-2 font-medium">Product</th>
          <th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Unit Cost</th>
          <th className="py-2 text-right font-medium">Total</th>
        </tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100 dark:border-zinc-700">
              <td className="py-2 text-brand-700 dark:text-blue-300 font-medium">{item.sku}</td>
              <td className="py-2 text-slate-700 dark:text-zinc-200">{productMap.get(item.product_id)?.name ?? item.description}</td>
              <td className="py-2 text-right text-slate-600 dark:text-zinc-300">{formatNumber(item.quantity)} {item.unit}</td>
              <td className="py-2 text-right text-slate-600 dark:text-zinc-300">{formatINR(item.unit_cost)}</td>
              <td className="py-2 text-right text-slate-700 dark:text-zinc-200 font-medium">{formatINR(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto w-full max-w-xs space-y-1">
        <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>{formatINR(purchase.subtotal)}</span></div>
        <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Total</span><span>{formatINR(purchase.total_amount)}</span></div>
        <div className="flex justify-between text-sm text-emerald-600"><span>Paid</span><span>{formatINR(purchase.amount_paid)}</span></div>
        <div className="flex justify-between text-sm text-rose-600"><span>Outstanding</span><span>{formatINR(purchase.outstanding)}</span></div>
      </div>
    </div>
  );
}

type LineItem = { product_id: string; quantity: number; unit_cost: number };

function PurchaseForm({ editPurchase, onClose, onSaved }: {
  editPurchase: Purchase | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const data = useData();
  const [invoiceNo, setInvoiceNo] = useState(editPurchase?.invoice_no ?? '');
  const [invoiceDate, setInvoiceDate] = useState(editPurchase?.invoice_date ?? new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState(editPurchase?.supplier_id ?? '');
  const [dueDate, setDueDate] = useState(editPurchase?.due_date ?? '');
  const [amountPaid, setAmountPaid] = useState(editPurchase?.amount_paid.toString() ?? '0');
  const [lines, setLines] = useState<LineItem[]>([{ product_id: '', quantity: 1, unit_cost: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const productMap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  function updateLine(idx: number, field: keyof LineItem, value: string | number) {
    setLines(lines.map((line, i) => {
      if (i !== idx) return line;
      const updated = { ...line, [field]: value };
      if (field === 'product_id') {
        const p = productMap.get(value as string);
        if (p) updated.unit_cost = p.purchase_cost;
      }
      return updated;
    }));
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
  const paid = parseFloat(amountPaid) || 0;
  const outstanding = subtotal - paid;

  async function save() {
    setError('');
    if (!invoiceNo.trim()) { setError('Invoice number required'); return; }
    if (!supplierId) { setError('Supplier required'); return; }
    if (lines.some((l) => !l.product_id || l.quantity <= 0)) { setError('All line items must have a product and quantity > 0'); return; }
    setSaving(true);
    try {
      if (!editPurchase) {
        const existing = await supabase.from('purchases').select('id').eq('invoice_no', invoiceNo).maybeSingle();
        if (existing.data) { setError('Invoice number already exists'); setSaving(false); return; }
      }

      let purchaseId = editPurchase?.id;
      if (editPurchase) {
        // Do not rewrite a purchase once linked payments or stock movements exist.
        // The old flow deleted those records, which could silently erase financial history.
        const { data: linkedPayments, error: paymentCheckError } = await supabase.from('payments').select('id').eq('invoice_id', editPurchase.id).limit(1);
        if (paymentCheckError) throw paymentCheckError;
        const { data: linkedMovements, error: movementCheckError } = await supabase.from('stock_movements').select('id').eq('reference_id', editPurchase.invoice_no).limit(1);
        if (movementCheckError) throw movementCheckError;
        if ((linkedPayments?.length ?? 0) > 0 || (linkedMovements?.length ?? 0) > 0) {
          setError('This purchase has linked payment or stock history and cannot be edited safely. Keep the original record and create a correction/adjustment instead.');
          return;
        }
        // Restore stock for old items
        const oldItems = data.purchaseItems.filter((i) => i.purchase_id === editPurchase.id);
        for (const item of oldItems) {
          const p = productMap.get(item.product_id);
          if (p) {
            await supabase.from('products').update({ stock_qty: p.stock_qty - item.quantity, purchase_cost: p.purchase_cost }).eq('id', p.id);
          }
        }
        await supabase.from('purchase_items').delete().eq('purchase_id', editPurchase.id);
        await supabase.from('payments').delete().eq('invoice_id', editPurchase.id);
        await supabase.from('stock_movements').delete().eq('reference_id', editPurchase.invoice_no);
        await supabase.from('purchases').update({
          invoice_no: invoiceNo, invoice_date: invoiceDate, supplier_id: supplierId,
          subtotal, discount_amount: 0, gst_amount: 0, total_amount: subtotal,
          amount_paid: paid, outstanding, due_date: dueDate || null,
        }).eq('id', editPurchase.id);
      } else {
        const { data: newPur, error: err } = await supabase.from('purchases').insert({
          invoice_no: invoiceNo, invoice_date: invoiceDate, supplier_id: supplierId,
          subtotal, discount_amount: 0, gst_amount: 0, total_amount: subtotal,
          amount_paid: paid, outstanding, due_date: dueDate || null, status: 'confirmed',
        }).select().single();
        if (err) throw err;
        purchaseId = newPur.id;
      }

      for (const line of lines) {
        const product = productMap.get(line.product_id);
        if (!product) continue;
        await supabase.from('purchase_items').insert({
          purchase_id: purchaseId, product_id: line.product_id, sku: product.sku,
          description: product.name, quantity: line.quantity, unit: product.unit,
          unit_cost: line.unit_cost, line_total: line.quantity * line.unit_cost,
        });
        const newStock = product.stock_qty + line.quantity;
        await supabase.from('products').update({ stock_qty: newStock, purchase_cost: line.unit_cost }).eq('id', line.product_id);
        await supabase.from('stock_movements').insert({
          product_id: line.product_id, movement_date: invoiceDate,
          movement_type: 'purchase_in', quantity: line.quantity, balance_after: newStock,
          reference_type: 'purchase', reference_id: invoiceNo, notes: `Purchase ${invoiceNo}`,
        });
      }

      if (paid > 0) {
        await supabase.from('payments').insert({
          payment_date: invoiceDate, party_type: 'supplier', party_id: supplierId,
          invoice_id: purchaseId, amount: paid, payment_method: 'Bank Transfer',
          notes: `Payment for ${invoiceNo}`,
        });
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save purchase');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={editPurchase ? `Edit ${editPurchase.invoice_no}` : 'New Purchase Invoice'} size="xl">
      <div className="space-y-4">
        {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">{error}</div>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><Label>Invoice No</Label><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="PUR-XXX" /></div>
          <div><Label>Date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
          <div><Label>Supplier</Label><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier...</option>
            {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select></div>
          <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Line Items</Label>
            <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { product_id: '', quantity: 1, unit_cost: 0 }])}><Plus size={14} /> Add Line</Button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b border-slate-100 dark:text-zinc-400 dark:border-zinc-700">
              <th className="py-2 font-medium">Product</th><th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit Cost</th><th className="py-2 text-right font-medium">Total</th><th></th>
            </tr></thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b border-slate-100 dark:border-zinc-700">
                  <td className="py-2"><Select value={line.product_id} onChange={(e) => updateLine(idx, 'product_id', e.target.value)} className="min-w-[200px]">
                    <option value="">Select product...</option>
                    {data.products.map((p) => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                  </Select></td>
                  <td className="py-2 w-24"><Input type="number" min="0" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)} className="text-right" /></td>
                  <td className="py-2 w-28"><Input type="number" min="0" step="0.01" value={line.unit_cost} onChange={(e) => updateLine(idx, 'unit_cost', parseFloat(e.target.value) || 0)} className="text-right" /></td>
                  <td className="py-2 text-right font-medium text-slate-700 dark:text-zinc-200">{formatINR(line.quantity * line.unit_cost)}</td>
                  <td className="py-2">{lines.length > 1 && <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-rose-500"><X size={16} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Amount Paid (₹)</Label><Input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} /></div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 space-y-1 dark:bg-zinc-800">
          <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{formatINR(subtotal)}</span></div>
          <div className="flex justify-between text-sm text-emerald-600"><span>Paid</span><span>{formatINR(paid)}</span></div>
          <div className="flex justify-between text-sm text-rose-600"><span>Outstanding</span><span>{formatINR(outstanding)}</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : editPurchase ? 'Update Purchase' : 'Create Purchase'}</Button>
        </div>
      </div>
    </Modal>
  );
}
