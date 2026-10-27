/*
# XYZ Sales - Demo Data Seed

Inserts fictional demo data for a general business management dashboard.
All figures and records are fictional DEMO DATA.

1. Data inserted (in dependency order)
- 5 fictional suppliers across general goods and business supplies
- 15 fictional products across office supplies, electronics, packaging, and general merchandise
- 8 fictional business customers
- 15 sales invoices (JS-26001..JS-26015) with one item each, mixed payment status
- 8 purchase invoices (PUR-001..PUR-008) with supplier links
- Payments seeded for the initial amount_paid on every invoice
- 15 expense records spanning Apr-Oct 2026
- Stock movements seeded from purchases (in) and sales (out)

2. Notes
- Indian financial year Apr-Mar; sample dates Apr-Oct 2026.
- Some products are low-stock; some customer invoices are overdue/partially paid.
- Cost method: weighted average — purchase_cost on products reflects latest purchase cost.
*/

-- ============ SUPPLIERS ============
INSERT INTO suppliers (supplier_code, name, contact_person, phone, city, products_supplied, payment_terms) VALUES
('S001','Demo Wholesale Supplies','Demo Contact 1','9100000001','Patna','Office and stationery goods','30 days'),
('S002','Office & Retail Supply Co','Demo Contact 2','9100000002','Gaya','Electronics and accessories','30 days'),
('S003','General Goods Distributor','Demo Contact 3','9100000003','Muzzafarpur','General merchandise','45 days'),
('S004','Business Essentials Ltd','Demo Contact 4','9100000004','Patna','Packaging and supplies','30 days'),
('S005','Packaging & Materials Co','Demo Contact 5','9100000005','Bihar Sharif','Cleaning and household goods','15 days')
ON CONFLICT (supplier_code) DO NOTHING;

-- ============ PRODUCTS ============
-- Supplier codes S001-S005 map to the fictional suppliers listed above.
INSERT INTO products (sku, name, category, brand, diameter, length, pressure_rating, unit, purchase_cost, selling_price, stock_qty, min_stock, supplier_id) VALUES
('P001','Notebook Pack','Office Supplies','PaperTrail',NULL,NULL,NULL,'pack',120,155,290,50,(SELECT id FROM suppliers WHERE supplier_code='S001')),
('P002','Ballpoint Pens Box','Office Supplies','WriteWell',NULL,NULL,NULL,'box',160,205,135,60,(SELECT id FROM suppliers WHERE supplier_code='S001')),
('P003','Wireless Mouse','Electronics','ClickPro',NULL,NULL,NULL,'piece',220,285,25,40,(SELECT id FROM suppliers WHERE supplier_code='S002')),
('P004','USB Keyboard','Electronics','ClickPro',NULL,NULL,NULL,'piece',190,245,125,50,(SELECT id FROM suppliers WHERE supplier_code='S002')),
('P005','Packing Tape Roll','Packaging','PackRight',NULL,NULL,NULL,'roll',260,330,55,20,(SELECT id FROM suppliers WHERE supplier_code='S005')),
('P006','LED Bulb','Electrical','BrightHome',NULL,NULL,NULL,'piece',480,610,38,30,(SELECT id FROM suppliers WHERE supplier_code='S003')),
('P007','Shipping Carton Bundle','Packaging','PackRight',NULL,NULL,NULL,'bundle',2200,2800,16,8,(SELECT id FROM suppliers WHERE supplier_code='S005')),
('P008','Desk Organizer','Office Supplies','WorkSpace',NULL,NULL,NULL,'piece',650,820,5,25,(SELECT id FROM suppliers WHERE supplier_code='S004')),
('P009','Extension Board','Electrical','BrightHome',NULL,NULL,NULL,'piece',1100,1380,20,15,(SELECT id FROM suppliers WHERE supplier_code='S004')),
('P010','Phone Charger','Electronics','VoltPlus',NULL,NULL,NULL,'piece',340,430,60,40,(SELECT id FROM suppliers WHERE supplier_code='S002')),
('P011','Cleaning Wipes Pack','Cleaning Supplies','CleanDay',NULL,NULL,NULL,'pack',290,370,40,50,(SELECT id FROM suppliers WHERE supplier_code='S001')),
('P012','Thermal Paper Roll','Office Supplies','PaperTrail',NULL,NULL,NULL,'roll',780,980,28,20,(SELECT id FROM suppliers WHERE supplier_code='S003')),
('P013','Storage Container Set','Household','HomeBasics',NULL,NULL,NULL,'set',1800,2300,8,6,(SELECT id FROM suppliers WHERE supplier_code='S005')),
('P014','Safety Gloves Pack','Safety Supplies','SafeWork',NULL,NULL,NULL,'pack',900,1120,14,18,(SELECT id FROM suppliers WHERE supplier_code='S004')),
('P015','First Aid Kit','Safety Supplies','SafeWork',NULL,NULL,NULL,'kit',1750,2150,9,10,(SELECT id FROM suppliers WHERE supplier_code='S004'))
ON CONFLICT (sku) DO NOTHING;

