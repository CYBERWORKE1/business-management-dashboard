import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Search, Package, AlertTriangle, TrendingDown } from 'lucide-react';
import { useData } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatINR, formatNumber } from '@/lib/format';
import type { Product } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, Label, LoadingState, Modal, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

const CATEGORIES = ['PVC', 'CPVC', 'UPVC', 'HDPE', 'GI', 'MS'];
const UNITS = ['piece', 'metre', 'roll', 'kilogram'];

export function InventoryPage() {
  const data = useData();
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  // Read the signed-in user's role. The database RLS policies remain the
  // actual security boundary; this role check only controls which UI is shown.
  useEffect(() => {
    let active = true;

    async function loadRole() {
      setRoleLoading(true);
      try {
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userResult.user;
        if (!user) {
          if (active) setIsAdmin(false);
          return;
        }

        const { data: roleRow, error: roleError } = await supabase
          .from('app_user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError) throw roleError;
        if (active) setIsAdmin(roleRow?.role === 'admin');
      } catch (error) {
        console.error('Unable to verify inventory permissions:', error);
        if (active) setIsAdmin(false);
      } finally {
        if (active) setRoleLoading(false);
      }
    }

    loadRole();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      // Let Supabase finish its auth event before querying the role table.
      Promise.resolve().then(() => {
        if (active) loadRole();
      });
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const supplierMap = useMemo(() => new Map(data.suppliers.map((s) => [s.id, s])), [data.suppliers]);

  const filtered = useMemo(() => {
    return data.products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.diameter ?? '').toLowerCase().includes(q) || (p.length ?? '').toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchStock = stockFilter === 'all' || (stockFilter === 'low' && p.stock_qty <= p.min_stock) || (stockFilter === 'out' && p.stock_qty <= 0);
      return matchSearch && matchCat && matchStock;
    });
  }, [data.products, search, categoryFilter, stockFilter]);

  const totalValue = useMemo(() => data.products.reduce((s, p) => s + p.stock_qty * p.purchase_cost, 0), [data.products]);
  const totalSellingValue = useMemo(() => data.products.reduce((s, p) => s + p.stock_qty * p.selling_price, 0), [data.products]);
  const lowStockCount = useMemo(() => data.products.filter((p) => p.stock_qty <= p.min_stock).length, [data.products]);

  return (
    <PageContainer>
      <PageHeader
        title="Inventory / Stock"
        subtitle="Manage pipe products and stock levels"
        actions={
          isAdmin && !roleLoading ? (
            <Button onClick={() => { setEditProduct(null); setShowForm(true); }}>
              <Plus size={18} /> Add Product
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Inventory Value (Cost)</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{formatINR(totalValue, { compact: true })}</p>
            </div>
            <Package className="text-brand-600" size={24} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Selling Value</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{formatINR(totalSellingValue, { compact: true })}</p>
            </div>
            <TrendingDown className="text-emerald-600" size={24} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Low-Stock Products</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{lowStockCount}</p>
            </div>
            <AlertTriangle className="text-amber-600" size={24} />
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search SKU or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
        </div>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="max-w-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="max-w-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
          <option value="all">All Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </Select>
      </div>

      <Card>
        {data.loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message="No products found" icon={<Package size={32} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-700 dark:text-slate-200">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 font-medium">SKU</th>
                  <th className="py-3 font-medium">Product</th>
                  <th className="py-3 font-medium">Category</th>
                  <th className="py-3 font-medium">Brand</th>
                  <th className="py-3 font-medium">Size</th>
                  <th className="py-3 text-right font-medium">Cost</th>
                  <th className="py-3 text-right font-medium">Price</th>
                  <th className="py-3 text-right font-medium">Stock</th>
                  <th className="py-3 text-right font-medium">Value</th>
                  <th className="py-3 text-center font-medium">Status</th>
                  {isAdmin && !roleLoading && (
                    <th className="py-3 text-center font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isLow = p.stock_qty <= p.min_stock;
                  const isOut = p.stock_qty <= 0;
                  return (
                    <tr key={p.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70">
                      <td className="py-3 font-medium text-brand-700">{p.sku}</td>
                      <td className="py-3 text-slate-700 dark:text-slate-200">{p.name}</td>
                      <td className="py-3"><Badge tone="info">{p.category}</Badge></td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{p.brand}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{[p.diameter, p.length].filter(Boolean).join(' × ') || '-'}</td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-300">{formatINR(p.purchase_cost)}</td>
                      <td className="py-3 text-right text-slate-700 dark:text-slate-200">{formatINR(p.selling_price)}</td>
                      <td className={`py-3 text-right font-medium ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}`}>
                        {formatNumber(p.stock_qty, 3)} {p.unit}
                      </td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-300">{formatINR(p.stock_qty * p.purchase_cost)}</td>
                      <td className="py-3 text-center">
                        {isOut ? <Badge tone="negative">Out</Badge> : isLow ? <Badge tone="warning">Low</Badge> : <Badge tone="positive">OK</Badge>}
                      </td>
                      {isAdmin && !roleLoading && (
                        <td className="py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setEditProduct(p); setShowForm(true); }}
                              className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded"
                              title="Edit product"
                              aria-label={`Edit ${p.name}`}
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => setAdjustProduct(p)}
                              className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-700 rounded text-xs font-medium"
                              title="Adjust Stock"
                            >
                              Adjust
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isAdmin && !roleLoading && showForm && (
        <ProductForm
          editProduct={editProduct}
          suppliers={data.suppliers}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
          onSaved={() => data.refresh()}
        />
      )}

      {isAdmin && !roleLoading && adjustProduct && (
        <StockAdjustForm
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSaved={() => data.refresh()}
        />
      )}
    </PageContainer>
  );
}

function ProductForm({ editProduct, suppliers, onClose, onSaved }: {
  editProduct: Product | null;
  suppliers: { id: string; name: string; supplier_code: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    sku: editProduct?.sku ?? '',
    name: editProduct?.name ?? '',
    category: editProduct?.category ?? 'PVC',
    brand: editProduct?.brand ?? '',
    diameter: editProduct?.diameter ?? '',
    length: editProduct?.length ?? '',
    pressure_rating: editProduct?.pressure_rating ?? '',
    unit: editProduct?.unit ?? 'piece',
    purchase_cost: editProduct?.purchase_cost.toString() ?? '0',
    selling_price: editProduct?.selling_price.toString() ?? '0',
    stock_qty: editProduct?.stock_qty.toString() ?? '0',
    min_stock: editProduct?.min_stock.toString() ?? '0',
    supplier_id: editProduct?.supplier_id ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    if (!form.sku.trim() || !form.name.trim()) { setError('SKU and name are required'); return; }
    setSaving(true);
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        category: form.category,
        brand: form.brand,
        diameter: form.diameter || null,
        length: form.length || null,
        pressure_rating: form.pressure_rating || null,
        unit: form.unit,
        purchase_cost: parseFloat(form.purchase_cost) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        stock_qty: parseFloat(form.stock_qty) || 0,
        min_stock: parseFloat(form.min_stock) || 0,
        supplier_id: form.supplier_id || null,
      };
      if (editProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={editProduct ? 'Edit Product' : 'Add Product'} size="lg">
      <div className="space-y-4">
        {error && <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SKU / Product Code</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          <div><Label>Product Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Category</Label><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
          <div><Label>Brand</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
          <div><Label>Diameter / Size</Label><Input value={form.diameter} onChange={(e) => setForm({ ...form, diameter: e.target.value })} placeholder="e.g. 25mm" /></div>
          <div><Label>Length</Label><Input value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} placeholder="e.g. 6m" /></div>
          <div><Label>Pressure Rating / Grade</Label><Input value={form.pressure_rating} onChange={(e) => setForm({ ...form, pressure_rating: e.target.value })} placeholder="e.g. 4kg/cm2" /></div>
          <div><Label>Unit</Label><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></div>
          <div><Label>Purchase Cost (₹)</Label><Input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} /></div>
          <div><Label>Selling Price (₹)</Label><Input type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} /></div>
          <div><Label>Current Stock</Label><Input type="number" min="0" step="0.001" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} disabled={!!editProduct} /></div>
          <div><Label>Min Stock / Reorder Level</Label><Input type="number" min="0" step="0.001" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></div>
          <div className="col-span-2"><Label>Supplier</Label><Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}><option value="">No supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function StockAdjustForm({ product, onClose, onSaved }: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('Stock count adjustment');
  const [override, setOverride] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const adjValue = parseFloat(adjustment) || 0;
  const newStock = product.stock_qty + adjValue;
  const willBeNegative = newStock < 0;

  async function save() {
    setError('');
    if (adjValue === 0) { setError('Enter a non-zero adjustment'); return; }
    if (willBeNegative && !override) { setError('Stock would go negative. Check override to allow.'); return; }
    setSaving(true);
    try {
      const { error: e1 } = await supabase.from('products').update({ stock_qty: newStock }).eq('id', product.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('stock_movements').insert({
        product_id: product.id,
        movement_date: new Date().toISOString().slice(0, 10),
        movement_type: adjValue > 0 ? 'adjustment_in' : 'adjustment_out',
        quantity: adjValue,
        balance_after: newStock,
        reference_type: 'adjustment',
        reference_id: 'manual',
        notes: reason,
      });
      if (e2) throw e2;
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Adjust Stock - ${product.sku}`} size="sm">
      <div className="space-y-4">
        {error && <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm text-slate-800 dark:text-slate-100">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Current Stock</span><span className="font-medium">{formatNumber(product.stock_qty, 3)} {product.unit}</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Min Stock</span><span>{formatNumber(product.min_stock, 3)} {product.unit}</span></div>
        </div>
        <div><Label>Adjustment (+/-)</Label><Input type="number" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} placeholder="e.g. 10 or -5" /></div>
        <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500 dark:text-slate-400">New Stock Level:</span>
          <span className={`font-bold ${willBeNegative ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'}`}>{formatNumber(newStock, 3)} {product.unit}</span>
        </div>
        {willBeNegative && (
          <label className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-2">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Authorize negative stock override
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Apply Adjustment'}</Button>
        </div>
      </div>
    </Modal>
  );
}
