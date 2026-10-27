import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Search, Eye, Users, UserRoundX, UserRoundCheck } from 'lucide-react';
import { useData } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';
import { daysOverdue, ageingBucket } from '@/lib/calculations';
import type { Customer } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, Label, LoadingState, Modal, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

const BUSINESS_TYPES = ['Retailer', 'Dealer', 'Contractor', 'Wholesaler', 'Manufacturer'];

export function CustomersPage() {
  const data = useData();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [actionError, setActionError] = useState('');
  const [updatingCustomerId, setUpdatingCustomerId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRole(userId: string | null) {
      if (!userId) {
        if (active) setIsAdmin(false);
        return;
      }

      const { data: roleRecord, error } = await supabase
        .from('app_user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (active) setIsAdmin(!error && roleRecord?.role === 'admin');
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      void loadRole(user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadRole(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const customerStats = useMemo(() => {
    const stats = new Map<string, { totalSales: number; received: number; outstanding: number; overdue: number }>();
    for (const c of data.customers) {
      stats.set(c.id, { totalSales: 0, received: 0, outstanding: 0, overdue: 0 });
    }
    for (const s of data.salesInvoices) {
      const st = stats.get(s.customer_id);
      if (!st) continue;
      st.totalSales += s.subtotal - s.discount_amount;
      st.received += s.amount_paid;
      st.outstanding += s.outstanding;
      if (s.outstanding > 0 && daysOverdue(s.due_date) > 0) {
        st.overdue += s.outstanding;
      }
    }
    return stats;
  }, [data.customers, data.salesInvoices]);

  const filtered = useMemo(() => {
    return data.customers.filter((c) => {
      const isActive = (c as Customer & { is_active?: boolean }).is_active !== false;
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? isActive : !isActive);
      if (!matchStatus) return false;
      const matchSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.customer_code.toLowerCase().includes(search.toLowerCase()) ||
        (c.city ?? '').toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [data.customers, search, statusFilter]);

  function customerInvoices(customerId: string) {
    return data.salesInvoices.filter((s) => s.customer_id === customerId);
  }
  function customerPayments(customerId: string) {
    return data.payments.filter((p) => p.party_type === 'customer' && p.party_id === customerId);
  }

  async function toggleCustomerStatus(customer: Customer) {
    if (!isAdmin || updatingCustomerId) return;
    const currentlyActive = (customer as Customer & { is_active?: boolean }).is_active !== false;
    const nextActive = !currentlyActive;
    const stats = customerStats.get(customer.id);
    const outstanding = stats?.outstanding ?? 0;
    const message = nextActive
      ? `Reactivate ${customer.name}? They will be available for new sales invoices again.`
      : `Deactivate ${customer.name}? They will be excluded from new sales invoices. Existing invoices, payments and outstanding balance (${formatINR(outstanding)}) will be preserved.`;
    if (!window.confirm(message)) return;

    setUpdatingCustomerId(customer.id);
    setActionError('');
    try {
      const { error } = await supabase.from('customers')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', customer.id);
      if (error) throw error;
      await data.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update customer status.');
    } finally {
      setUpdatingCustomerId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        subtitle="Customer master data and ledgers"
        actions={isAdmin ? <Button onClick={() => { setEditCustomer(null); setShowForm(true); }}><Plus size={18} /> Add Customer</Button> : undefined}
      />

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by name, code, or city..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="max-w-xs">
          <option value="active">Active customers</option>
          <option value="inactive">Inactive customers</option>
          <option value="all">All customers</option>
        </Select>
      </div>

      {actionError && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{actionError}</div>}

      <Card>
        {data.loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message="No customers found" icon={<Users size={32} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 font-medium">Code</th>
                  <th className="py-3 font-medium">Name</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 font-medium">City</th>
                  <th className="py-3 font-medium">Type</th>
                  <th className="py-3 text-right font-medium">Credit Limit</th>
                  <th className="py-3 text-right font-medium">Total Sales</th>
                  <th className="py-3 text-right font-medium">Received</th>
                  <th className="py-3 text-right font-medium">Outstanding</th>
                  <th className="py-3 text-right font-medium">Overdue</th>
                  <th className="py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const st = customerStats.get(c.id);
                  const overLimit = st && st.outstanding > c.credit_limit;
                  return (
                    <tr key={c.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="py-3 font-medium text-brand-700">{c.customer_code}</td>
                      <td className="py-3 text-slate-700 dark:text-slate-200">{c.name}</td>
                      <td className="py-3">{(c as Customer & { is_active?: boolean }).is_active === false ? <Badge tone="info">Inactive</Badge> : <Badge tone="positive">Active</Badge>}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{c.city ?? '-'}</td>
                      <td className="py-3"><Badge tone="info">{c.business_type ?? '-'}</Badge></td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-400">{formatINR(c.credit_limit)}</td>
                      <td className="py-3 text-right text-slate-700 dark:text-slate-200">{formatINR(st?.totalSales ?? 0)}</td>
                      <td className="py-3 text-right text-emerald-600">{formatINR(st?.received ?? 0)}</td>
                      <td className={`py-3 text-right font-medium ${overLimit ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600'}`}>
                        {formatINR(st?.outstanding ?? 0)}
                      </td>
                      <td className="py-3 text-right text-rose-600 dark:text-rose-400">{formatINR(st?.overdue ?? 0)}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewCustomer(c)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-700 rounded"><Eye size={16} /></button>
                          {isAdmin && <button onClick={() => { setEditCustomer(c); setShowForm(true); }} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 rounded" aria-label={`Edit ${c.name}`} title="Edit customer"><Edit size={16} /></button>}
                          {isAdmin && <button onClick={() => void toggleCustomerStatus(c)} disabled={updatingCustomerId === c.id} className={`p-1.5 rounded disabled:opacity-50 ${(c as Customer & { is_active?: boolean }).is_active === false ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700' : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700'}`} aria-label={`${(c as Customer & { is_active?: boolean }).is_active === false ? 'Reactivate' : 'Deactivate'} ${c.name}`} title={(c as Customer & { is_active?: boolean }).is_active === false ? 'Reactivate customer' : 'Deactivate customer'}>{(c as Customer & { is_active?: boolean }).is_active === false ? <UserRoundCheck size={16} /> : <UserRoundX size={16} />}</button>}
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

      {isAdmin && showForm && (
        <CustomerForm editCustomer={editCustomer} onClose={() => { setShowForm(false); setEditCustomer(null); }} onSaved={() => data.refresh()} />
      )}

      {viewCustomer && (
        <Modal open={true} onClose={() => setViewCustomer(null)} title={`${viewCustomer.name} (${viewCustomer.customer_code})`} size="xl">
          <CustomerLedger customer={viewCustomer}
            invoices={customerInvoices(viewCustomer.id)}
            payments={customerPayments(viewCustomer.id)}
            stats={customerStats.get(viewCustomer.id)}
          />
        </Modal>
      )}
    </PageContainer>
  );
}

function CustomerLedger({ customer, invoices, payments, stats }: {
  customer: Customer;
  invoices: { id: string; invoice_no: string; invoice_date: string; total_amount: number; amount_paid: number; outstanding: number; payment_status: string; due_date: string | null }[];
  payments: { id: string; payment_date: string; amount: number; payment_method: string | null; notes: string | null }[];
  stats?: { totalSales: number; received: number; outstanding: number; overdue: number };
}) {
  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Sales</p>
          <p className="font-bold text-slate-800 dark:text-slate-100">{formatINR(stats?.totalSales ?? 0)}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Received</p>
          <p className="font-bold text-emerald-600">{formatINR(stats?.received ?? 0)}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding</p>
          <p className="font-bold text-amber-600">{formatINR(stats?.outstanding ?? 0)}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Overdue</p>
          <p className="font-bold text-rose-600 dark:text-rose-400">{formatINR(stats?.overdue ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-slate-500 dark:text-slate-400">Phone</p><p>{customer.phone ?? '-'}</p></div>
        <div><p className="text-xs text-slate-500 dark:text-slate-400">City</p><p>{customer.city ?? '-'}</p></div>
        <div><p className="text-xs text-slate-500 dark:text-slate-400">Business Type</p><p>{customer.business_type ?? '-'}</p></div>
        <div><p className="text-xs text-slate-500 dark:text-slate-400">Credit Limit</p><p>{formatINR(customer.credit_limit)}</p></div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button onClick={() => setTab('invoices')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'invoices' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>Invoices ({invoices.length})</button>
        <button onClick={() => setTab('payments')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'payments' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>Payments ({payments.length})</button>
      </div>

      {tab === 'invoices' ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 font-medium">Invoice</th><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Due</th>
            <th className="py-2 text-right font-medium">Total</th><th className="py-2 text-right font-medium">Paid</th>
            <th className="py-2 text-right font-medium">Balance</th><th className="py-2 text-center font-medium">Status</th>
          </tr></thead>
          <tbody>
            {invoices.map((inv) => {
              const days = daysOverdue(inv.due_date);
              return (
                <tr key={inv.id} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-2 text-brand-700 font-medium">{inv.invoice_no}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-400">{inv.invoice_date}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-400">{inv.due_date ?? '-'}</td>
                  <td className="py-2 text-right">{formatINR(inv.total_amount)}</td>
                  <td className="py-2 text-right text-emerald-600">{formatINR(inv.amount_paid)}</td>
                  <td className="py-2 text-right text-rose-600 dark:text-rose-400">{formatINR(inv.outstanding)}</td>
                  <td className="py-2 text-center">
                    {inv.outstanding > 0 && days > 0 ? <Badge tone="negative">{ageingBucket(days)}</Badge> :
                     <Badge tone={inv.payment_status === 'Paid' ? 'positive' : 'warning'}>{inv.payment_status}</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 font-medium">Date</th><th className="py-2 text-right font-medium">Amount</th>
            <th className="py-2 font-medium">Method</th><th className="py-2 font-medium">Notes</th>
          </tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-200 dark:border-slate-700">
                <td className="py-2 text-slate-600 dark:text-slate-400">{p.payment_date}</td>
                <td className="py-2 text-right text-emerald-600 font-medium">{formatINR(p.amount)}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{p.payment_method ?? '-'}</td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{p.notes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CustomerForm({ editCustomer, onClose, onSaved }: {
  editCustomer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customer_code: editCustomer?.customer_code ?? '',
    name: editCustomer?.name ?? '',
    phone: editCustomer?.phone ?? '',
    city: editCustomer?.city ?? '',
    business_type: editCustomer?.business_type ?? 'Retailer',
    credit_limit: editCustomer?.credit_limit.toString() ?? '0',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    if (!form.customer_code.trim() || !form.name.trim()) { setError('Customer code and name are required'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_code: form.customer_code,
        name: form.name,
        phone: form.phone || null,
        city: form.city || null,
        business_type: form.business_type,
        credit_limit: parseFloat(form.credit_limit) || 0,
        ...(!editCustomer ? { is_active: true } : {}),
      };
      if (editCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert(payload);
        if (error) throw error;
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={editCustomer ? 'Edit Customer' : 'Add Customer'}>
      <div className="space-y-4">
        {error && <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Customer Code</Label><Input value={form.customer_code} onChange={(e) => setForm({ ...form, customer_code: e.target.value })} /></div>
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label>Business Type</Label><Select value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })}>{BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></div>
          <div><Label>Credit Limit (₹)</Label><Input type="number" min="0" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Customer'}</Button>
        </div>
      </div>
    </Modal>
  );
}