-- ============ CUSTOMERS ============
INSERT INTO customers (customer_code, name, phone, city, business_type, credit_limit) VALUES
('C001','Sample Retail Store','9000000001','Patna','Retail',100000),
('C002','Demo Business Mart','9000000002','Gaya','Wholesale',200000),
('C003','Office Essentials Shop','9000000003','Patna','Retail',75000),
('C004','Sample Services Company','9000000004','Patna','Business',300000),
('C005','Everyday Goods Store','9000000005','Muzzafarpur','Retail',80000),
('C006','Demo Enterprise','9000000006','Bihar Sharif','Business',250000),
('C007','General Trading Store','9000000007','Danapur','Wholesale',150000),
('C008','Sample Supplies Outlet','9000000008','Ara','Retail',60000)
ON CONFLICT (customer_code) DO NOTHING;

-- ============ PURCHASES ============
-- Each purchase: invoice, supplier, date, one item, amount_paid, due_date.
-- We insert the purchase header + item + payment + stock movement in sequence.
-- PUR-001 Shree P001 200x120 = 24000 paid 12000
INSERT INTO purchases (invoice_no, invoice_date, supplier_id, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, due_date, status)
SELECT 'PUR-001','2026-04-02', id, 24000, 0, 0, 24000, 12000, 12000, '2026-05-02','confirmed' FROM suppliers WHERE supplier_code='S001';
INSERT INTO purchase_items (purchase_id, product_id, sku, description, quantity, unit, unit_cost, line_total)
SELECT p.id, pr.id, 'P001','Notebook Pack', 200,'piece',120,24000 FROM purchases p, products pr WHERE p.invoice_no='PUR-001' AND pr.sku='P001';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-04-02','supplier', s.id, pu.id, 12000,'Bank Transfer','Initial payment PUR-001' FROM suppliers s, purchases pu WHERE s.supplier_code='S001' AND pu.invoice_no='PUR-001';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-04-02','purchase_in',200,200,'purchase','PUR-001','Purchase PUR-001' FROM products WHERE sku='P001';

-- PUR-002 Metro P004 100x190 = 19000 paid 10000
INSERT INTO purchases (invoice_no, invoice_date, supplier_id, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, due_date, status)
SELECT 'PUR-002','2026-04-15', id, 19000, 0, 0, 19000, 10000, 9000, '2026-05-15','confirmed' FROM suppliers WHERE supplier_code='S002';
INSERT INTO purchase_items (purchase_id, product_id, sku, description, quantity, unit, unit_cost, line_total)
SELECT p.id, pr.id, 'P004','USB Keyboard', 100,'piece',190,19000 FROM purchases p, products pr WHERE p.invoice_no='PUR-002' AND pr.sku='P004';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-04-15','supplier', s.id, pu.id, 10000,'Bank Transfer','Initial payment PUR-002' FROM suppliers s, purchases pu WHERE s.supplier_code='S002' AND pu.invoice_no='PUR-002';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-04-15','purchase_in',100,100,'purchase','PUR-002','Purchase PUR-002' FROM products WHERE sku='P004';

