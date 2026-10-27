import type { Product, Customer, Supplier, SalesInvoice, SalesInvoiceItem, Purchase, PurchaseItem, Payment, Expense } from '@/lib/types';
import type { DateRange } from '@/lib/dateRanges';
import { dateInRange } from '@/lib/dateRanges';

export type KpiData = {
  totalSales: number;
  totalPurchase: number;
  grossProfit: number;
  grossProfitMargin: number;
  totalExpenses: number;
  netOperatingProfit: number;
  customerOutstanding: number;
  supplierOutstanding: number;
  inventoryValue: number;
  lowStockCount: number;
};

export function computeKpis(
  products: Product[],
  salesInvoices: SalesInvoice[],
  salesItems: SalesInvoiceItem[],
  purchases: Purchase[],
  purchaseItems: PurchaseItem[],
  expenses: Expense[],
  payments: Payment[],
  range: DateRange,
): KpiData {
  const salesIn = salesInvoices.filter((s) => dateInRange(s.invoice_date, range));
  const purIn = purchases.filter((p) => dateInRange(p.invoice_date, range));
  const expIn = expenses.filter((e) => dateInRange(e.expense_date, range));
  const payIn = payments.filter((p) => dateInRange(p.payment_date, range));

  const totalSales = salesIn.reduce((sum, s) => sum + (s.subtotal - s.discount_amount), 0);
  const totalPurchase = purIn.reduce((sum, p) => sum + p.subtotal, 0);

  const saleIds = new Set(salesIn.map((s) => s.id));
  const itemsIn = salesItems.filter((i) => saleIds.has(i.invoice_id));
  const cogs = itemsIn.reduce((sum, i) => sum + i.line_cogs, 0);
  const grossProfit = totalSales - cogs;
  const grossProfitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

  const totalExpenses = expIn.reduce((sum, e) => sum + e.amount, 0);
  const netOperatingProfit = grossProfit - totalExpenses;

  const customerOutstanding = salesInvoices.reduce((sum, s) => sum + s.outstanding, 0);
  const supplierOutstanding = purchases.reduce((sum, p) => sum + p.outstanding, 0);

  const inventoryValue = products.reduce((sum, p) => sum + p.stock_qty * p.purchase_cost, 0);
  const lowStockCount = products.filter((p) => p.stock_qty <= p.min_stock).length;

  void payIn;
  return {
    totalSales,
    totalPurchase,
    grossProfit,
    grossProfitMargin,
    totalExpenses,
    netOperatingProfit,
    customerOutstanding,
    supplierOutstanding,
    inventoryValue,
    lowStockCount,
  };
}

