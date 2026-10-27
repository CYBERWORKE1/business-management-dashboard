import { useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import { useData } from '@/lib/store';
import { formatINR, formatDate, formatPercent } from '@/lib/format';
import { getDateRange, type DateRange } from '@/lib/dateRanges';
import {
  computeKpis, computeSalesByCategory, computeTopProducts, computeTopCustomers,
  computeSalesByPerson, computeInventoryDistribution,
} from '@/lib/calculations';
import { Card, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';
import { DateRangeFilter } from '@/components/DateRangeFilter';

const PIE_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d'];

function exportCSV(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => {
      const val = row[h];
      const raw = String(val ?? '');
      // Prefix spreadsheet formulas so imported names/text cannot execute as formulas.
      const str = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
      return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const data = useData();
  const [range, setRange] = useState<DateRange>(() => getDateRange('fy'));
  const [reportType, setReportType] = useState('profitability');

  const kpis = useMemo(() =>
    computeKpis(data.products, data.salesInvoices, data.salesItems, data.purchases, data.purchaseItems, data.expenses, data.payments, range),
    [data, range]);

  const salesByCat = useMemo(() => computeSalesByCategory(data.salesInvoices, data.salesItems, data.products, range), [data, range]);
  const topProducts = useMemo(() => computeTopProducts(data.salesInvoices, data.salesItems, data.products, range, 20), [data, range]);
  const topCustomers = useMemo(() => computeTopCustomers(data.salesInvoices, data.customers, range, 20), [data, range]);
  const salesByPerson = useMemo(() => computeSalesByPerson(data.salesInvoices, range), [data, range]);
  const inventoryDist = useMemo(() => computeInventoryDistribution(data.products), [data]);

  const customerMap = useMemo(() => new Map(data.customers.map((c) => [c.id, c])), [data.customers]);

  const salesIn = useMemo(() => data.salesInvoices.filter((s) => {
    const d = new Date(`${s.invoice_date}T00:00:00`);
    const start = new Date(range.start); start.setHours(0, 0, 0, 0);
    const end = new Date(range.end); end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }), [data.salesInvoices, range]);

  const invoiceProfitability = useMemo(() => {
    const invoiceMap = new Map(salesIn.map((invoice) => [invoice.id, invoice]));
    const totals = new Map<string, { invoice: typeof salesIn[number]; revenue: number; cost: number }>();
    for (const item of data.salesItems) {
      const invoice = invoiceMap.get(item.invoice_id);
      if (!invoice) continue;
      const current = totals.get(invoice.id) ?? { invoice, revenue: 0, cost: 0 };
      current.revenue += Number(item.line_total ?? 0);
      current.cost += Number(item.line_cogs ?? (Number(item.quantity ?? 0) * Number(item.unit_cost ?? 0)));
      totals.set(invoice.id, current);
    }
    return [...totals.values()].map(({ invoice, revenue, cost }) => ({
      Invoice: invoice.invoice_no,
      Date: invoice.invoice_date,
      Customer: customerMap.get(invoice.customer_id)?.name ?? '-',
      Salesperson: invoice.salesperson ?? '-',
      Revenue: Number(revenue.toFixed(2)),
      RecordedCost: Number(cost.toFixed(2)),
      GrossProfit: Number((revenue - cost).toFixed(2)),
      MarginPct: revenue > 0 ? Number((((revenue - cost) / revenue) * 100).toFixed(2)) : 0,
      Paid: invoice.amount_paid,
      Outstanding: invoice.outstanding,
      PaymentStatus: invoice.payment_status,
    }));
  }, [salesIn, data.salesItems, customerMap]);

  const salespersonProfitability = useMemo(() => {
    const grouped = new Map<string, { salesperson: string; invoices: Set<string>; revenue: number; cost: number }>();
    for (const row of invoiceProfitability) {
      const name = row.Salesperson || '-';
      const current = grouped.get(name) ?? { salesperson: name, invoices: new Set<string>(), revenue: 0, cost: 0 };
      current.invoices.add(row.Invoice);
      current.revenue += row.Revenue;
      current.cost += row.RecordedCost;
      grouped.set(name, current);
    }
    return [...grouped.values()].map((row) => ({
      Salesperson: row.salesperson,
      InvoiceCount: row.invoices.size,
      Revenue: Number(row.revenue.toFixed(2)),
      RecordedCost: Number(row.cost.toFixed(2)),
      GrossProfit: Number((row.revenue - row.cost).toFixed(2)),
      MarginPct: row.revenue > 0 ? Number((((row.revenue - row.cost) / row.revenue) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.GrossProfit - a.GrossProfit);
  }, [invoiceProfitability]);

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        subtitle="Business performance reports with CSV export"
        actions={<DateRangeFilter range={range} onChange={setRange} />}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={reportType} onChange={(e) => setReportType(e.target.value)} className="max-w-xs">
          <option value="profitability">Profitability Report</option>
          <option value="sales">Sales Report</option>
          <option value="inventory">Inventory Valuation Report</option>
          <option value="customer">Customer Summary Report</option>
          <option value="product">Product Performance Report</option>
          <option value="salesperson-profitability">Salesperson Profitability Report</option>
          <option value="invoice-profitability">Invoice Profitability Register</option>
        </Select>
      </div>

      {reportType === 'profitability' && (
        <div className="space-y-6">
          <Card title="Profitability Summary">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Net Sales (excl. GST)</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{formatINR(kpis.totalSales)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Cost of Goods Sold</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{formatINR(kpis.totalSales - kpis.grossProfit)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Gross Profit</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{formatINR(kpis.grossProfit)}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Margin: {formatPercent(kpis.grossProfitMargin)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Operating Expenses</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(kpis.totalExpenses)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Net Operating Profit</p>
                <p className={`text-2xl font-bold mt-1 ${kpis.netOperatingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatINR(kpis.netOperatingProfit)}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Operating Margin</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {formatPercent(kpis.totalSales > 0 ? (kpis.netOperatingProfit / kpis.totalSales) * 100 : 0)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => exportCSV('profitability-report.csv', [{
                  Metric: 'Net Sales', Value: kpis.totalSales.toString(),
                }, {
                  Metric: 'Cost of Goods Sold', Value: (kpis.totalSales - kpis.grossProfit).toString(),
                }, {
                  Metric: 'Gross Profit', Value: kpis.grossProfit.toString(),
                }, {
                  Metric: 'Gross Profit Margin %', Value: kpis.grossProfitMargin.toFixed(2),
                }, {
                  Metric: 'Operating Expenses', Value: kpis.totalExpenses.toString(),
                }, {
                  Metric: 'Net Operating Profit', Value: kpis.netOperatingProfit.toString(),
                }, {
                  Metric: 'Operating Margin %', Value: (kpis.totalSales > 0 ? (kpis.netOperatingProfit / kpis.totalSales) * 100 : 0).toFixed(2),
                }, {
                  Metric: 'Customer Outstanding', Value: kpis.customerOutstanding.toString(),
                }, {
                  Metric: 'Supplier Outstanding', Value: kpis.supplierOutstanding.toString(),
                }, {
                  Metric: 'Inventory Value', Value: kpis.inventoryValue.toString(),
                }])}
                className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
              >
                <Download size={16} /> Export to CSV
              </button>
            </div>
          </Card>

          <Card title="Notes on Profitability Calculations">
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
              <p><strong>Gross Profit</strong> = Net Sales (excluding GST) - Cost of Goods Sold.</p>
              <p><strong>Net Sales</strong> = Invoice subtotal - Discounts. GST is not counted as revenue (it is a pass-through tax).</p>
              <p><strong>Cost of Goods Sold</strong> = Quantity sold x Purchase cost per unit (weighted average cost method).</p>
              <p><strong>Operating Profit</strong> = Gross Profit - Operating Expenses. This is not net profit (does not account for tax or interest).</p>
              <p><strong>Discounts</strong> reduce net sales. <strong>GST</strong> is excluded from both revenue and expense as it is recoverable input tax credit.</p>
            </div>
          </Card>
        </div>
      )}

      {reportType === 'sales' && (
        <div className="space-y-6">
          <Card title="Sales by Category" actions={
            <button onClick={() => exportCSV('sales-by-category.csv', salesByCat.map((s) => ({ Category: s.name, Value: s.value })))}
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
              <Download size={16} /> Export
            </button>
          }>
            {salesByCat.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={salesByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => e.name}>
                    {salesByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, color: "#0f172a" }} formatter={(v: number) => formatINR(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 dark:text-slate-500 text-sm py-10 text-center">No data in selected period</p>}
          </Card>

          <Card title="Sales by Salesperson" actions={
            <button onClick={() => exportCSV('sales-by-salesperson.csv', salesByPerson.map((s) => ({ Salesperson: s.name, Sales: s.value })))}
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
              <Download size={16} /> Export
            </button>
          }>
            {salesByPerson.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salesByPerson}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, color: "#0f172a" }} formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="value" name="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 dark:text-slate-500 text-sm py-10 text-center">No data in selected period</p>}
          </Card>

          <Card title="Sales Invoice Register" actions={
            <button onClick={() => exportCSV('sales-register.csv', salesIn.map((s) => ({
              Invoice: s.invoice_no, Date: s.invoice_date, Customer: customerMap.get(s.customer_id)?.name ?? '-',
              Salesperson: s.salesperson ?? '-', Subtotal: s.subtotal, Discount: s.discount_amount,
              Total: s.total_amount, Paid: s.amount_paid, Outstanding: s.outstanding, Status: s.payment_status,
            })))}
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
              <Download size={16} /> Export
            </button>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 font-medium">Invoice</th><th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Customer</th><th className="py-2 font-medium">Salesperson</th>
                  <th className="py-2 text-right font-medium">Total</th><th className="py-2 text-right font-medium">Paid</th>
                  <th className="py-2 text-right font-medium">Outstanding</th>
                </tr></thead>
                <tbody>
                  {salesIn.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 dark:border-slate-700/70">
                      <td className="py-2 text-brand-700 font-medium">{s.invoice_no}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{formatDate(s.invoice_date)}</td>
                      <td className="py-2 text-slate-700 dark:text-slate-200">{customerMap.get(s.customer_id)?.name ?? '-'}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{s.salesperson ?? '-'}</td>
                      <td className="py-2 text-right">{formatINR(s.total_amount)}</td>
                      <td className="py-2 text-right text-emerald-600">{formatINR(s.amount_paid)}</td>
                      <td className="py-2 text-right text-rose-600">{formatINR(s.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {reportType === 'inventory' && (
        <Card title="Inventory Valuation Report" actions={
          <button onClick={() => exportCSV('inventory-valuation.csv', data.products.map((p) => ({
            SKU: p.sku, Name: p.name, Category: p.category, Brand: p.brand,
            Unit: p.unit, Stock: p.stock_qty, Cost: p.purchase_cost, StockValue: p.stock_qty * p.purchase_cost,
            SellingPrice: p.selling_price, SellingValue: p.stock_qty * p.selling_price, MinStock: p.min_stock,
            Status: p.stock_qty <= 0 ? 'Out of Stock' : p.stock_qty <= p.min_stock ? 'Low Stock' : 'OK',
          })))}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
            <Download size={16} /> Export
          </button>
        }>
          {inventoryDist.length > 0 && (
            <div className="mb-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={inventoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                    {inventoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, color: "#0f172a" }} formatter={(v: number) => formatINR(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="py-2 font-medium">SKU</th><th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium">Category</th><th className="py-2 text-right font-medium">Stock</th>
                <th className="py-2 text-right font-medium">Cost</th><th className="py-2 text-right font-medium">Stock Value</th>
              </tr></thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 dark:border-slate-700/70">
                    <td className="py-2 text-brand-700 font-medium">{p.sku}</td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">{p.name}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">{p.category}</td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-300">{p.stock_qty} {p.unit}</td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-300">{formatINR(p.purchase_cost)}</td>
                    <td className="py-2 text-right text-slate-700 dark:text-slate-200 font-medium">{formatINR(p.stock_qty * p.purchase_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {reportType === 'customer' && (
        <Card title="Customer Summary Report" actions={
          <button onClick={() => exportCSV('customer-summary.csv', topCustomers.map((c) => ({
            Code: c.code, Name: c.name, TotalSales: c.total, Outstanding: c.outstanding,
          })))}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
            <Download size={16} /> Export
          </button>
        }>
          {topCustomers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, color: "#0f172a" }} formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="total" name="Total Sales" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 dark:text-slate-500 text-sm py-10 text-center">No data in selected period</p>}
        </Card>
      )}

      {reportType === 'product' && (
        <Card title="Product Performance Report" actions={
          <button onClick={() => exportCSV('product-performance.csv', topProducts.map((p) => ({
            SKU: p.sku, Name: p.name, QtySold: p.qty, Revenue: p.revenue, Profit: p.profit,
            MarginPct: p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(2) : '0',
          })))}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
            <Download size={16} /> Export
          </button>
        }>
          {topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 font-medium">SKU</th><th className="py-2 font-medium">Product</th>
                  <th className="py-2 text-right font-medium">Qty Sold</th>
                  <th className="py-2 text-right font-medium">Revenue</th>
                  <th className="py-2 text-right font-medium">Profit</th>
                  <th className="py-2 text-right font-medium">Margin %</th>
                </tr></thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.sku} className="border-b border-slate-50 dark:border-slate-700/70">
                      <td className="py-2 text-brand-700 font-medium">{p.sku}</td>
                      <td className="py-2 text-slate-700 dark:text-slate-200">{p.name}</td>
                      <td className="py-2 text-right text-slate-600 dark:text-slate-300">{p.qty}</td>
                      <td className="py-2 text-right text-slate-700 dark:text-slate-200">{formatINR(p.revenue)}</td>
                      <td className="py-2 text-right text-emerald-600">{formatINR(p.profit)}</td>
                      <td className="py-2 text-right text-slate-600 dark:text-slate-300">{formatPercent(p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-slate-400 dark:text-slate-500 text-sm py-10 text-center">No data in selected period</p>}
        </Card>
      )}

      {reportType === 'salesperson-profitability' && (
        <Card title="Salesperson Profitability" actions={
          <button onClick={() => exportCSV('salesperson-profitability.csv', salespersonProfitability)}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
            <Download size={16} /> Export
          </button>
        }>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Profit is calculated from recorded sales line costs for invoices dated in the selected period. Names are taken from the salesperson value stored on each invoice.</p>
          {salespersonProfitability.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 font-medium">Salesperson</th><th className="py-2 text-right font-medium">Invoices</th><th className="py-2 text-right font-medium">Revenue</th><th className="py-2 text-right font-medium">Recorded Cost</th><th className="py-2 text-right font-medium">Gross Profit</th><th className="py-2 text-right font-medium">Margin</th>
                </tr></thead>
                <tbody>{salespersonProfitability.map((r) => (
                  <tr key={r.Salesperson} className="border-b border-slate-50 dark:border-slate-700/70">
                    <td className="py-2 font-medium text-slate-700 dark:text-slate-200">{r.Salesperson}</td><td className="py-2 text-right">{r.InvoiceCount}</td><td className="py-2 text-right">{formatINR(r.Revenue)}</td><td className="py-2 text-right">{formatINR(r.RecordedCost)}</td><td className={`py-2 text-right font-medium ${r.GrossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatINR(r.GrossProfit)}</td><td className="py-2 text-right">{formatPercent(r.MarginPct)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="text-slate-400 dark:text-slate-500 text-sm py-10 text-center">No invoice line data in the selected period.</p>}
        </Card>
      )}

      {reportType === 'invoice-profitability' && (
        <Card title="Invoice Profitability Register" actions={
          <button onClick={() => exportCSV('invoice-profitability-register.csv', invoiceProfitability)}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
            <Download size={16} /> Export
          </button>
        }>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">This report uses line-level revenue and recorded cost. Invoices without sales line items are not included in the profitability rows.</p>
          {invoiceProfitability.length ? (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="py-2 font-medium">Invoice</th><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Customer</th><th className="py-2 font-medium">Salesperson</th><th className="py-2 text-right font-medium">Revenue</th><th className="py-2 text-right font-medium">Cost</th><th className="py-2 text-right font-medium">Profit</th><th className="py-2 text-right font-medium">Margin</th>
              </tr></thead>
              <tbody>{invoiceProfitability.map((r) => (
                <tr key={r.Invoice} className="border-b border-slate-50 dark:border-slate-700/70">
                  <td className="py-2 font-medium text-brand-700">{r.Invoice}</td><td className="py-2">{formatDate(r.Date)}</td><td className="py-2">{r.Customer}</td><td className="py-2">{r.Salesperson}</td><td className="py-2 text-right">{formatINR(r.Revenue)}</td><td className="py-2 text-right">{formatINR(r.RecordedCost)}</td><td className={`py-2 text-right font-medium ${r.GrossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatINR(r.GrossProfit)}</td><td className="py-2 text-right">{formatPercent(r.MarginPct)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <p className="text-slate-400 dark:text-slate-500 text-sm py-10 text-center">No invoice line data in the selected period.</p>}
        </Card>
      )}
    </PageContainer>
  );
}