-- PUR-003 National P006 50x480 = 24000 paid 15000
INSERT INTO purchases (invoice_no, invoice_date, supplier_id, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, due_date, status)
SELECT 'PUR-003','2026-05-05', id, 24000, 0, 0, 24000, 15000, 9000, '2026-06-04','confirmed' FROM suppliers WHERE supplier_code='S003';
INSERT INTO purchase_items (purchase_id, product_id, sku, description, quantity, unit, unit_cost, line_total)
SELECT p.id, pr.id, 'P006','LED Bulb', 50,'piece',480,24000 FROM purchases p, products pr WHERE p.invoice_no='PUR-003' AND pr.sku='P006';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-05-05','supplier', s.id, pu.id, 15000,'Bank Transfer','Initial payment PUR-003' FROM suppliers s, purchases pu WHERE s.supplier_code='S003' AND pu.invoice_no='PUR-003';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-05-05','purchase_in',50,50,'purchase','PUR-003','Purchase PUR-003' FROM products WHERE sku='P006';

-- PUR-004 Steel P009 30x1100 = 33000 paid 22000
INSERT INTO purchases (invoice_no, invoice_date, supplier_id, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, due_date, status)
SELECT 'PUR-004','2026-06-10', id, 33000, 0, 0, 33000, 22000, 11000, '2026-07-10','confirmed' FROM suppliers WHERE supplier_code='S004';
INSERT INTO purchase_items (purchase_id, product_id, sku, description, quantity, unit, unit_cost, line_total)
SELECT p.id, pr.id, 'P009','Extension Board', 30,'piece',1100,33000 FROM purchases p, products pr WHERE p.invoice_no='PUR-004' AND pr.sku='P009';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-06-10','supplier', s.id, pu.id, 22000,'Bank Transfer','Initial payment PUR-004' FROM suppliers s, purchases pu WHERE s.supplier_code='S004' AND pu.invoice_no='PUR-004';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-06-10','purchase_in',30,30,'purchase','PUR-004','Purchase PUR-004' FROM products WHERE sku='P009';

-- PUR-005 Shree P002 150x160 = 24000 paid 16000
INSERT INTO purchases (invoice_no, invoice_date, supplier_id, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, due_date, status)
SELECT 'PUR-005','2026-07-08', id, 24000, 0, 0, 24000, 16000, 8000, '2026-08-07','confirmed' FROM suppliers WHERE supplier_code='S001';
INSERT INTO purchase_items (purchase_id, product_id, sku, description, quantity, unit, unit_cost, line_total)
SELECT p.id, pr.id, 'P002','Ballpoint Pens Box', 150,'piece',160,24000 FROM purchases p, products pr WHERE p.invoice_no='PUR-005' AND pr.sku='P002';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-07-08','supplier', s.id, pu.id, 16000,'Bank Transfer','Initial payment PUR-005' FROM suppliers s, purchases pu WHERE s.supplier_code='S001' AND pu.invoice_no='PUR-005';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-07-08','purchase_in',150,150,'purchase','PUR-005','Purchase PUR-005' FROM products WHERE sku='P002';

-- PUR-006 Metro P010 60x340 = 20400 paid 10000
INSERT INTO purchases (invoice_no, invoice_date, supplier_id, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, due_date, status)
SELECT 'PUR-006','2026-08-12', id, 20400, 0, 0, 20400, 10000, 10400, '2026-09-11','confirmed' FROM suppliers WHERE supplier_code='S002';
INSERT INTO purchase_items (purchase_id, product_id, sku, description, quantity, unit, unit_cost, line_total)
SELECT p.id, pr.id, 'P010','Phone Charger', 60,'piece',340,20400 FROM purchases p, products pr WHERE p.invoice_no='PUR-006' AND pr.sku='P010';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-08-12','supplier', s.id, pu.id, 10000,'Bank Transfer','Initial payment PUR-006' FROM suppliers s, purchases pu WHERE s.supplier_code='S002' AND pu.invoice_no='PUR-006';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-08-12','purchase_in',60,60,'purchase','PUR-006','Purchase PUR-006' FROM products WHERE sku='P010';

