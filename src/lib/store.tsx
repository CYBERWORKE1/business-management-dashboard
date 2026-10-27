import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Customer, Supplier, SalesInvoice, SalesInvoiceItem, Purchase, PurchaseItem, Payment, Expense, StockMovement } from '@/lib/types';

type DataContextType = {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  salesInvoices: SalesInvoice[];
  salesItems: SalesInvoiceItem[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  payments: Payment[];
  expenses: Expense[];
  stockMovements: StockMovement[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [salesItems, setSalesItems] = useState<SalesInvoiceItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        productsRes, customersRes, suppliersRes,
        salesRes, salesItemsRes,
        purchasesRes, purchaseItemsRes,
        paymentsRes, expensesRes, stockRes,
      ] = await Promise.all([
        supabase.from('products').select('*').order('sku'),
        supabase.from('customers').select('*').order('customer_code'),
        supabase.from('suppliers').select('*').order('supplier_code'),
        supabase.from('sales_invoices').select('*').order('invoice_date', { ascending: false }),
        supabase.from('sales_invoice_items').select('*'),
        supabase.from('purchases').select('*').order('invoice_date', { ascending: false }),
        supabase.from('purchase_items').select('*'),
        supabase.from('payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
        supabase.from('stock_movements').select('*').order('movement_date', { ascending: false }),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (customersRes.error) throw customersRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (salesRes.error) throw salesRes.error;
      if (salesItemsRes.error) throw salesItemsRes.error;
      if (purchasesRes.error) throw purchasesRes.error;
      if (purchaseItemsRes.error) throw purchaseItemsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (stockRes.error) throw stockRes.error;

      setProducts(productsRes.data ?? []);
      setCustomers(customersRes.data ?? []);
      setSuppliers(suppliersRes.data ?? []);
      setSalesInvoices(salesRes.data ?? []);
      setSalesItems(salesItemsRes.data ?? []);
      setPurchases(purchasesRes.data ?? []);
      setPurchaseItems(purchaseItemsRes.data ?? []);
      setPayments(paymentsRes.data ?? []);
      setExpenses(expensesRes.data ?? []);
      setStockMovements(stockRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <DataContext.Provider value={{
      products, customers, suppliers, salesInvoices, salesItems,
      purchases, purchaseItems, payments, expenses, stockMovements,
      loading, error, refresh,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
