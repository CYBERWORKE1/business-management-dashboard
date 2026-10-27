import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Search, Eye, Truck, Trash2 } from 'lucide-react';
import { useData } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';
import type { Supplier } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, Label, LoadingState, Modal, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

export function SuppliersPage() {
  const data = useData();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRole(userId?: string) {
      if (!userId) {
        if (active) setIsAdmin(false);
        return;
      }

      const { data: roleData, error } = await supabase
        .from('app_user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!active) return;
      setIsAdmin(!error && roleData?.role === 'admin');
    }

    supabase.auth.getUser().then(({ data: { user } }) => loadRole(user?.id));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadRole(session?.user.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const supplierStats = useMemo(() => {
    const stats = new Map<string, { totalPurchases: number; paid: number; outstanding: number }>();
    for (const s of data.suppliers) {
      stats.set(s.id, { totalPurchases: 0, paid: 0, outstanding: 0 });
    }
    for (const p of data.purchases) {
      const st = stats.get(p.supplier_id);
      if (!st) continue;
      st.totalPurchases += p.subtotal;
      st.paid += p.amount_paid;
      st.outstanding += p.outstanding;
    }
    return stats;
  }, [data.suppliers, data.purchases]);

  const filtered = useMemo(() => {
    return data.suppliers.filter((s) => {
      const matchSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.supplier_code.toLowerCase().includes(search.toLowerCase()) ||
        (s.city ?? '').toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [data.suppliers, search]);

  function supplierPurchases(supplierId: string) {
    return data.purchases.filter((p) => p.supplier_id === supplierId);
  }
  function supplierPayments(supplierId: string) {
    return data.payments.filter((p) => p.party_type === 'supplier' && p.party_id === supplierId);
  }

  async function deleteSupplier(supplier: Supplier) {
    if (!isAdmin) return;
    if (!window.confirm(`Delete supplier ${supplier.name}? This is allowed only when there is no purchase or payment history.`)) return;
    try {
      const { data: linkedPurchases, error: purchaseError } = await supabase.from('purchases').select('id').eq('supplier_id', supplier.id).limit(1);
      if (purchaseError) throw purchaseError;
      const { data: linkedPayments, error: paymentError } = await supabase.from('payments').select('id').eq('party_type', 'supplier').eq('party_id', supplier.id).limit(1);
      if (paymentError) throw paymentError;
      if ((linkedPurchases?.length ?? 0) > 0 || (linkedPayments?.length ?? 0) > 0) {
        window.alert('This supplier has purchase or payment history. To protect financial records, deletion is blocked. Keep the supplier record for historical reporting.');
        return;
      }
      const { error } = await supabase.from('suppliers').delete().eq('id', supplier.id);
      if (error) throw error;
      await data.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? `Could not delete supplier: ${err.message}` : 'Could not delete supplier. Check permissions and linked records.');
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Suppliers"
        subtitle="Supplier master data and ledgers"
        actions={isAdmin ? <Button onClick={() => { setEditSupplier(null); setShowForm(true); }}><Plus size={18} /> Add Supplier</Button> : undefined}
      />

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by name, code, or city..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        {data.loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message="No suppliers found" icon={<Truck size={32} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 font-medium">Code</th>
                  <th className="py-3 font-medium">Name</th>
                  <th className="py-3 font-medium">City</th>
                  <th className="py-3 font-medium">Products Supplied</th>
                  <th className="py-3 font-medium">Payment Terms</th>
                  <th className="py-3 text-right font-medium">Total Purchases</th>
                  <th className="py-3 text-right font-medium">Paid</th>
                  <th className="py-3 text-right font-medium">Outstanding</th>
                  <th className="py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const st = supplierStats.get(s.id);
                  return (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="py-3 font-medium text-brand-700">{s.supplier_code}</td>
                      <td className="py-3 text-slate-800 dark:text-slate-200">{s.name}</td>
                      <td className="py-3 text-slate-700 dark:text-slate-300">{s.city ?? '-'}</td>
                      <td className="py-3 text-slate-700 dark:text-slate-300">{s.products_supplied ?? '-'}</td>
                      <td className="py-3"><Badge tone="info">{s.payment_terms ?? '-'}</Badge></td>
                      <td className="py-3 text-right text-slate-800 dark:text-slate-200">{formatINR(st?.totalPurchases ?? 0)}</td>
                      <td className="py-3 text-right text-emerald-600">{formatINR(st?.paid ?? 0)}</td>
                      <td className="py-3 text-right text-amber-600 font-medium">{formatINR(st?.outstanding ?? 0)}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewSupplier(s)} className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded"><Eye size={16} /></button>
                          {isAdmin && <button onClick={() => { setEditSupplier(s); setShowForm(true); }} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 rounded" aria-label={`Edit ${s.name}`}><Edit size={16} /></button>}
                          {isAdmin && <button onClick={() => void deleteSupplier(s)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded" aria-label={`Delete ${s.name}`} title="Delete only if no purchase/payment history"><Trash2 size={16} /></button>}
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

      {showForm && isAdmin && (
        <SupplierForm editSupplier={editSupplier} onClose={() => { setShowForm(false); setEditSupplier(null); }} onSaved={() => data.refresh()} />
      )}

      {viewSupplier && (
        <Modal open={true} onClose={() => setViewSupplier(null)} title={`${viewSupplier.name} (${viewSupplier.supplier_code})`} size="xl">
          <SupplierLedger supplier={viewSupplier}
            purchases={supplierPurchases(viewSupplier.id)}
            payments={supplierPayments(viewSupplier.id)}
            stats={supplierStats.get(viewSupplier.id)}
          />
        </Modal>
      )}
    </PageContainer>
  );
}

function SupplierLedger({ supplier, purchases, payments, stats }: {
  supplier: Supplier;
  purchases: { id: string; invoice_no: string; invoice_date: string; total_amount: number; amount_paid: number; outstanding: number; due_date: string | null }[];
  payments: { id: string; payment_date: string; amount: number; payment_method: string | null; notes: string | null }[];
  stats?: { totalPurchases: number; paid: number; outstanding: number };
}) {
  const [tab, setTab] = useState<'purchases' | 'payments'>('purchases');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">Total Purchases</p>
          <p className="font-bold text-slate-900 dark:text-slate-100">{formatINR(stats?.totalPurchases ?? 0)}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">Paid</p>
          <p className="font-bold text-emerald-600">{formatINR(stats?.paid ?? 0)}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">Outstanding</p>
          <p className="font-bold text-amber-600">{formatINR(stats?.outstanding ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-slate-600 dark:text-slate-400">Contact</p><p>{supplier.contact_person ?? '-'}</p></div>
        <div><p className="text-xs text-slate-600 dark:text-slate-400">Phone</p><p>{supplier.phone ?? '-'}</p></div>
        <div><p className="text-xs text-slate-600 dark:text-slate-400">Payment Terms</p><p>{supplier.payment_terms ?? '-'}</p></div>
        <div><p className="text-xs text-slate-600 dark:text-slate-400">Products Supplied</p><p>{supplier.products_supplied ?? '-'}</p></div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button onClick={() => setTab('purchases')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'purchases' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 dark:text-slate-400'}`}>Purchases ({purchases.length})</button>
        <button onClick={() => setTab('payments')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'payments' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 dark:text-slate-400'}`}>Payments ({payments.length})</button>
      </div>

      {tab === 'purchases' ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 font-medium">Invoice</th><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Due</th>
            <th className="py-2 text-right font-medium">Total</th><th className="py-2 text-right font-medium">Paid</th>
            <th className="py-2 text-right font-medium">Balance</th>
          </tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-2 text-brand-700 font-medium">{p.invoice_no}</td>
                <td className="py-2 text-slate-700 dark:text-slate-300">{p.invoice_date}</td>
                <td className="py-2 text-slate-700 dark:text-slate-300">{p.due_date ?? '-'}</td>
                <td className="py-2 text-right">{formatINR(p.total_amount)}</td>
                <td className="py-2 text-right text-emerald-600">{formatINR(p.amount_paid)}</td>
                <td className="py-2 text-right text-rose-600">{formatINR(p.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 font-medium">Date</th><th className="py-2 text-right font-medium">Amount</th>
            <th className="py-2 font-medium">Method</th><th className="py-2 font-medium">Notes</th>
          </tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-2 text-slate-700 dark:text-slate-300">{p.payment_date}</td>
                <td className="py-2 text-right text-emerald-600 font-medium">{formatINR(p.amount)}</td>
                <td className="py-2 text-slate-700 dark:text-slate-300">{p.payment_method ?? '-'}</td>
                <td className="py-2 text-slate-700 dark:text-slate-300">{p.notes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SupplierForm({ editSupplier, onClose, onSaved }: {
  editSupplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    supplier_code: editSupplier?.supplier_code ?? '',
    name: editSupplier?.name ?? '',
    contact_person: editSupplier?.contact_person ?? '',
    phone: editSupplier?.phone ?? '',
    city: editSupplier?.city ?? '',
    products_supplied: editSupplier?.products_supplied ?? '',
    payment_terms: editSupplier?.payment_terms ?? '30 days',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    if (!form.supplier_code.trim() || !form.name.trim()) { setError('Supplier code and name are required'); return; }
    setSaving(true);
    try {
      const payload = {
        supplier_code: form.supplier_code,
        name: form.name,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        city: form.city || null,
        products_supplied: form.products_supplied || null,
        payment_terms: form.payment_terms || null,
      };
      if (editSupplier) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', editSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('suppliers').insert(payload);
        if (error) throw error;
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={editSupplier ? 'Edit Supplier' : 'Add Supplier'}>
      <div className="space-y-4">
        {error && <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Supplier Code</Label><Input value={form.supplier_code} onChange={(e) => setForm({ ...form, supplier_code: e.target.value })} /></div>
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label>Payment Terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
          <div className="col-span-2"><Label>Products Supplied</Label><Input value={form.products_supplied} onChange={(e) => setForm({ ...form, products_supplied: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Supplier'}</Button>
        </div>
      </div>
    </Modal>
  );
}
