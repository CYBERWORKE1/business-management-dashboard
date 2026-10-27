import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit, Trash2, UserRound, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, EmptyState, Input, Label, LoadingState, Modal, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

type Employee = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function checkRole() {
      setRoleLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (mounted) { setIsAdmin(false); setRoleLoading(false); }
        return;
      }
      const { data: row, error } = await supabase
        .from('app_user_roles').select('role').eq('user_id', auth.user.id).maybeSingle();
      if (mounted) {
        setIsAdmin(!error && row?.role === 'admin');
        setRoleLoading(false);
      }
    }
    void checkRole();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void checkRole(); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  async function loadEmployees() {
    setLoading(true);
    setPageError('');
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, role, phone, is_active, created_at, updated_at')
      .order('name', { ascending: true });
    if (error) setPageError(`Could not load employees: ${error.message}`);
    else setEmployees((data ?? []) as Employee[]);
    setLoading(false);
  }

  useEffect(() => { void loadEmployees(); }, []);

  async function deleteEmployee(employee: Employee) {
    const confirmed = window.confirm(
      `Permanently delete ${employee.name}? This removes the employee from the employee list. Existing invoice salesperson names are stored separately and will remain unchanged.`
    );
    if (!confirmed) return;

    setPageError('');
    const { error } = await supabase.from('employees').delete().eq('id', employee.id);
    if (error) {
      setPageError(`Could not delete ${employee.name}: ${error.message}`);
      return;
    }
    await loadEmployees();
  }

  const filtered = useMemo(() => employees.filter((employee) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || employee.name.toLowerCase().includes(q)
      || employee.role.toLowerCase().includes(q) || (employee.phone ?? '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' && employee.is_active)
      || (statusFilter === 'inactive' && !employee.is_active);
    return matchesSearch && matchesStatus;
  }), [employees, search, statusFilter]);

  const activeCount = employees.filter((employee) => employee.is_active).length;

  return (
    <PageContainer>
      <PageHeader
        title="Employees"
        subtitle="Manage your team and the names available in sales invoices"
        actions={isAdmin && !roleLoading ? (
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={18} /> Add Employee
          </Button>
        ) : undefined}
      />

      {!roleLoading && !isAdmin && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          Viewer access: employee records are read-only.
        </div>
      )}
      {pageError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {pageError}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><div className="flex items-center gap-3"><Users size={22} className="text-blue-600" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Total employees</p><p className="text-2xl font-bold">{employees.length}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><UserRound size={22} className="text-emerald-600" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Active</p><p className="text-2xl font-bold">{activeCount}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><UserRound size={22} className="text-slate-400" /><div><p className="text-sm text-slate-500 dark:text-slate-400">Inactive</p><p className="text-2xl font-bold">{employees.length - activeCount}</p></div></div></Card>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role or phone..." className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="max-w-xs">
          <option value="all">All employees</option><option value="active">Active only</option><option value="inactive">Inactive only</option>
        </Select>
      </div>

      <Card>
        {loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message="No employees found" icon={<Users size={32} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700 dark:text-slate-300">
                <th className="py-3 font-medium">Employee</th><th className="py-3 font-medium">Role / Designation</th><th className="py-3 font-medium">Phone</th><th className="py-3 text-center font-medium">Status</th>
                {isAdmin && !roleLoading && <th className="py-3 text-center font-medium">Actions</th>}
              </tr></thead>
              <tbody>{filtered.map((employee) => (
                <tr key={employee.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="py-3 font-medium">{employee.name}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">{employee.role || '—'}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">{employee.phone || '—'}</td>
                  <td className="py-3 text-center"><Badge tone={employee.is_active ? 'positive' : 'info'}>{employee.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  {isAdmin && !roleLoading && <td className="py-3 text-center"><div className="inline-flex items-center gap-1"><button onClick={() => { setEditing(employee); setShowForm(true); }} className="rounded p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-slate-700" title="Edit employee" aria-label={`Edit ${employee.name}`}><Edit size={16} /></button><button onClick={() => void deleteEmployee(employee)} className="rounded p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40" title="Delete employee" aria-label={`Delete ${employee.name}`}><Trash2 size={16} /></button></div></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      {isAdmin && !roleLoading && showForm && (
        <EmployeeForm employee={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={loadEmployees} />
      )}
    </PageContainer>
  );
}

function EmployeeForm({ employee, onClose, onSaved }: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(employee?.name ?? '');
  const [role, setRole] = useState(employee?.role ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [isActive, setIsActive] = useState(employee?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (!name.trim()) { setError('Employee name is required.'); return; }
    if (!role.trim()) { setError('Role / designation is required.'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), role: role.trim(), phone: phone.trim() || null, is_active: isActive, updated_at: new Date().toISOString() };
      const result = employee
        ? await supabase.from('employees').update(payload).eq('id', employee.id)
        : await supabase.from('employees').insert(payload);
      if (result.error) throw result.error;
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={employee ? 'Edit Employee' : 'Add Employee'} size="sm">
      <div className="space-y-4">
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
        <div><Label>Employee name *</Label><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></div>
        <div><Label>Role / designation *</Label><Input value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Sales Executive" /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" /></div>
        <div><Label>Status</Label><Select value={isActive ? 'active' : 'inactive'} onChange={(event) => setIsActive(event.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></Select></div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Inactive employees stay in your records and remain visible on older invoices, but are removed from the active salesperson choices.</p>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save Employee'}</Button></div>
      </div>
    </Modal>
  );
}
