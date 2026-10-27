import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, ShoppingBag, IndianRupee, Wallet, Users, Truck,
  Package, AlertTriangle, Percent,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useData } from '@/lib/store';
import { formatDate, formatINR, formatPercent, formatNumber } from '@/lib/format';
import { getDateRange, previousEquivalentRange, type DateRange } from '@/lib/dateRanges';
import {
  computeKpis, computeSalesVsPurchases, computeSalesByCategory,
  computeTopProducts, computeTopCustomers, computeSalesByPerson,
  computePaymentTrends, computeInventoryDistribution, computeGrossProfitTrend,
  computeCustomerOutstanding, daysOverdue, ageingBucket,
} from '@/lib/calculations';
import { KpiCard, Card, Badge } from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/Layout';
import { DateRangeFilter } from '@/components/DateRangeFilter';

const PIE_COLORS = ['#059669', '#10b981', '#34d399', '#0f766e', '#84cc16', '#64748b', '#a7f3d0'];


export function OverviewPage() {
  const data = useData();
  const [range, setRange] = useState<DateRange>(() => getDateRange('fy'));

  // Follow the app's existing `.dark` class so charts stay readable when
  // the theme toggle is used, without changing any calculations or data.
  const [darkMode, setDarkMode] = useState(
    () => typeof document !== 'undefined' && document.querySelector('.dark') !== null
  );

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;

    const updateTheme = () => {
      setDarkMode(document.querySelector('.dark') !== null);
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const chartGrid = darkMode ? '#454842' : '#e2e8f0';
  const chartText = darkMode ? '#a1a1aa' : '#64748b';
  const chartTooltip = {
    backgroundColor: darkMode ? '#292b28' : '#ffffff',
    border: `1px solid ${darkMode ? '#454842' : '#e2e8f0'}`,
    borderRadius: 8,
    color: darkMode ? '#f4f4f5' : '#1e293b',
  };

  const kpis = useMemo(() =>
    computeKpis(data.products, data.salesInvoices, data.salesItems, data.purchases, data.purchaseItems, data.expenses, data.payments, range),
    [data, range]);

  const prevRange = previousEquivalentRange(range);
  const prevKpis = useMemo(() =>
    computeKpis(data.products, data.salesInvoices, data.salesItems, data.purchases, data.purchaseItems, data.expenses, data.payments, prevRange),
    [data, prevRange]);

  function pctChange(curr: number, prev: number): number | undefined {
    if (prev === 0) return undefined;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  const salesVsPurchases = useMemo(() =>
    computeSalesVsPurchases(data.salesInvoices, data.purchases, range), [data, range]);

  const salesByCategory = useMemo(() =>
    computeSalesByCategory(data.salesInvoices, data.salesItems, data.products, range), [data, range]);

  const topProducts = useMemo(() =>
    computeTopProducts(data.salesInvoices, data.salesItems, data.products, range, 10), [data, range]);

  const topCustomers = useMemo(() =>
    computeTopCustomers(data.salesInvoices, data.customers, range, 10), [data, range]);

  const salesByPerson = useMemo(() =>
    computeSalesByPerson(data.salesInvoices, range), [data, range]);

  const paymentTrends = useMemo(() =>
    computePaymentTrends(data.payments, range), [data, range]);

  const inventoryDist = useMemo(() =>
    computeInventoryDistribution(data.products), [data]);

  const gpTrend = useMemo(() =>
    computeGrossProfitTrend(data.salesInvoices, data.salesItems, range), [data, range]);

  const overdueReceivables = useMemo(() => {
    const outstanding = computeCustomerOutstanding(data.salesInvoices, data.customers);
    return outstanding.filter((o) => daysOverdue(o.due_date) > 0).slice(0, 5);
  }, [data]);

  const recentSales = useMemo(() => {
    const customerMap = new Map(data.customers.map((c) => [c.id, c]));
    return data.salesInvoices.slice(0, 6).map((s) => ({
      ...s,
      customer_name: customerMap.get(s.customer_id)?.name ?? '-',
    }));
  }, [data]);

  const lowStockProducts = useMemo(() =>
    data.products.filter((p) => p.stock_qty <= p.min_stock).slice(0, 5),
    [data]);

  // Profitability detail is calculated from the saved invoice line costs, not
  // the product catalogue's current purchase cost, so historical margins remain meaningful.
  const [marginThreshold, setMarginThreshold] = useState(10);
  const profitability = useMemo(() => {
    const invoiceMap = new Map(data.salesInvoices.map((invoice) => [invoice.id, invoice]));
    const products = new Map<string, { id: string; sku: string; name: string; revenue: number; cost: number; quantity: number }>();
    const people = new Map<string, { name: string; revenue: number; cost: number; invoices: Set<string> }>();
    for (const item of data.salesItems) {
      const invoice = invoiceMap.get(item.invoice_id);
      if (!invoice) continue;
      const revenue = Number(item.line_total ?? 0);
      const cost = Number(item.line_cogs ?? (Number(item.unit_cost ?? 0) * Number(item.quantity ?? 0)));
      const product = products.get(item.product_id) ?? { id: item.product_id, sku: item.sku ?? '-', name: item.description ?? 'Unknown product', revenue: 0, cost: 0, quantity: 0 };
      product.revenue += revenue; product.cost += cost; product.quantity += Number(item.quantity ?? 0);
      products.set(item.product_id, product);
      const name = (invoice as typeof invoice & { salesperson?: string | null }).salesperson?.trim() || 'Unassigned';
      const person = people.get(name) ?? { name, revenue: 0, cost: 0, invoices: new Set<string>() };
      person.revenue += revenue; person.cost += cost; person.invoices.add(invoice.id); people.set(name, person);
    }
    const productRows = [...products.values()].map((p) => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
    const personRows = [...people.values()].map((p) => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0, invoiceCount: p.invoices.size }))
      .sort((a, b) => b.profit - a.profit);
    return { productRows, personRows, lowMargin: productRows.filter((p) => p.revenue > 0 && p.margin < marginThreshold).sort((a, b) => a.margin - b.margin) };
  }, [data.salesInvoices, data.salesItems, marginThreshold]);

  if (data.loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      </PageContainer>
    );
  }

  if (data.error) {
    return (
      <PageContainer>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
          Error loading data: {data.error}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="jainath-overview">
      <PageHeader
        title="Overview Dashboard"
        subtitle="Business performance summary"
        actions={<DateRangeFilter range={range} onChange={setRange} />}
      />

      {/* <div className="mb-4 inline-block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        DEMO DATA — Figures are fictional sample data for Jainath Sales
      </div> */}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <KpiCard title="Total Sales" value={formatINR(kpis.totalSales, { compact: true })}
          trend={pctChange(kpis.totalSales, prevKpis.totalSales)} trendLabel="vs prev period"
          tone="info" icon={<TrendingUp size={20} />} />
        <KpiCard title="Total Purchase" value={formatINR(kpis.totalPurchase, { compact: true })}
          trend={pctChange(kpis.totalPurchase, prevKpis.totalPurchase)} trendLabel="vs prev period"
          tone="default" icon={<ShoppingBag size={20} />} />
        <KpiCard title="Gross Profit" value={formatINR(kpis.grossProfit, { compact: true })}
          trend={pctChange(kpis.grossProfit, prevKpis.grossProfit)} trendLabel="vs prev period"
          tone="positive" icon={<IndianRupee size={20} />} />
        <KpiCard title="Gross Profit Margin" value={formatPercent(kpis.grossProfitMargin)}
          subtitle={`Net sales: ${formatINR(kpis.totalSales, { compact: true })}`}
          tone="positive" icon={<Percent size={20} />} />
        <KpiCard title="Total Expenses" value={formatINR(kpis.totalExpenses, { compact: true })}
          trend={pctChange(kpis.totalExpenses, prevKpis.totalExpenses)} trendLabel="vs prev period"
          tone="warning" icon={<Wallet size={20} />} />
        <KpiCard title="Net Operating Profit" value={formatINR(kpis.netOperatingProfit, { compact: true })}
          subtitle="Gross profit minus expenses"
          tone="positive" icon={<TrendingUp size={20} />} />
        <KpiCard title="Customer Outstanding" value={formatINR(kpis.customerOutstanding, { compact: true })}
          subtitle="Receivables from customers"
          tone="warning" icon={<Users size={20} />} />
        <KpiCard title="Supplier Outstanding" value={formatINR(kpis.supplierOutstanding, { compact: true })}
          subtitle="Payables to suppliers"
          tone="warning" icon={<Truck size={20} />} />
        <KpiCard title="Inventory Value" value={formatINR(kpis.inventoryValue, { compact: true })}
          subtitle={`${data.products.length} products in stock`}
          tone="info" icon={<Package size={20} />} />
        <KpiCard title="Low-Stock Products" value={formatNumber(kpis.lowStockCount)}
          subtitle="At or below reorder level"
          tone={kpis.lowStockCount > 0 ? 'negative' : 'positive'}
          icon={<AlertTriangle size={20} />} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Sales vs Purchases (Monthly)">
          {salesVsPurchases.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={salesVsPurchases}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartText }} />
                <YAxis tick={{ fontSize: 11, fill: chartText }} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={chartTooltip} itemStyle={{ color: chartText }} labelStyle={{ color: chartText }} />
                <Legend wrapperStyle={{ fontSize: 12, color: chartText }} />
                <Bar dataKey="sales" name="Sales" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchase" name="Purchases" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-10 text-center">No data in selected period</p>}
        </Card>

        <Card title="Gross Profit Trend">
          {gpTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={gpTrend}>
                <defs>
                  <linearGradient id="gpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartText }} />
                <YAxis tick={{ fontSize: 11, fill: chartText }} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={chartTooltip} itemStyle={{ color: chartText }} labelStyle={{ color: chartText }} />
                <Area type="monotone" dataKey="profit" name="Gross Profit" stroke="#059669" strokeWidth={2} fill="url(#gpGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-10 text-center">No data in selected period</p>}
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Sales by Pipe Category">
          {salesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={salesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={{ fill: chartText, fontSize: 11 }}>
                  {salesByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={chartTooltip} itemStyle={{ color: chartText }} labelStyle={{ color: chartText }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-10 text-center">No data in selected period</p>}
        </Card>

        <Card title="Top 10 Products by Revenue">
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis type="number" tick={{ fontSize: 11, fill: chartText }} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
                <YAxis type="category" dataKey="sku" tick={{ fontSize: 11, fill: chartText }} width={50} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={chartTooltip} itemStyle={{ color: chartText }} labelStyle={{ color: chartText }} />
                <Bar dataKey="revenue" name="Revenue" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-10 text-center">No data in selected period</p>}
        </Card>

        <Card title="Inventory Distribution by Category">
          {inventoryDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={inventoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={{ fill: chartText, fontSize: 11 }}>
                  {inventoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={chartTooltip} itemStyle={{ color: chartText }} labelStyle={{ color: chartText }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-10 text-center">No data</p>}
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Top 10 Customers by Sales">
          {topCustomers.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis type="number" tick={{ fontSize: 11, fill: chartText }} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: chartText }} width={130} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={chartTooltip} itemStyle={{ color: chartText }} labelStyle={{ color: chartText }} />
                <Bar dataKey="total" name="Total Sales" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-10 text-center">No data in selected period</p>}
        </Card>

        <Card title="Payment Collection Trends">
          {paymentTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={paymentTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartText }} />
                <YAxis tick={{ fontSize: 11, fill: chartText }} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={chartTooltip} itemStyle={{ color: chartText }} labelStyle={{ color: chartText }} />
                <Legend wrapperStyle={{ fontSize: 12, color: chartText }} />
                <Line type="monotone" dataKey="receipts" name="Customer Receipts" stroke="#059669" strokeWidth={2} />
                <Line type="monotone" dataKey="payments" name="Supplier Payments" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-10 text-center">No data in selected period</p>}
        </Card>
      </div>

      {/* Sales by Salesperson */}
      {salesByPerson.length > 0 && (
        <div className="mb-6">
          <Card title="Sales by Salesperson">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesByPerson}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartText }} />
                <YAxis tick={{ fontSize: 11, fill: chartText }} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={chartTooltip} itemStyle={{ color: chartText }} labelStyle={{ color: chartText }} />
                <Bar dataKey="value" name="Sales" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Profitability and margin controls */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <Card title="Product Profitability (Recorded Invoice Costs)">
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">Uses cost captured on each sales invoice line, not today’s catalogue cost. All recorded sales are included.</p>
          {profitability.productRows.length ? (
            <div className="overflow-x-auto max-h-[360px]">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-700"><th className="py-2">Product</th><th className="py-2 text-right">Revenue</th><th className="py-2 text-right">Cost</th><th className="py-2 text-right">Gross profit</th><th className="py-2 text-right">Margin</th></tr></thead>
                <tbody>{profitability.productRows.slice(0, 12).map((p) => <tr key={p.id} className="border-b border-slate-100 dark:border-zinc-800"><td className="py-2 pr-3"><div className="font-medium text-slate-800 dark:text-zinc-100">{p.name}</div><div className="text-xs text-slate-500">{p.sku} · {formatNumber(p.quantity)} sold</div></td><td className="py-2 text-right whitespace-nowrap">{formatINR(p.revenue)}</td><td className="py-2 text-right whitespace-nowrap">{formatINR(p.cost)}</td><td className={`py-2 text-right whitespace-nowrap font-medium ${p.profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatINR(p.profit)}</td><td className="py-2 text-right">{p.margin.toFixed(1)}%</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="py-8 text-center text-sm text-slate-400">No sales line items available to calculate product profit.</p>}
        </Card>
        <Card title="Low-Margin Product Alerts">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><p className="text-xs text-slate-500 dark:text-zinc-400">Products below this gross margin are flagged.</p><label className="text-sm flex items-center gap-2">Alert below <select aria-label="Low margin alert threshold" className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:bg-zinc-900 dark:border-zinc-700" value={marginThreshold} onChange={(e) => setMarginThreshold(Number(e.target.value))}><option value={5}>5%</option><option value={10}>10%</option><option value={15}>15%</option><option value={20}>20%</option><option value={25}>25%</option><option value={30}>30%</option></select></label></div>
          {profitability.lowMargin.length ? <div className="space-y-2 max-h-[360px] overflow-y-auto">{profitability.lowMargin.slice(0, 15).map((p) => <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/20"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-100">{p.name}</p><p className="text-xs text-slate-500">{p.sku} · Profit {formatINR(p.profit)}</p></div><Badge tone={p.margin < 0 ? 'negative' : 'warning'}>{p.margin.toFixed(1)}%</Badge></div>)}</div> : <p className="py-8 text-center text-sm text-emerald-600">No recorded products are below {marginThreshold}% margin.</p>}
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">These are review alerts, not automatic price changes. Missing or zero cost data can distort margins; verify invoice costs before acting.</p>
        </Card>
      </div>

      <Card title="Salesperson Performance (Recorded Invoice Costs)" className="mb-6">
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">Ranks salesperson entries by gross profit from recorded invoice lines. Historical names are retained as entered on invoices.</p>
        {profitability.personRows.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-700"><th className="py-2">Salesperson</th><th className="py-2 text-right">Invoices</th><th className="py-2 text-right">Revenue</th><th className="py-2 text-right">Gross profit</th><th className="py-2 text-right">Margin</th></tr></thead><tbody>{profitability.personRows.map((p) => <tr key={p.name} className="border-b border-slate-100 dark:border-zinc-800"><td className="py-2 font-medium text-slate-800 dark:text-zinc-100">{p.name}</td><td className="py-2 text-right">{p.invoiceCount}</td><td className="py-2 text-right">{formatINR(p.revenue)}</td><td className={`py-2 text-right font-medium ${p.profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatINR(p.profit)}</td><td className="py-2 text-right">{p.margin.toFixed(1)}%</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-slate-400">No salesperson profitability data available yet.</p>}
      </Card>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Recent Sales">
          {recentSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-[#454842]">
                    <th className="py-2 font-medium">Invoice</th>
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Customer</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                    <th className="py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-[#3a3c38] dark:hover:bg-zinc-800/50">
                      <td className="py-2 font-medium text-blue-700 dark:text-blue-300">{s.invoice_no}</td>
                      <td className="py-2 text-slate-600 dark:text-zinc-300">{formatDate(s.invoice_date)}</td>
                      <td className="py-2 text-slate-700 dark:text-zinc-100">{s.customer_name}</td>
                      <td className="py-2 text-right text-slate-700 dark:text-zinc-100">{formatINR(s.total_amount)}</td>
                      <td className="py-2 text-center">
                        <Badge tone={s.payment_status === 'Paid' ? 'positive' : s.payment_status === 'Partial' ? 'warning' : 'negative'}>
                          {s.payment_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-6 text-center">No sales recorded yet</p>}
        </Card>

        <Card title="Low-Stock Products">
          {lowStockProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-[#454842]">
                    <th className="py-2 font-medium">SKU</th>
                    <th className="py-2 font-medium">Product</th>
                    <th className="py-2 text-right font-medium">Stock</th>
                    <th className="py-2 text-right font-medium">Min</th>
                    <th className="py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-[#3a3c38] dark:hover:bg-zinc-800/50">
                      <td className="py-2 font-medium text-slate-700 dark:text-zinc-100">{p.sku}</td>
                      <td className="py-2 text-slate-600 dark:text-zinc-300">{p.name}</td>
                      <td className="py-2 text-right text-rose-600 font-medium">{formatNumber(p.stock_qty)} {p.unit}</td>
                      <td className="py-2 text-right text-slate-500 dark:text-zinc-300">{formatNumber(p.min_stock)} {p.unit}</td>
                      <td className="py-2 text-center">
                        <Badge tone={p.stock_qty === 0 ? 'negative' : 'warning'}>
                          {p.stock_qty === 0 ? 'Out of stock' : 'Low stock'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-slate-400 dark:text-zinc-400 text-sm py-6 text-center">All products well stocked</p>}
        </Card>
      </div>

      {/* Overdue Payments Table */}
      {overdueReceivables.length > 0 && (
        <Card title="Overdue Customer Payments" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-[#454842]">
                  <th className="py-2 font-medium">Invoice</th>
                  <th className="py-2 font-medium">Customer</th>
                  <th className="py-2 font-medium">Due Date</th>
                  <th className="py-2 text-right font-medium">Outstanding</th>
                  <th className="py-2 text-center font-medium">Days Overdue</th>
                  <th className="py-2 text-center font-medium">Bucket</th>
                </tr>
              </thead>
              <tbody>
                {overdueReceivables.map((r) => {
                  const days = daysOverdue(r.due_date);
                  return (
                    <tr key={r.invoice_no} className="border-b border-slate-100 hover:bg-slate-50 dark:border-[#3a3c38] dark:hover:bg-zinc-800/50">
                      <td className="py-2 font-medium text-blue-700 dark:text-blue-300">{r.invoice_no}</td>
                      <td className="py-2 text-slate-700 dark:text-zinc-100">{r.customer_name}</td>
                      <td className="py-2 text-slate-600 dark:text-zinc-300">{formatDate(r.due_date)}</td>
                      <td className="py-2 text-right text-rose-600 font-medium">{formatINR(r.outstanding)}</td>
                      <td className="py-2 text-center text-rose-600">{days}</td>
                      <td className="py-2 text-center"><Badge tone="negative">{ageingBucket(days)}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </div>
    </PageContainer>
  );
}