-- PUR-007 National P007 20x2200 = 44000 paid 22000
INSERT INTO purchases (invoice_no, invoice_date, supplier_id, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, due_date, status)
SELECT 'PUR-007','2026-09-03', id, 44000, 0, 0, 44000, 22000, 22000, '2026-10-03','confirmed' FROM suppliers WHERE supplier_code='S003';
INSERT INTO purchase_items (purchase_id, product_id, sku, description, quantity, unit, unit_cost, line_total)
SELECT p.id, pr.id, 'P007','Shipping Carton Bundle', 20,'bundle',2200,44000 FROM purchases p, products pr WHERE p.invoice_no='PUR-007' AND pr.sku='P007';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-09-03','supplier', s.id, pu.id, 22000,'Bank Transfer','Initial payment PUR-007' FROM suppliers s, purchases pu WHERE s.supplier_code='S003' AND pu.invoice_no='PUR-007';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-09-03','purchase_in',20,20,'purchase','PUR-007','Purchase PUR-007' FROM products WHERE sku='P007';

-- PUR-008 Steel P015 15x1750 = 26250 paid 10000
INSERT INTO purchases (invoice_no, invoice_date, supplier_id, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, due_date, status)
SELECT 'PUR-008','2026-10-05', id, 26250, 0, 0, 26250, 10000, 16250, '2026-11-04','confirmed' FROM suppliers WHERE supplier_code='S004';
INSERT INTO purchase_items (purchase_id, product_id, sku, description, quantity, unit, unit_cost, line_total)
SELECT p.id, pr.id, 'P015','First Aid Kit', 15,'piece',1750,26250 FROM purchases p, products pr WHERE p.invoice_no='PUR-008' AND pr.sku='P015';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-10-05','supplier', s.id, pu.id, 10000,'Bank Transfer','Initial payment PUR-008' FROM suppliers s, purchases pu WHERE s.supplier_code='S004' AND pu.invoice_no='PUR-008';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-10-05','purchase_in',15,15,'purchase','PUR-008','Purchase PUR-008' FROM products WHERE sku='P015';

-- ============ SALES ============
-- Helper: for each sale we insert header, item, initial payment (if any), stock movement out.
-- GST 0 for simplicity (B2B); subtotal = qty*price - discount; total = subtotal.
-- Salesperson assignment rotates.

-- JS-26001 C001 P001 50x155=7750 disc0 paid5000
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26001','2026-04-05', c.id, 'Demo Salesperson 1', 7750, 0, 0, 7750, 5000, 2750, 'Partial','2026-05-05','confirmed' FROM customers c WHERE c.customer_code='C001';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P001','Notebook Pack', 50,'piece',155,120,0,0,7750,6000 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26001' AND p.sku='P001';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-04-05','customer', c.id, si.id, 5000,'UPI','Payment JS-26001' FROM customers c, sales_invoices si WHERE c.customer_code='C001' AND si.invoice_no='JS-26001';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-04-05','sale_out',50,240,'sale','JS-26001','Sale JS-26001' FROM products WHERE sku='P001';

-- JS-26002 C002 P004 30x245=7350 disc100 paid5000
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26002','2026-04-12', c.id, 'Demo Salesperson 2', 7250, 100, 0, 7250, 5000, 2250, 'Partial','2026-05-12','confirmed' FROM customers c WHERE c.customer_code='C002';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P004','USB Keyboard', 30,'piece',245,190,100,0,7250,5700 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26002' AND p.sku='P004';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-04-12','customer', c.id, si.id, 5000,'UPI','Payment JS-26002' FROM customers c, sales_invoices si WHERE c.customer_code='C002' AND si.invoice_no='JS-26002';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-04-12','sale_out',30,70,'sale','JS-26002','Sale JS-26002' FROM products WHERE sku='P004';

