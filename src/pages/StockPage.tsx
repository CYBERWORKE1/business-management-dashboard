import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Plus, Search, Edit, Trash2, Package, ImagePlus, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINR, formatNumber } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Input, Label, LoadingState, Modal, Select } from '@/components/ui';
import { PageContainer, PageHeader } from '@/components/Layout';

type StockProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  diameter: string | null;
  length: string | null;
  pressure_rating: string | null;
  specification: string | null;
  image_url: string | null;
  unit: string;
  purchase_cost: number;
  selling_price: number;
  stock_qty: number;
  min_stock: number;
  supplier_id: string | null;
};

const UNITS = ['piece', 'litre', 'metre', 'roll', 'kilogram', 'set', 'box', 'bag', 'other'];
const CATEGORIES = ['PVC', 'CPVC', 'UPVC', 'HDPE', 'GI', 'MS', 'Tank', 'Fittings', 'Other'];
const BUCKET = 'product-images';

export function StockPage() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StockProduct | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function checkRole() {
      setRoleLoading(true);

      const { data: userResult } = await supabase.auth.getUser();
      const user = userResult.user;

      if (!user) {
        if (mounted) {
          setIsAdmin(false);
          setRoleLoading(false);
        }
        return;
      }

      const { data: roleRow, error: roleError } = await supabase
        .from('app_user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (mounted) {
        setIsAdmin(!roleError && roleRow?.role === 'admin');
        setRoleLoading(false);
      }
    }

    void checkRole();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void checkRole();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('products')
        .select(
          'id, sku, name, category, brand, diameter, length, pressure_rating, specification, image_url, unit, purchase_cost, selling_price, stock_qty, min_stock, supplier_id'
        )
        .order('name');

      if (!mounted) return;

      if (queryError) {
        setError(
          `Could not load stock catalogue: ${queryError.message}. Run the stock catalogue SQL migration first.`
        );
      } else {
        setProducts((data ?? []) as StockProduct[]);
      }

      setLoading(false);
    }

    void loadProducts();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const reorderItems = useMemo(
    () =>
      products
        .filter(
          (p) => Number(p.stock_qty || 0) <= Number(p.min_stock || 0)
        )
        .map((p) => ({
          ...p,
          suggestedQty: Math.max(
            0,
            Number(p.min_stock || 0) * 2 - Number(p.stock_qty || 0)
          ),
        }))
        .sort(
          (a, b) =>
            Number(a.stock_qty) -
            Number(a.min_stock) -
            (Number(b.stock_qty) - Number(b.min_stock))
        ),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter(
      (p) =>
        !q ||
        [
          p.sku,
          p.name,
          p.brand,
          p.category,
          p.specification,
          p.diameter,
          p.length,
        ].some((v) => (v ?? '').toLowerCase().includes(q))
    );
  }, [products, search]);

  async function deleteProduct(product: StockProduct) {
    const confirmed = window.confirm(
      `Delete “${product.name}” (${product.sku})? If this product is referenced by past invoices or stock movements, the database may block deletion to protect history.`
    );

    if (!confirmed) return;

    setError('');

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    if (deleteError) {
      setError(
        `Could not delete ${product.name}: ${deleteError.message}. If it has invoice or stock history, keep it and edit the item instead.`
      );
      return;
    }

    setRefreshKey((v) => v + 1);
  }

  const totalQuantity = products.reduce(
    (sum, p) => sum + Number(p.stock_qty || 0),
    0
  );

  const totalStockValue = products.reduce(
    (sum, p) =>
      sum +
      Number(p.stock_qty || 0) * Number(p.purchase_cost || 0),
    0
  );

  return (
    <PageContainer>
      <PageHeader
        title="Stock Catalogue"
        subtitle="Manage product names, specifications, prices, quantities and product photos"
        actions={
          isAdmin && !roleLoading ? (
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus size={18} /> Add Item
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Catalogue items
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {products.length}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Total quantity
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {formatNumber(totalQuantity, 3)}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Stock value at cost
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(totalStockValue)}
          </p>
        </Card>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="mb-4 mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, brand or specification..."
          />
        </div>

        <Button
          variant="secondary"
          onClick={() => setRefreshKey((v) => v + 1)}
        >
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No stock items found"
          description={
            search
              ? 'Try another search.'
              : 'Add your first product using Add Item.'
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700 dark:text-slate-300">
                  <th className="py-3 pr-3">Image</th>
                  <th className="py-3 pr-3">Item / Code</th>
                  <th className="py-3 pr-3">Specification</th>
                  <th className="py-3 pr-3 text-right">Price</th>
                  <th className="py-3 pr-3 text-right">Quantity</th>
                  <th className="py-3 pr-3">Status</th>
                  {isAdmin && (
                    <th className="py-3 text-right">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                  >
                    <td className="py-3 pr-3">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-14 w-14 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                          <Package size={22} />
                        </div>
                      )}
                    </td>

                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {p.sku}
                        {p.brand ? ` · ${p.brand}` : ''}
                        {p.category ? ` · ${p.category}` : ''}
                      </div>
                    </td>

                    <td className="py-3 pr-3 text-slate-700 dark:text-slate-200">
                      {p.specification ||
                        [
                          p.diameter,
                          p.length,
                          p.pressure_rating,
                        ]
                          .filter(Boolean)
                          .join(' · ') ||
                        '—'}
                    </td>

                    <td className="py-3 pr-3 text-right">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {formatINR(Number(p.selling_price || 0))}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Cost {formatINR(Number(p.purchase_cost || 0))}
                      </div>
                    </td>

                    <td className="py-3 pr-3 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatNumber(Number(p.stock_qty || 0), 3)} {p.unit}
                    </td>

                    <td className="py-3 pr-3">
                      {Number(p.stock_qty) <= 0 ? (
                        <Badge tone="negative">Out</Badge>
                      ) : Number(p.stock_qty) <= Number(p.min_stock) ? (
                        <Badge tone="warning">Low</Badge>
                      ) : (
                        <Badge tone="positive">In stock</Badge>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(p);
                              setShowForm(true);
                            }}
                          >
                            <Edit size={14} /> Edit
                          </Button>

                          <button
                            type="button"
                            onClick={() => void deleteProduct(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <StockItemForm
          product={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setRefreshKey((v) => v + 1);
          }}
        />
      )}

      {!isAdmin && !roleLoading && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          View-only access: only Admins can add, edit or delete stock catalogue items.
        </p>
      )}
    </PageContainer>
  );
}

