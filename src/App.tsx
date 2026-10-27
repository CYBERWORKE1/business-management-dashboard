
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DataProvider } from '@/lib/store';
import { Sidebar, TopBar, type PageKey } from '@/components/Layout';
import { OverviewPage } from '@/pages/OverviewPage';
import { SalesPage } from '@/pages/SalesPage';
import { PurchasesPage } from '@/pages/PurchasesPage';
import { StockPage } from '@/pages/StockPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { GoLiveReadinessPage } from '@/pages/GoLiveReadinessPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { DataImportPage } from '@/pages/DataImportPage';
import { SettingsPage } from '@/pages/SettingsPage';

type AppRole = 'admin' | 'viewer';

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        setError(signInError.message);
      }
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
            J
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Jainath Sales
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to your sales dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Access is available to authorized Admin and Viewer accounts.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const previousUserId = useRef<string | null>(null);

  const [page, setPage] = useState<PageKey>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Restore the last selected theme so the page and CSS stay in sync.
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('jainath-theme') === 'dark';
    } catch {
      return false;
    }
  });

  // The theme CSS uses html.dark for dark mode and html:not(.dark) for light mode.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', darkMode);
    root.dataset.theme = darkMode ? 'dark' : 'light';

    try {
      localStorage.setItem('jainath-theme', darkMode ? 'dark' : 'light');
    } catch {
      // Theme still works for this session when browser storage is unavailable.
    }
  }, [darkMode]);

  // Restore the session and listen for authentication changes.
  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user.id ?? null;
      const userChanged = previousUserId.current !== nextUserId;

      // Clear the role only when the account changes, not on token refresh.
      if (userChanged) {
        previousUserId.current = nextUserId;
        setRole(null);
        setAuthError('');
      }

      setSession(nextSession);
      setAuthLoading(false);
    });

    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setAuthError(error.message);
        }

        const restoredSession = data.session;
        const restoredUserId = restoredSession?.user.id ?? null;

        if (previousUserId.current !== restoredUserId) {
          previousUserId.current = restoredUserId;
          setRole(null);
        }

        setSession(restoredSession);
        setAuthLoading(false);
      } catch {
        if (!mounted) return;

        setAuthError('Unable to check your login session.');
        setAuthLoading(false);
      }
    }

    void restoreSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Retrieve the signed-in user's database role.
  useEffect(() => {
    let active = true;

    if (!session?.user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    async function loadRole() {
      setRoleLoading(true);
      setRole(null);
      setAuthError('');

      try {
        const { data, error } = await supabase
          .from('app_user_roles')
          .select('role')
          .eq('user_id', session!.user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setAuthError(`Unable to verify your account role: ${error.message}`);
          return;
        }

        if (data?.role === 'admin' || data?.role === 'viewer') {
          setRole(data.role);
        } else {
          setAuthError(
            'Your account has no Admin or Viewer role. Ask an administrator to assign your role.'
          );
        }
      } catch {
        if (active) {
          setAuthError('Unable to verify your account role. Please try again.');
        }
      } finally {
        if (active) setRoleLoading(false);
      }
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(`Sign out failed: ${error.message}`);
    }
  }

  function renderPage() {
    switch (page) {
      case 'overview':
        return <OverviewPage />;
      case 'sales':
        return <SalesPage />;
      case 'purchases':
        return <PurchasesPage />;
      case 'inventory':
      case 'stock':
        return <StockPage />;
      case 'employees':
        return <EmployeesPage />;
      case 'readiness':
        return <GoLiveReadinessPage />;
      case 'customers':
        return <CustomersPage />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'import':
        return <DataImportPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  }

  if (authLoading || (session && roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Checking your account…
      </div>
    );
  }

  if (!session) {
    return (
      <>
        {authError && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
            {authError}
          </div>
        )}
        <LoginScreen />
      </>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Account access not configured
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            You are signed in, but your account does not currently have a
            verified Admin or Viewer role.
          </p>

          {authError && (
            <p className="mt-3 break-words text-sm text-red-600">
              {authError}
            </p>
          )}

          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>

          <button
            onClick={handleSignOut}
            className="ml-3 mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <DataProvider>
      <div
        className={`flex min-h-screen flex-col transition-colors duration-200 ${
          darkMode
            ? 'dark bg-slate-900 text-slate-100'
            : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="flex min-h-0 flex-1">
          <Sidebar
            current={page}
            onNavigate={setPage}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((prev) => !prev)}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
            role={role}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              onMobileMenu={() => setMobileOpen(true)}
              onNavigate={setPage}
              search={search}
              onSearchChange={setSearch}
              darkMode={darkMode}
              onToggleTheme={() => setDarkMode((prev) => !prev)}
              role={role}
              userEmail={session.user.email}
              onSignOut={() => void handleSignOut()}
            />

            <main
              className={`flex-1 transition-colors duration-200 ${
                darkMode ? 'bg-slate-900' : 'bg-slate-50'
              }`}
            >
              {renderPage()}
            </main>
          </div>
        </div>
      </div>
    </DataProvider>
  );
}

export default App;