-- JS-26003 C003 P002 40x205=8200 disc0 paid8200
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26003','2026-04-20', c.id, 'Demo Salesperson 1', 8200, 0, 0, 8200, 8200, 0, 'Paid','2026-05-20','confirmed' FROM customers c WHERE c.customer_code='C003';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P002','Ballpoint Pens Box', 40,'piece',205,160,0,0,8200,6400 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26003' AND p.sku='P002';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-04-20','customer', c.id, si.id, 8200,'Cash','Payment JS-26003' FROM customers c, sales_invoices si WHERE c.customer_code='C003' AND si.invoice_no='JS-26003';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-04-20','sale_out',40,110,'sale','JS-26003','Sale JS-26003' FROM products WHERE sku='P002';

-- JS-26004 C004 P008 20x820=16400 disc200 paid10000
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26004','2026-05-03', c.id, 'Demo Salesperson 3', 16200, 200, 0, 16200, 10000, 6200, 'Partial','2026-06-02','confirmed' FROM customers c WHERE c.customer_code='C004';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P008','Desk Organizer', 20,'piece',820,650,200,0,16200,13000 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26004' AND p.sku='P008';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-05-03','customer', c.id, si.id, 10000,'Bank Transfer','Payment JS-26004' FROM customers c, sales_invoices si WHERE c.customer_code='C004' AND si.invoice_no='JS-26004';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-05-03','sale_out',20,30,'sale','JS-26004','Sale JS-26004' FROM products WHERE sku='P008';

-- JS-26005 C001 P003 25x285=7125 disc0 paid7125
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26005','2026-05-15', c.id, 'Demo Salesperson 2', 7125, 0, 0, 7125, 7125, 0, 'Paid','2026-06-14','confirmed' FROM customers c WHERE c.customer_code='C001';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P003','Wireless Mouse', 25,'piece',285,220,0,0,7125,5500 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26005' AND p.sku='P003';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-05-15','customer', c.id, si.id, 7125,'UPI','Payment JS-26005' FROM customers c, sales_invoices si WHERE c.customer_code='C001' AND si.invoice_no='JS-26005';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-05-15','sale_out',25,5,'sale','JS-26005','Sale JS-26005' FROM products WHERE sku='P003';

-- JS-26006 C005 P005 15x330=4950 disc0 paid3000
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26006','2026-05-22', c.id, 'Demo Salesperson 1', 4950, 0, 0, 4950, 3000, 1950, 'Partial','2026-06-21','confirmed' FROM customers c WHERE c.customer_code='C005';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P005','Packing Tape Roll', 15,'piece',330,260,0,0,4950,3900 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26006' AND p.sku='P005';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-05-22','customer', c.id, si.id, 3000,'UPI','Payment JS-26006' FROM customers c, sales_invoices si WHERE c.customer_code='C005' AND si.invoice_no='JS-26006';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-05-22','sale_out',15,40,'sale','JS-26006','Sale JS-26006' FROM products WHERE sku='P005';

-- JS-26007 C006 P009 10x1380=13800 disc0 paid13800
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26007','2026-06-02', c.id, 'Demo Salesperson 3', 13800, 0, 0, 13800, 13800, 0, 'Paid','2026-07-02','confirmed' FROM customers c WHERE c.customer_code='C006';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P009','Extension Board', 10,'piece',1380,1100,0,0,13800,11000 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26007' AND p.sku='P009';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-06-02','customer', c.id, si.id, 13800,'Bank Transfer','Payment JS-26007' FROM customers c, sales_invoices si WHERE c.customer_code='C006' AND si.invoice_no='JS-26007';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-06-02','sale_out',10,20,'sale','JS-26007','Sale JS-26007' FROM products WHERE sku='P009';

