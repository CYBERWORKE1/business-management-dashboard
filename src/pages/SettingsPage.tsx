import { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  IndianRupee,
  Package,
  AlertTriangle,
  FileText,
  Pencil,
  Save,
  X,
  ShieldCheck,
  Image as ImageIcon,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/store';
import { formatNumber } from '@/lib/format';
import {
  Button,
  Card,
  Input,
  Label,
  LoadingState,
} from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

type BusinessSettings = {
  company_name: string;
  industry: string;
  logo_url: string;
  currency_label: string;
  timezone: string;
  date_format: string;
  financial_year: string;
  cost_method: string;
  gst_treatment: string;
};

const DEFAULTS: BusinessSettings = {
  company_name: 'Jainath Sales',
  industry: 'Pipe Trading & Distribution',
  logo_url: '',
  currency_label: 'Indian Rupees (₹)',
  timezone: 'Asia/Kolkata (IST)',
  date_format: 'DD MMM YYYY',
  financial_year: '1 April to 31 March',
  cost_method: 'Weighted Average (latest purchase cost)',
  gst_treatment: 'GST excluded from revenue (pass-through)',
};

const FIELDS: {
  key: keyof BusinessSettings;
  label: string;
  hint: string;
}[] = [
  {
    key: 'company_name',
    label: 'Company Name',
    hint: 'The name displayed in your sidebar and company branding.',
  },
  {
    key: 'industry',
    label: 'Business Description',
    hint: 'Describe your company’s main business activity.',
  },
  {
    key: 'logo_url',
    label: 'Company Logo URL',
    hint: 'Paste a direct HTTPS URL to your company logo image.',
  },
  {
    key: 'currency_label',
    label: 'Currency',
    hint: 'Display label only; this does not convert existing amounts.',
  },
  {
    key: 'timezone',
    label: 'Timezone',
    hint: 'Business reporting timezone label.',
  },
  {
    key: 'date_format',
    label: 'Date Format',
    hint: 'Preferred date display format.',
  },
  {
    key: 'financial_year',
    label: 'Financial Year',
    hint: 'Financial year description.',
  },
  {
    key: 'cost_method',
    label: 'Cost Method',
    hint: 'Description only; does not change profit calculation logic.',
  },
  {
    key: 'gst_treatment',
    label: 'GST Treatment',
    hint: 'Description only; does not change tax calculations.',
  },
];

export function SettingsPage() {
  const data = useData();

  const [settings, setSettings] =
    useState<BusinessSettings>(DEFAULTS);

  const [draft, setDraft] =
    useState<BusinessSettings>(DEFAULTS);

  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          if (mounted) {
            setIsAdmin(false);
            setRoleLoading(false);
          }
          return;
        }

        const { data: row, error: roleError } = await supabase
          .from('app_user_roles')
          .select('role')
          .eq('user_id', auth.user.id)
          .maybeSingle();

        if (mounted) {
          setIsAdmin(!roleError && row?.role === 'admin');
          setRoleLoading(false);
        }
      } catch {
        if (mounted) {
          setIsAdmin(false);
          setRoleLoading(false);
        }
      }
    }

    void loadRole();

    const { data: listener } = supabase.auth.onAuthStateChange(
      () => {
        void loadRole();
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      setLoadingSettings(true);
      setError('');

      try {
        const { data: row, error: queryError } = await supabase
          .from('business_settings')
          .select(
            'company_name, industry, logo_url, currency_label, timezone, date_format, financial_year, cost_method, gst_treatment',
          )
          .eq('id', 1)
          .maybeSingle();

        if (!mounted) return;

        if (queryError) {
          setError(
            `Could not load business configuration: ${queryError.message}. Check that the business_settings table and logo_url column exist.`,
          );
        } else if (row) {
          const merged: BusinessSettings = {
            ...DEFAULTS,
            ...row,
            logo_url: row.logo_url ?? '',
          };

          setSettings(merged);
          setDraft(merged);
        } else {
          setSettings(DEFAULTS);
          setDraft(DEFAULTS);
        }
      } catch (caught) {
        if (mounted) {
          setError(
            `Could not load business configuration: ${
              caught instanceof Error
                ? caught.message
                : 'Unknown error'
            }`,
          );
        }
      } finally {
        if (mounted) setLoadingSettings(false);
      }
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  async function saveSettings() {
    setError('');
    setNotice('');

    if (!isAdmin) {
      setError('Only an Admin can change business configuration.');
      return;
    }

    if (!draft.company_name.trim() || !draft.industry.trim()) {
      setError(
        'Company Name and Business Description are required.',
      );
      return;
    }

    const logoUrl = draft.logo_url.trim();

    if (logoUrl) {
      try {
        const parsedUrl = new URL(logoUrl);

        if (parsedUrl.protocol !== 'https:') {
          setError(
            'Please use an HTTPS URL for your company logo.',
          );
          return;
        }
      } catch {
        setError('Please enter a valid company logo URL.');
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        id: 1,
        company_name: draft.company_name.trim(),
        industry: draft.industry.trim(),
        logo_url: logoUrl,
        currency_label: draft.currency_label.trim(),
        timezone: draft.timezone.trim(),
        date_format: draft.date_format.trim(),
        financial_year: draft.financial_year.trim(),
        cost_method: draft.cost_method.trim(),
        gst_treatment: draft.gst_treatment.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error: saveError } = await supabase
        .from('business_settings')
        .upsert(payload, { onConflict: 'id' });

      if (saveError) throw saveError;

      const savedSettings: BusinessSettings = {
        ...draft,
        company_name: payload.company_name,
        industry: payload.industry,
        logo_url: payload.logo_url,
      };

      setSettings(savedSettings);
      setDraft(savedSettings);

      // Update the sidebar company name, description and logo immediately.
      // The sidebar listens for this event; no page reload or Realtime setup is needed.
      window.dispatchEvent(new CustomEvent('business-branding-updated', {
        detail: {
          company_name: savedSettings.company_name,
          industry: savedSettings.industry,
          logo_url: savedSettings.logo_url,
        },
      }));

      setEditing(false);
      setNotice('Business configuration saved successfully.');
    } catch (caught) {
      setError(
        `Could not save business configuration: ${
          caught instanceof Error
            ? caught.message
            : 'Unknown error'
        }`,
      );
    } finally {
      setSaving(false);
    }
  }

  const dataCounts = [
    {
      label: 'Products',
      value: data.products.length,
      icon: <Package size={20} />,
    },
    {
      label: 'Customers',
      value: data.customers.length,
      icon: <Building2 size={20} />,
    },
    {
      label: 'Suppliers',
      value: data.suppliers.length,
      icon: <Building2 size={20} />,
    },
    {
      label: 'Sales Invoices',
      value: data.salesInvoices.length,
      icon: <FileText size={20} />,
    },
    {
      label: 'Purchase Invoices',
      value: data.purchases.length,
      icon: <FileText size={20} />,
    },
    {
      label: 'Expenses',
      value: data.expenses.length,
      icon: <IndianRupee size={20} />,
    },
    {
      label: 'Payments',
      value: data.payments.length,
      icon: <IndianRupee size={20} />,
    },
    {
      label: 'Stock Movements',
      value: data.stockMovements.length,
      icon: <Package size={20} />,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        subtitle="Company branding and business configuration"
        actions={
          isAdmin &&
          !roleLoading &&
          !loadingSettings &&
          !editing ? (
            <Button
              onClick={() => {
                setDraft(settings);
                setEditing(true);
                setError('');
                setNotice('');
              }}
            >
              <Pencil size={16} />
              Edit Configuration
            </Button>
          ) : undefined
        }
      />

      {!roleLoading && !isAdmin && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] dark:text-emerald-100">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          Viewer access: business configuration is read-only.
          Ask an Admin to make changes.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200"
        >
          {notice}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Business Configuration">
          {loadingSettings || roleLoading ? (
            <LoadingState />
          ) : (
            <div className="space-y-5">
              {/* Company identity preview */}
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-400/20 dark:bg-emerald-950/25">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-200 bg-[#edf2ee] p-1.5 dark:border-emerald-400/20 dark:bg-slate-900">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt={`${settings.company_name} logo`}
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Building2
                      size={30}
                      className="text-emerald-700 dark:text-emerald-300"
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
                    {settings.company_name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {settings.industry}
                  </p>
                  {isAdmin && (
                    <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                      Use Edit Configuration to update your company
                      identity and logo.
                    </p>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="space-y-4">
                  {FIELDS.map((field) => (
                    <div key={field.key}>
                      <Label>
                        {field.label}
                        {['company_name', 'industry'].includes(
                          field.key,
                        )
                          ? ' *'
                          : ''}
                      </Label>

                      <Input
                        value={draft[field.key]}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        placeholder={
                          field.key === 'logo_url'
                            ? 'https://example.com/logo.png'
                            : field.label
                        }
                      />

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {field.hint}
                      </p>

                      {field.key === 'logo_url' && (
                        <div className="mt-3 flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-emerald-400/15 dark:bg-slate-900/50">
                          {draft.logo_url.trim() ? (
                            <img
                              src={draft.logo_url.trim()}
                              alt="Company logo preview"
                              className="h-16 w-16 rounded-lg border border-slate-200 bg-white p-1 object-contain dark:border-slate-700"
                              onError={(event) => {
                                event.currentTarget.style.display =
                                  'none';
                              }}
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              <ImageIcon size={26} />
                            </div>
                          )}

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Preview: your logo will fit inside a
                            square frame without being stretched.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-emerald-400/15">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setDraft(settings);
                        setEditing(false);
                        setError('');
                        setNotice('');
                      }}
                      disabled={saving}
                    >
                      <X size={16} />
                      Cancel
                    </Button>

                    <Button
                      onClick={() => void saveSettings()}
                      disabled={saving}
                    >
                      <Save size={16} />
                      {saving ? 'Saving…' : 'Save Configuration'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {FIELDS.filter(
                    (field) =>
                      field.key !== 'company_name' &&
                      field.key !== 'industry' &&
                      field.key !== 'logo_url',
                  ).map((field) => (
                    <div
                      key={field.key}
                      className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-emerald-400/15"
                    >
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {field.label}
                      </span>

                      <span className="text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {settings[field.key]}
                      </span>
                    </div>
                  ))}

                  {isAdmin && (
                    <p className="pt-3 text-xs text-slate-500 dark:text-slate-400">
                      Configuration is stored in Supabase and shared
                      with authorized users.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="Data Summary">
          <div className="grid grid-cols-2 gap-3">
            {dataCounts.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-400/15 dark:bg-slate-900/70"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {item.label}
                  </span>

                  <span className="shrink-0 text-emerald-700 dark:text-emerald-300">
                    {item.icon}
                  </span>
                </div>

                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatNumber(item.value)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Profitability Calculation Method" className="mb-6">
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <div className="flex items-start gap-3">
            <Calendar
              size={18}
              className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
            />
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Gross Profit
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                = Net Sales (excluding GST) - Cost of Goods Sold
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <IndianRupee
              size={18}
              className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
            />
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Net Sales
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                = Invoice subtotal - Discounts. GST is not counted
                as revenue (recoverable input tax credit).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Package
              size={18}
              className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
            />
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Cost of Goods Sold
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                = Quantity sold × Purchase cost per unit. Inventory
                valuation uses weighted average cost. Units are not
                mixed in quantity calculations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-300"
            />
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Operating Profit
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                = Gross Profit - Operating Expenses. This is not
                net profit; it excludes income tax and interest.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}