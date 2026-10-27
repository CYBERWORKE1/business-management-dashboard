export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  diameter: string | null;
  length: string | null;
  pressure_rating: string | null;
  unit: string;
  purchase_cost: number;
  selling_price: number;
  stock_qty: number;
  min_stock: number;
  supplier_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Customer = {
  id: string;
  customer_code: string;
  name: string;
  phone: string | null;
  city: string | null;
  business_type: string | null;
  credit_limit: number;
  created_at?: string;
  updated_at?: string;
};

export type Supplier = {
  id: string;
  supplier_code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
  products_supplied: string | null;
  payment_terms: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SalesInvoice = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  customer_id: string;
  salesperson: string | null;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  payment_status: string;
  due_date: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type SalesInvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string;
  sku: string;
  description: string | null;
  quantity: number;
  unit: string;
  selling_price: number;
  unit_cost: number;
  discount_amount: number;
  gst_amount: number;
  line_total: number;
  line_cogs: number;
};

export type Purchase = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  supplier_id: string;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  due_date: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_id: string;
  sku: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_cost: number;
  line_total: number;
};

export type Payment = {
  id: string;
  payment_date: string;
  party_type: 'customer' | 'supplier';
  party_id: string;
  invoice_id: string | null;
  amount: number;
  payment_method: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at?: string;
};

export type Expense = {
  id: string;
  expense_id: string | null;
  expense_date: string;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  payment_method: string | null;
  created_at?: string;
};

export type StockMovement = {
  id: string;
  product_id: string;
  movement_date: string;
  movement_type: string;
  quantity: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at?: string;
};

export type SalesInvoiceWithRelations = SalesInvoice & {
  customers?: { name: string; customer_code: string };
  sales_invoice_items?: SalesInvoiceItem[];
};

export type PurchaseWithRelations = Purchase & {
  suppliers?: { name: string; supplier_code: string };
  purchase_items?: PurchaseItem[];
};