-- JS-26008 C002 P006 12x610=7320 disc120 paid4000
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26008','2026-06-11', c.id, 'Demo Salesperson 2', 7200, 120, 0, 7200, 4000, 3200, 'Partial','2026-07-11','confirmed' FROM customers c WHERE c.customer_code='C002';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P006','LED Bulb', 12,'piece',610,480,120,0,7200,5760 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26008' AND p.sku='P006';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-06-11','customer', c.id, si.id, 4000,'UPI','Payment JS-26008' FROM customers c, sales_invoices si WHERE c.customer_code='C002' AND si.invoice_no='JS-26008';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-06-11','sale_out',12,38,'sale','JS-26008','Sale JS-26008' FROM products WHERE sku='P006';

-- JS-26009 C007 P011 30x370=11100 disc0 paid11100
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26009','2026-06-19', c.id, 'Demo Salesperson 1', 11100, 0, 0, 11100, 11100, 0, 'Paid','2026-07-19','confirmed' FROM customers c WHERE c.customer_code='C007';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P011','Cleaning Wipes Pack', 30,'piece',370,290,0,0,11100,8700 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26009' AND p.sku='P011';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-06-19','customer', c.id, si.id, 11100,'Cash','Payment JS-26009' FROM customers c, sales_invoices si WHERE c.customer_code='C007' AND si.invoice_no='JS-26009';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-06-19','sale_out',30,10,'sale','JS-26009','Sale JS-26009' FROM products WHERE sku='P011';

-- JS-26010 C003 P010 10x430=4300 disc0 paid0  (overdue, unpaid)
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26010','2026-07-04', c.id, 'Demo Salesperson 3', 4300, 0, 0, 4300, 0, 4300, 'Unpaid','2026-08-03','confirmed' FROM customers c WHERE c.customer_code='C003';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P010','Phone Charger', 10,'piece',430,340,0,0,4300,3400 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26010' AND p.sku='P010';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-07-04','sale_out',10,50,'sale','JS-26010','Sale JS-26010' FROM products WHERE sku='P010';

-- JS-26011 C004 P012 8x980=7840 disc0 paid5000
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26011','2026-07-13', c.id, 'Demo Salesperson 2', 7840, 0, 0, 7840, 5000, 2840, 'Partial','2026-08-12','confirmed' FROM customers c WHERE c.customer_code='C004';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P012','Thermal Paper Roll', 8,'piece',980,780,0,0,7840,6240 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26011' AND p.sku='P012';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-07-13','customer', c.id, si.id, 5000,'Bank Transfer','Payment JS-26011' FROM customers c, sales_invoices si WHERE c.customer_code='C004' AND si.invoice_no='JS-26011';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-07-13','sale_out',8,20,'sale','JS-26011','Sale JS-26011' FROM products WHERE sku='P012';

-- JS-26012 C008 P013 3x2300=6900 disc100 paid6800
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26012','2026-07-25', c.id, 'Demo Salesperson 1', 6800, 100, 0, 6800, 6800, 0, 'Paid','2026-08-24','confirmed' FROM customers c WHERE c.customer_code='C008';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P013','Storage Container Set', 3,'roll',2300,1800,100,0,6800,5400 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26012' AND p.sku='P013';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-07-25','customer', c.id, si.id, 6800,'Cash','Payment JS-26012' FROM customers c, sales_invoices si WHERE c.customer_code='C008' AND si.invoice_no='JS-26012';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-07-25','sale_out',3,5,'sale','JS-26012','Sale JS-26012' FROM products WHERE sku='P013';

-- JS-26013 C001 P001 60x155=9300 disc150 paid9150
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26013','2026-08-02', c.id, 'Demo Salesperson 3', 9150, 150, 0, 9150, 9150, 0, 'Paid','2026-09-01','confirmed' FROM customers c WHERE c.customer_code='C001';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P001','Notebook Pack', 60,'piece',155,120,150,0,9150,7200 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26013' AND p.sku='P001';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-08-02','customer', c.id, si.id, 9150,'UPI','Payment JS-26013' FROM customers c, sales_invoices si WHERE c.customer_code='C001' AND si.invoice_no='JS-26013';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-08-02','sale_out',60,180,'sale','JS-26013','Sale JS-26013' FROM products WHERE sku='P001';