export function computeSalesTrend(
  salesInvoices: SalesInvoice[],
  range: DateRange,
): { label: string; sales: number; purchase: number; profit: number }[] {
  const inRange = salesInvoices.filter((s) => dateInRange(s.invoice_date, range));
  const byMonth: Record<string, { sales: number }> = {};

  for (const s of inRange) {
    const d = new Date(s.invoice_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = { sales: (byMonth[key]?.sales ?? 0) + (s.subtotal - s.discount_amount) };
  }

  return Object.keys(byMonth).sort().map((key) => {
    const [yr, mo] = key.split('-');
    const label = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    return { label, sales: byMonth[key].sales, purchase: 0, profit: 0 };
  });
}

export function computeSalesVsPurchases(
  salesInvoices: SalesInvoice[],
  purchases: Purchase[],
  range: DateRange,
): { label: string; sales: number; purchase: number }[] {
  const salesIn = salesInvoices.filter((s) => dateInRange(s.invoice_date, range));
  const purIn = purchases.filter((p) => dateInRange(p.invoice_date, range));
  const byMonth: Record<string, { sales: number; purchase: number }> = {};

  for (const s of salesIn) {
    const d = new Date(s.invoice_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { sales: 0, purchase: 0 };
    byMonth[key].sales += s.subtotal - s.discount_amount;
  }
  for (const p of purIn) {
    const d = new Date(p.invoice_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { sales: 0, purchase: 0 };
    byMonth[key].purchase += p.subtotal;
  }

  return Object.keys(byMonth).sort().map((key) => {
    const [yr, mo] = key.split('-');
    const label = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    return { label, sales: byMonth[key].sales, purchase: byMonth[key].purchase };
  });
}

export function computeSalesByCategory(
  salesInvoices: SalesInvoice[],
  salesItems: SalesInvoiceItem[],
  products: Product[],
  range: DateRange,
): { name: string; value: number }[] {
  const saleIds = new Set(salesInvoices.filter((s) => dateInRange(s.invoice_date, range)).map((s) => s.id));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const itemsIn = salesItems.filter((i) => saleIds.has(i.invoice_id));
  const byCat: Record<string, number> = {};

  for (const item of itemsIn) {
    const product = productMap.get(item.product_id);
    const cat = product?.category ?? 'Other';
    byCat[cat] = (byCat[cat] ?? 0) + item.line_total;
  }

  return Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function computeTopProducts(
  salesInvoices: SalesInvoice[],
  salesItems: SalesInvoiceItem[],
  products: Product[],
  range: DateRange,
  limit = 10,
): { sku: string; name: string; qty: number; revenue: number; profit: number }[] {
  const saleIds = new Set(salesInvoices.filter((s) => dateInRange(s.invoice_date, range)).map((s) => s.id));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const itemsIn = salesItems.filter((i) => saleIds.has(i.invoice_id));
  const byProd: Record<string, { qty: number; revenue: number; profit: number }> = {};

  for (const item of itemsIn) {
    const key = item.product_id;
    if (!byProd[key]) byProd[key] = { qty: 0, revenue: 0, profit: 0 };
    byProd[key].qty += item.quantity;
    byProd[key].revenue += item.line_total;
    byProd[key].profit += item.line_total - item.line_cogs;
  }

  return Object.entries(byProd)
    .map(([pid, v]) => ({
      sku: productMap.get(pid)?.sku ?? '-',
      name: productMap.get(pid)?.name ?? '-',
      qty: v.qty,
      revenue: v.revenue,
      profit: v.profit,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function computeTopCustomers(
  salesInvoices: SalesInvoice[],
  customers: Customer[],
  range: DateRange,
  limit = 10,
): { code: string; name: string; total: number; outstanding: number }[] {
  const inRange = salesInvoices.filter((s) => dateInRange(s.invoice_date, range));
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const byCust: Record<string, { total: number; outstanding: number }> = {};

  for (const s of inRange) {
    if (!byCust[s.customer_id]) byCust[s.customer_id] = { total: 0, outstanding: 0 };
    byCust[s.customer_id].total += s.subtotal - s.discount_amount;
    byCust[s.customer_id].outstanding += s.outstanding;
  }

  return Object.entries(byCust)
    .map(([cid, v]) => ({
      code: customerMap.get(cid)?.customer_code ?? '-',
      name: customerMap.get(cid)?.name ?? '-',
      total: v.total,
      outstanding: v.outstanding,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function computeSalesByPerson(
  salesInvoices: SalesInvoice[],
  range: DateRange,
): { name: string; value: number }[] {
  const inRange = salesInvoices.filter((s) => dateInRange(s.invoice_date, range));
  const byPerson: Record<string, number> = {};
  for (const s of inRange) {
    const p = s.salesperson ?? 'Unassigned';
    byPerson[p] = (byPerson[p] ?? 0) + (s.subtotal - s.discount_amount);
  }
  return Object.entries(byPerson).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function computePaymentTrends(
  payments: Payment[],
  range: DateRange,
): { label: string; receipts: number; payments: number }[] {
  const inRange = payments.filter((p) => dateInRange(p.payment_date, range));
  const byMonth: Record<string, { receipts: number; payments: number }> = {};

  for (const p of inRange) {
    const d = new Date(p.payment_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { receipts: 0, payments: 0 };
    if (p.party_type === 'customer') byMonth[key].receipts += p.amount;
    else byMonth[key].payments += p.amount;
  }

  return Object.keys(byMonth).sort().map((key) => {
    const [yr, mo] = key.split('-');
    const label = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    return { label, receipts: byMonth[key].receipts, payments: byMonth[key].payments };
  });
}

export function computeInventoryDistribution(products: Product[]): { name: string; value: number }[] {
  const byCat: Record<string, number> = {};
  for (const p of products) {
    byCat[p.category] = (byCat[p.category] ?? 0) + p.stock_qty * p.purchase_cost;
  }
  return Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function computeGrossProfitTrend(
  salesInvoices: SalesInvoice[],
  salesItems: SalesInvoiceItem[],
  range: DateRange,
): { label: string; profit: number; margin: number }[] {
  const inRange = salesInvoices.filter((s) => dateInRange(s.invoice_date, range));
  const saleIds = new Set(inRange.map((s) => s.id));
  const itemsIn = salesItems.filter((i) => saleIds.has(i.invoice_id));
  const itemsByInvoice = new Map<string, SalesInvoiceItem[]>();

  for (const item of itemsIn) {
    if (!itemsByInvoice.has(item.invoice_id)) itemsByInvoice.set(item.invoice_id, []);
    itemsByInvoice.get(item.invoice_id)!.push(item);
  }

  const byMonth: Record<string, { sales: number; profit: number }> = {};
  for (const s of inRange) {
    const d = new Date(s.invoice_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { sales: 0, profit: 0 };
    const netSales = s.subtotal - s.discount_amount;
    const cogs = (itemsByInvoice.get(s.id) ?? []).reduce((sum, i) => sum + i.line_cogs, 0);
    byMonth[key].sales += netSales;
    byMonth[key].profit += netSales - cogs;
  }

  return Object.keys(byMonth).sort().map((key) => {
    const [yr, mo] = key.split('-');
    const label = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const { sales, profit } = byMonth[key];
    const margin = sales > 0 ? (profit / sales) * 100 : 0;
    return { label, profit, margin };
  });
}

export function computeCustomerOutstanding(salesInvoices: SalesInvoice[], customers: Customer[]) {
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  return salesInvoices
    .filter((s) => s.outstanding > 0)
    .map((s) => ({
      invoice_no: s.invoice_no,
      invoice_date: s.invoice_date,
      due_date: s.due_date,
      customer_name: customerMap.get(s.customer_id)?.name ?? '-',
      customer_code: customerMap.get(s.customer_id)?.customer_code ?? '-',
      total_amount: s.total_amount,
      amount_paid: s.amount_paid,
      outstanding: s.outstanding,
    }))
    .sort((a, b) => new Date(a.due_date ?? a.invoice_date).getTime() - new Date(b.due_date ?? b.invoice_date).getTime());
}

export function computeSupplierOutstanding(purchases: Purchase[], suppliers: Supplier[]) {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  return purchases
    .filter((p) => p.outstanding > 0)
    .map((p) => ({
      invoice_no: p.invoice_no,
      invoice_date: p.invoice_date,
      due_date: p.due_date,
      supplier_name: supplierMap.get(p.supplier_id)?.name ?? '-',
      supplier_code: supplierMap.get(p.supplier_id)?.supplier_code ?? '-',
      total_amount: p.total_amount,
      amount_paid: p.amount_paid,
      outstanding: p.outstanding,
    }))
    .sort((a, b) => new Date(a.due_date ?? a.invoice_date).getTime() - new Date(b.due_date ?? b.invoice_date).getTime());
}

export function ageingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'Not due';
  if (daysOverdue <= 30) return '1-30 days';
  if (daysOverdue <= 60) return '31-60 days';
  if (daysOverdue <= 90) return '61-90 days';
  return '90+ days';
}

export function daysOverdue(dueDate: string | null, asOf = new Date()): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const now = new Date(asOf);
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}