function StockItemForm({
  product,
  onClose,
  onSaved,
}: {
  product: StockProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    category: product?.category ?? 'Other',
    brand: product?.brand ?? '',
    specification: product?.specification ?? '',
    unit: product?.unit ?? 'piece',
    stock_qty: String(product?.stock_qty ?? 0),
    purchase_cost: String(product?.purchase_cost ?? 0),
    selling_price: String(product?.selling_price ?? 0),
    min_stock: String(product?.min_stock ?? 0),
    image_url: product?.image_url ?? '',
    diameter: product?.diameter ?? '',
    length: product?.length ?? '',
    pressure_rating: product?.pressure_rating ?? '',
  });

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(product?.image_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    if (!chosen) return;

    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
        chosen.type
      )
    ) {
      setError('Please choose a JPG, PNG, WEBP or GIF image.');
      return;
    }

    if (chosen.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }

    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setError('');
  }

  async function save() {
    setError('');

    if (!form.sku.trim() || !form.name.trim()) {
      setError('Item code and name are required.');
      return;
    }

    setSaving(true);

    try {
      let imageUrl = form.image_url || null;

      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw new Error(
            `Image upload failed: ${uploadError.message}. Run the stock catalogue SQL migration and check storage permissions.`
          );
        }

        imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category || 'Other',
        brand: form.brand.trim(),
        specification: form.specification.trim() || null,
        image_url: imageUrl,
        unit: form.unit,
        stock_qty: Math.max(0, Number(form.stock_qty) || 0),
        purchase_cost: Math.max(0, Number(form.purchase_cost) || 0),
        selling_price: Math.max(0, Number(form.selling_price) || 0),
        min_stock: Math.max(0, Number(form.min_stock) || 0),
        diameter: form.diameter.trim() || null,
        length: form.length.trim() || null,
        pressure_rating: form.pressure_rating.trim() || null,
      };

      const result = product
        ? await supabase.from('products').update(payload).eq('id', product.id)
        : await supabase.from('products').insert(payload);

      if (result.error) throw result.error;

      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save item.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Edit Stock Item' : 'Add Stock Item'}
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Item Code / SKU *</Label>
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="e.g. P014"
            />
          </div>

          <div>
            <Label>Item Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. PVC Water Tank"
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Brand</Label>
            <Input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder="Brand (optional)"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Specification</Label>
            <Input
              value={form.specification}
              onChange={(e) =>
                setForm({ ...form, specification: e.target.value })
              }
              placeholder="e.g. 5 inch pipe, 5 L tank, 10 kg bag"
            />
            <p className="mt-1 text-xs text-slate-500">
              Free text, so it can describe pipes, tanks, fittings, or other items.
            </p>
          </div>

          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={form.stock_qty}
              onChange={(e) =>
                setForm({ ...form, stock_qty: e.target.value })
              }
            />
          </div>

          <div>
            <Label>Quantity Unit</Label>
            <Select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Selling Price (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.selling_price}
              onChange={(e) =>
                setForm({ ...form, selling_price: e.target.value })
              }
            />
          </div>

          <div>
            <Label>Purchase Cost (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.purchase_cost}
              onChange={(e) =>
                setForm({ ...form, purchase_cost: e.target.value })
              }
            />
          </div>

          <div>
            <Label>Minimum Stock Alert</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={form.min_stock}
              onChange={(e) =>
                setForm({ ...form, min_stock: e.target.value })
              }
            />
          </div>

          <div>
            <Label>Legacy pipe size (optional)</Label>
            <Input
              value={form.diameter}
              onChange={(e) =>
                setForm({ ...form, diameter: e.target.value })
              }
              placeholder="e.g. 25 mm"
            />
          </div>

          <div>
            <Label>Legacy length (optional)</Label>
            <Input
              value={form.length}
              onChange={(e) => setForm({ ...form, length: e.target.value })}
              placeholder="e.g. 6 m"
            />
          </div>

          <div>
            <Label>Grade / pressure rating (optional)</Label>
            <Input
              value={form.pressure_rating}
              onChange={(e) =>
                setForm({ ...form, pressure_rating: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <Label>Product Image (up to 5 MB)</Label>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {preview ? (
              <img
                src={preview}
                alt="Product preview"
                className="h-24 w-24 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 dark:border-slate-600">
                <ImagePlus size={28} />
              </div>
            )}

            <div>
              <input
                type="file"
                accept="image/*"
                onChange={chooseImage}
                className="block max-w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:text-slate-300 dark:file:bg-slate-700"
              />
              <p className="mt-1 text-xs text-slate-500">
                Upload a clear product photo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving
              ? 'Saving...'
              : product
                ? 'Save Changes'
                : 'Add Item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}