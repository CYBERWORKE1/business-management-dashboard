
import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, Wallet, Search, ShieldAlert } from 'lucide-react';
import { useData } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatDate, formatINR } from '@/lib/format';
import type { Expense } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  LoadingState,
  Modal,
  Select,
} from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

const CATEGORIES = [
  'Transport',
  'Freight',
  'Salaries',
  'Rent',
  'Electricity',
  'Packaging',
  'Repairs',
  'Miscellaneous',
];

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

type AppRole = 'admin' | 'viewer';

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    const details =
      'details' in error && typeof error.details === 'string'
        ? error.details
        : '';

    const hint =
      'hint' in error && typeof error.hint === 'string'
        ? error.hint
        : '';

    return [error.message, details, hint].filter(Boolean).join(' ');
  }

  return 'An unexpected error occurred. Please try again.';
}

export function ExpensesPage() {
  const data = useData();

  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState('');

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  const [pageError, setPageError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Verify the current user's role directly with Supabase.
  // No write controls are shown until the role is verified as admin.
  useEffect(() => {
    let active = true;

    async function loadRole() {
      setRoleLoading(true);
      setRoleError('');
      setRole(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          throw new Error('You are not signed in. Please sign in again.');
        }

        const { data: roleData, error: roleQueryError } = await supabase
          .from('app_user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleQueryError) throw roleQueryError;

        if (roleData?.role !== 'admin' && roleData?.role !== 'viewer') {
          throw new Error(
            'Your account does not have an assigned Admin or Viewer role.'
          );
        }

        if (active) setRole(roleData.role);
      } catch (error) {
        if (active) {
          setRoleError(getErrorMessage(error));
        }
      } finally {
        if (active) setRoleLoading(false);
      }
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, []);

  const isAdmin = role === 'admin';

  const filtered = useMemo(() => {
    return data.expenses.filter((expense) => {
      const query = search.toLowerCase();

      const matchesSearch =
        !query ||
        (expense.description ?? '').toLowerCase().includes(query) ||
        (expense.vendor ?? '').toLowerCase().includes(query) ||
        (expense.expense_id ?? '').toLowerCase().includes(query);

      const matchesCategory =
        catFilter === 'all' || expense.category === catFilter;

      return matchesSearch && matchesCategory;
    });
  }, [data.expenses, search, catFilter]);

  const totalExpenses = filtered.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  const byCategory = useMemo(() => {
    const totals: Record<string, number> = {};

    for (const expense of data.expenses) {
      totals[expense.category] =
        (totals[expense.category] ?? 0) + expense.amount;
    }

    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [data.expenses]);

  async function deleteExpense(expense: Expense) {
    if (!isAdmin || deletingId) return;

    const confirmed = window.confirm(
      `Delete expense ${expense.expense_id}? This cannot be undone.`
    );

    if (!confirmed) return;

    setPageError('');
    setDeletingId(expense.id);

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id);

      if (error) throw error;

      await data.refresh();
    } catch (error) {
      setPageError(`Could not delete expense: ${getErrorMessage(error)}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaved() {
    await data.refresh();
  }

  return (
    <PageContainer>
      <PageHeader
        title="Expenses"
        subtitle="Record and track operating expenses"
        actions={
          isAdmin ? (
            <Button
              onClick={() => {
                setPageError('');
                setEditExpense(null);
                setShowForm(true);
              }}
            >
              <Plus size={18} />
              Add Expense
            </Button>
          ) : undefined
        }
      />

      {roleLoading && (
        <Card className="mb-4">
          <LoadingState message="Verifying account permissions..." />
        </Card>
      )}

      {!roleLoading && roleError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert size={20} className="shrink-0" />
            <div>
              <p className="font-semibold">Unable to verify permissions</p>
              <p className="mt-1">{roleError}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {!roleLoading && !roleError && role === 'viewer' && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          You are signed in as a Viewer. You can view expenses, but only an
          Admin can add, edit, or delete them.
        </div>
      )}

      {pageError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <p className="font-semibold">Expense operation failed</p>
          <p className="mt-1 break-words">{pageError}</p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => setPageError('')}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Total Expenses
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-zinc-100">
            {formatINR(totalExpenses, { compact: true })}
          </p>
        </Card>

        {byCategory.slice(0, 3).map(([category, amount]) => (
          <Card key={category}>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {category}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-zinc-100">
              {formatINR(amount, { compact: true })}
            </p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-xs flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={catFilter}
          onChange={(event) => setCatFilter(event.target.value)}
          className="max-w-xs"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {data.loading || roleLoading ? (
          <LoadingState />
        ) : data.error ? (
          <div role="alert" className="py-6 text-sm text-rose-600">
            Unable to load expenses: {data.error}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            message="No expenses found"
            icon={<Wallet size={32} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th className="py-3 pr-3 font-medium">ID</th>
                  <th className="py-3 pr-3 font-medium">Date</th>
                  <th className="py-3 pr-3 font-medium">Category</th>
                  <th className="py-3 pr-3 font-medium">Description</th>
                  <th className="py-3 pr-3 font-medium">Vendor</th>
                  <th className="py-3 pr-3 font-medium">Method</th>
                  <th className="py-3 text-right font-medium">Amount</th>
                  {isAdmin && (
                    <th className="py-3 pl-3 text-center font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filtered.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                  >
                    <td className="py-3 pr-3 font-medium text-blue-700 dark:text-blue-300">
                      {expense.expense_id ?? '-'}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-slate-600 dark:text-zinc-300">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone="info">{expense.category}</Badge>
                    </td>
                    <td className="py-3 pr-3 text-slate-700 dark:text-zinc-200">
                      {expense.description ?? '-'}
                    </td>
                    <td className="py-3 pr-3 text-slate-600 dark:text-zinc-300">
                      {expense.vendor ?? '-'}
                    </td>
                    <td className="py-3 pr-3 text-slate-600 dark:text-zinc-300">
                      {expense.payment_method ?? '-'}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right font-medium text-slate-700 dark:text-zinc-200">
                      {formatINR(expense.amount)}
                    </td>

                    {isAdmin && (
                      <td className="py-3 pl-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            aria-label={`Edit expense ${expense.expense_id}`}
                            title="Edit expense"
                            disabled={deletingId !== null}
                            onClick={() => {
                              setPageError('');
                              setEditExpense(expense);
                              setShowForm(true);
                            }}
                            className="rounded p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-amber-950"
                          >
                            <Edit size={16} />
                          </button>

                          <button
                            type="button"
                            aria-label={`Delete expense ${expense.expense_id}`}
                            title="Delete expense"
                            disabled={deletingId !== null}
                            onClick={() => void deleteExpense(expense)}
                            className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-rose-950"
                          >
                            {deletingId === expense.id ? (
                              <span className="text-xs">...</span>
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-zinc-600">
                  <td
                    colSpan={isAdmin ? 6 : 6}
                    className="py-3 pr-3 text-right font-semibold text-slate-700 dark:text-zinc-200"
                  >
                    Total:
                  </td>
                  <td className="py-3 text-right font-bold text-slate-800 dark:text-zinc-100">
                    {formatINR(totalExpenses)}
                  </td>
                  {isAdmin && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {showForm && isAdmin && (
        <ExpenseForm
          editExpense={editExpense}
          onClose={() => {
            setShowForm(false);
            setEditExpense(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </PageContainer>
  );
}

function ExpenseForm({
  editExpense,
  onClose,
  onSaved,
}: {
  editExpense: Expense | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    expense_id: editExpense?.expense_id ?? '',
    expense_date:
      editExpense?.expense_date ?? new Date().toISOString().slice(0, 10),
    category: editExpense?.category ?? 'Transport',
    description: editExpense?.description ?? '',
    vendor: editExpense?.vendor ?? '',
    amount: editExpense?.amount.toString() ?? '0',
    payment_method: editExpense?.payment_method ?? 'Cash',
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');

    const amount = Number(form.amount);

    if (!form.expense_date) {
      setError('Please select an expense date.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    setSaving(true);

    try {
      // Re-check the authenticated role before attempting the write.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Your session has expired. Please sign in again.');

      const { data: roleData, error: roleError } = await supabase
        .from('app_user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) throw roleError;
      if (roleData?.role !== 'admin') {
        throw new Error('Only an Admin can add or edit expenses.');
      }

      const payload = {
        expense_id: form.expense_id.trim() || null,
        expense_date: form.expense_date,
        category: form.category,
        description: form.description.trim() || null,
        vendor: form.vendor.trim() || null,
        amount,
        payment_method: form.payment_method,
      };

      if (editExpense) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editExpense.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('expenses')
          .insert(payload);

        if (insertError) throw insertError;
      }

      await onSaved();
      onClose();
    } catch (saveError) {
      setError(`Could not save expense: ${getErrorMessage(saveError)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editExpense ? 'Edit Expense' : 'Add Expense'}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error && (
          <div
            role="alert"
            className="break-words rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Expense ID</Label>
            <Input
              value={form.expense_id}
              onChange={(event) =>
                setForm({ ...form, expense_id: event.target.value })
              }
              placeholder="EXP-XXX"
            />
          </div>

          <div>
            <Label>Date</Label>
            <Input
              type="date"
              required
              value={form.expense_date}
              onChange={(event) =>
                setForm({ ...form, expense_date: event.target.value })
              }
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Payment Method</Label>
            <Select
              value={form.payment_method}
              onChange={(event) =>
                setForm({ ...form, payment_method: event.target.value })
              }
            >
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: event.target.value })
              }
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Vendor</Label>
            <Input
              value={form.vendor}
              onChange={(event) =>
                setForm({ ...form, vendor: event.target.value })
              }
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
