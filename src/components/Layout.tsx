import './premium.css';

import { type ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  Package,
  Users,
  UserRoundCog,
  Truck,
  Wallet,
  Receipt,
  FileBarChart,
  ShieldCheck,
  Upload,
  Settings as SettingsIcon,
  Menu,
  Search,
  Bell,
  ChevronDown,
  Sun,
  Moon,
  CircleUser,
} from 'lucide-react';

export type PageKey =
  | 'overview'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'stock'
  | 'customers'
  | 'employees'
  | 'suppliers'
  | 'expenses'
  | 'payments'
  | 'reports'
  | 'readiness'
  | 'import'
  | 'settings';

const navItems: { key: PageKey; label: string; icon: ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
  { key: 'sales', label: 'Sales', icon: <ShoppingCart size={20} /> },
  { key: 'purchases', label: 'Purchases', icon: <Receipt size={20} /> },
  { key: 'stock', label: 'Stock Catalogue', icon: <Package size={20} /> },
  { key: 'customers', label: 'Customers', icon: <Users size={20} /> },
  { key: 'employees', label: 'Employees', icon: <UserRoundCog size={20} /> },
  { key: 'suppliers', label: 'Suppliers', icon: <Truck size={20} /> },
  { key: 'expenses', label: 'Expenses', icon: <Wallet size={20} /> },
  { key: 'payments', label: 'Payments & Dues', icon: <FileBarChart size={20} /> },
  { key: 'reports', label: 'Reports', icon: <FileBarChart size={20} /> },
  { key: 'readiness', label: 'Go-Live Readiness', icon: <ShieldCheck size={20} /> },
  { key: 'import', label: 'Data Import', icon: <Upload size={20} /> },
  { key: 'settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
];

export function Sidebar({
  current,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  role,
}: {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  role?: 'admin' | 'viewer';
}) {
  const [businessBrand, setBusinessBrand] = useState({
    company_name: 'Jainath Sales',
    industry: 'Pipe Trading & Distribution',
    logo_url: '',
  });

  useEffect(() => {
    let active = true;
    async function loadBrand() {
      const { data } = await supabase
        .from('business_settings')
        .select('company_name, industry, logo_url')
        .eq('id', 1)
        .maybeSingle();
      if (active && data) {
        setBusinessBrand({
          company_name: data.company_name || 'Jainath Sales',
          industry: data.industry || 'Pipe Trading & Distribution',
          logo_url: data.logo_url || '',
        });
      }
    }
    // Refresh branding immediately after Settings saves, even when Supabase
    // Realtime is not enabled for business_settings.
    const handleBrandingUpdated = () => {
      void loadBrand();
    };

    void loadBrand();
    window.addEventListener('business-branding-updated', handleBrandingUpdated);

    const { data: listener } = supabase
      .channel('business-branding-sidebar')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_settings' },
        handleBrandingUpdated,
      )
      .subscribe();

    return () => {
      active = false;
      window.removeEventListener('business-branding-updated', handleBrandingUpdated);
      void supabase.removeChannel(listener);
    };
  }, []);

  return (
    <>
      {mobileOpen && (
        <div
          className="premium-mobile-scrim fixed inset-0 bg-slate-950/60 z-30 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`premium-sidebar fixed lg:sticky top-0 left-0 h-screen
          text-white flex flex-col z-40 transition-all duration-300
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="premium-brand flex items-center gap-3 px-4 h-20 border-b shrink-0">
          <div className="premium-brand-mark w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden bg-emerald-600/20">
            {businessBrand.logo_url ? (
              <img
                src={businessBrand.logo_url}
                alt={`${businessBrand.company_name} logo`}
                className="h-full w-full object-contain p-1.5"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <Building2 size={28} className="text-emerald-100" aria-hidden="true" />
            )}
          </div>

          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="truncate font-bold text-white text-lg leading-tight tracking-tight">
                {businessBrand.company_name}
              </p>
              <p className="truncate text-xs text-emerald-200 mt-1">
                {businessBrand.industry}
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="premium-collapse hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full items-center justify-center z-50"
        >
          {collapsed ? (
            <ChevronDown size={14} className="rotate-90" />
          ) : (
            <ChevronDown size={14} className="-rotate-90" />
          )}
        </button>

        {/* Navigation */}
        <nav className="premium-nav flex-1 overflow-y-auto py-5 px-3 space-y-1.5">
          {navItems
            .filter((item) => role !== 'viewer' || (item.key !== 'import' && item.key !== 'settings'))
            .map((item) => {
            const active = current === item.key;

            return (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate(item.key);
                  onMobileClose();
                }}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`
                  premium-nav-item w-full flex items-center gap-3 px-3 py-3
                  rounded-xl text-sm font-medium transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300
                  ${
                    active
                      ? 'premium-nav-active text-white'
                      : 'text-emerald-100 hover:bg-emerald-900/70 hover:text-white'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
      </aside>
    </>
  );
}

export function TopBar({
  onMobileMenu,
  onNavigate,
  search,
  onSearchChange,
  darkMode,
  onToggleTheme,
  role,
  userEmail,
  onSignOut,
}: {
  onMobileMenu: () => void;
  onNavigate: (page: PageKey) => void;
  search: string;
  onSearchChange: (v: string) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  role?: 'admin' | 'viewer';
  userEmail?: string | null;
  onSignOut?: () => void;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const headerColors = darkMode
    ? 'bg-slate-900 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-700';

  const inputColors = darkMode
    ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-800 focus:border-emerald-400 focus:ring-emerald-900'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-400 focus:ring-emerald-100';

  const iconButtonColors = darkMode
    ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';

  const menuColors = darkMode
    ? 'bg-slate-800 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-800';

  const dividerColors = darkMode ? 'border-slate-700' : 'border-slate-100';

  return (
    <header
      className={`premium-topbar sticky top-0 z-20 border-b h-[76px] flex items-center px-4 lg:px-8 gap-3 sm:gap-5 transition-colors duration-200 ${headerColors}`}
    >
      {/* Mobile menu */}
      <button
        onClick={onMobileMenu}
        aria-label="Open navigation menu"
        className={`lg:hidden p-2 rounded-lg ${iconButtonColors}`}
      >
        <Menu size={22} />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search invoices, customers, products..."
          aria-label="Search invoices, customers and products"
          className={`premium-search w-full pl-10 pr-4 py-3 text-sm border rounded-xl outline-none focus:ring-2 transition-colors ${inputColors}`}
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={darkMode}
          title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          className={`premium-icon-button p-2.5 rounded-xl transition-colors ${iconButtonColors}`}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className={`premium-icon-button relative p-2.5 rounded-xl ${iconButtonColors}`}
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setNotifOpen(false)}
              />
              <div
                className={`premium-popover absolute right-0 mt-3 w-72 rounded-2xl shadow-xl border z-20 ${menuColors}`}
              >
                <div className={`p-3 border-b font-medium text-sm ${dividerColors}`}>
                  Notifications
                </div>
                <div className="p-3 text-sm space-y-2">
                  <p className="text-amber-600 dark:text-amber-400">
                    Low-stock alerts are a demo notification
                  </p>
                  <p className="text-rose-600 dark:text-rose-400">
                    Payment reminders are demo notifications
                  </p>
                  <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                    Notifications are currently illustrative
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            aria-label="Account menu"
            aria-expanded={profileOpen}
            className={`premium-account-button flex items-center gap-2 p-1.5 rounded-xl ${iconButtonColors}`}
          >
            <div className="premium-avatar w-9 h-9 rounded-xl flex items-center justify-center text-white">
              <CircleUser size={20} />
            </div>
            <span className="hidden sm:inline text-sm font-medium">
              {userEmail ? userEmail.split('@')[0] : (role ? (role === 'admin' ? 'Admin' : 'Viewer') : 'Account')}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setProfileOpen(false)}
              />
              <div
                className={`premium-popover absolute right-0 mt-3 w-52 rounded-2xl shadow-xl border z-20 ${menuColors}`}
              >
                <div className={`p-3 border-b ${dividerColors}`}>
                  <p className="font-semibold text-sm break-all">
                    {userEmail || 'Signed-in account'}
                  </p>
                  <p className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {role ? (role === 'admin' ? 'Administrator' : 'Viewer access') : 'Role unavailable'}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      onNavigate('settings');
                      setProfileOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm ${iconButtonColors}`}
                  >
                    Settings
                  </button>
                  {role !== 'viewer' && (
                    <button
                      onClick={() => {
                        onNavigate('import');
                        setProfileOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${iconButtonColors}`}
                    >
                      Data Import
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onSignOut?.();
                    }}
                    className={`w-full text-left px-3 py-2 text-sm text-rose-600 dark:text-rose-300 ${iconButtonColors}`}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="premium-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
      <div>
        <h1 className="text-3xl lg:text-[34px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="premium-page p-4 sm:p-6 lg:p-8 max-w-[1800px] mx-auto">{children}</div>;
}