-- JS-26014 C005 P014 12x1120=13440 disc0 paid5000
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26014','2026-08-14', c.id, 'Demo Salesperson 2', 13440, 0, 0, 13440, 5000, 8440, 'Partial','2026-09-13','confirmed' FROM customers c WHERE c.customer_code='C005';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P014','Safety Gloves Pack', 12,'piece',1120,900,0,0,13440,10800 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26014' AND p.sku='P014';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-08-14','customer', c.id, si.id, 5000,'UPI','Payment JS-26014' FROM customers c, sales_invoices si WHERE c.customer_code='C005' AND si.invoice_no='JS-26014';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-08-14','sale_out',12,2,'sale','JS-26014','Sale JS-26014' FROM products WHERE sku='P014';

-- JS-26015 C006 P015 6x2150=12900 disc0 paid12900
INSERT INTO sales_invoices (invoice_no, invoice_date, customer_id, salesperson, subtotal, discount_amount, gst_amount, total_amount, amount_paid, outstanding, payment_status, due_date, status)
SELECT 'JS-26015','2026-08-27', c.id, 'Demo Salesperson 1', 12900, 0, 0, 12900, 12900, 0, 'Paid','2026-09-26','confirmed' FROM customers c WHERE c.customer_code='C006';
INSERT INTO sales_invoice_items (invoice_id, product_id, sku, description, quantity, unit, selling_price, unit_cost, discount_amount, gst_amount, line_total, line_cogs)
SELECT si.id, p.id, 'P015','First Aid Kit', 6,'piece',2150,1750,0,0,12900,10500 FROM sales_invoices si, products p WHERE si.invoice_no='JS-26015' AND p.sku='P015';
INSERT INTO payments (payment_date, party_type, party_id, invoice_id, amount, payment_method, notes)
SELECT '2026-08-27','customer', c.id, si.id, 12900,'Bank Transfer','Payment JS-26015' FROM customers c, sales_invoices si WHERE c.customer_code='C006' AND si.invoice_no='JS-26015';
INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, balance_after, reference_type, reference_id, notes)
SELECT id,'2026-08-27','sale_out',6,9,'sale','JS-26015','Sale JS-26015' FROM products WHERE sku='P015';

-- ============ EXPENSES ============
INSERT INTO expenses (expense_id, expense_date, category, description, vendor, amount, payment_method) VALUES
('EXP-001','2026-04-05','Transport','Delivery vehicle fuel','Local Fuel Station',4500,'Bank Transfer'),
('EXP-002','2026-04-15','Rent','Warehouse rent','Property Owner',18000,'Bank Transfer'),
('EXP-003','2026-05-10','Salaries','Staff salaries','Payroll',35000,'Bank Transfer'),
('EXP-004','2026-06-12','Electricity','Warehouse electricity','Electricity Board',3200,'UPI'),
('EXP-005','2026-07-08','Transport','Customer deliveries','Local Transporter',6500,'Cash'),
('EXP-006','2026-08-10','Repairs','Warehouse repairs','Local Business',2500,'UPI'),
('EXP-007','2026-09-05','Salaries','Staff salaries','Payroll',35000,'Bank Transfer'),
('EXP-008','2026-10-05','Packaging','Packing materials','Packaging Store',1800,'Cash'),
('EXP-009','2026-04-20','Freight','Inward freight','Demo Wholesale Supplies',2200,'Cash'),
('EXP-010','2026-05-18','Miscellaneous','Office supplies','Local Stationer',1500,'UPI'),
('EXP-011','2026-06-25','Salaries','Bonus and incentives','Payroll',8000,'Bank Transfer'),
('EXP-012','2026-07-15','Rent','Warehouse rent','Property Owner',18000,'Bank Transfer'),
('EXP-013','2026-08-20','Electricity','Warehouse electricity','Electricity Board',3400,'UPI'),
('EXP-014','2026-09-20','Transport','Customer deliveries','Local Transporter',7200,'Cash'),
('EXP-015','2026-10-15','Salaries','Staff salaries','Payroll',35000,'Bank Transfer')
ON CONFLICT (expense_id) DO NOTHING;