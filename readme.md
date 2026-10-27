XYZ Sales — Business Management Dashboard
A web-based sales, purchasing and inventory dashboard designed for a pipe trading and distribution business. It brings day-to-day business records and management reporting into one interface.
Portfolio note: This repository should contain application source code and documentation only. Do not publish real customer, supplier, employee, invoice, payment or business records.

Features
- Overview dashboard — sales, purchases, gross profit, expenses, receivables, payables and inventory KPIs.
- Sales invoices — customer-linked invoices, line items, payment tracking and outstanding balances.
- Purchases — supplier purchase records and supplier balances.
- Stock catalogue — product/SKU details, quantities, costs, selling prices and low-stock visibility.
- Customers and suppliers — master records for business relationships.
- Employees — employee records and salesperson selection.
- Expenses and payments — expense recording, payment tracking and dues follow-up.
- Reports — business performance and profitability reporting.
- Data import — tools for bringing records into the application.
- Settings and branding — business identity and dashboard preferences.
- Role-aware access — Admin and Viewer experiences, subject to the configured Supabase policies.
Only describe a feature as production-ready after it has been tested against the current source and database configuration.
Technology Stack
Technology	Purpose
React	Builds the interactive component-based user interface.
TypeScript	Adds static typing to help catch mistakes and clarify data structures.
Vite	Development server and frontend build tooling.
Tailwind CSS	Utility-first styling for layout, spacing, colours and responsive UI.
Supabase	Backend services used by the app, including PostgreSQL data and authentication.
PostgreSQL	Stores business entities such as products, customers, invoices and payments.
Lucide React	Provides consistent interface icons.
Recharts	Used for dashboard charts where imported by the application.


Check package.json and the actual imports before publishing this table; remove any dependency that is not present in the final code.
Architecture (high level)
Browser
  └── React + TypeScript + Vite
        ├── Pages and reusable UI components
        ├── Dashboard state / data provider
        └── Supabase client
              ├── Supabase Auth
              └── PostgreSQL tables protected by Row Level Security (RLS)
The browser uses the Supabase client and a public/anon key. A public anon key is expected in frontend applications, but it is safe only when database permissions and Row Level Security policies are correctly configured. Never place a Supabase service-role key or database password in frontend code.
Local Setup
Requirements
- Node.js (use a currently supported LTS version)
- npm
- A Supabase project with the required schema and security policies
1. Install dependencies
npm install
2. Configure environment variables
Create a local .env file in the project root:
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
Use the exact variable names referenced by the source code (for example, src/lib/supabase.ts). Never commit your real .env file. .env.example is a placeholder only.
3. Start the development server
npm run dev
4. Build for production
npm run build
If the project defines linting or tests, run the corresponding scripts from package.json as well.
Data Model
The application has been developed around business entities including:
- Products and stock movements
- Customers and sales invoices / invoice line items
- Suppliers and purchase records / purchase line items
- Payments and expenses
- Employees and application user roles
- Business settings and payment follow-ups (where present in the current schema)
The exact schema and migrations in the repository are the source of truth. Do not apply database migrations from this README; review and test them separately.
Privacy and Security
This is a business application. Treat customer, supplier, employee and financial information as confidential.
Before publishing to a public GitHub repository
- [ ] Remove real customer names, phone numbers, addresses and account details from screenshots, fixtures, CSV files and seed data.
- [ ] Remove employee personal information and private supplier contacts.
- [ ] Remove real invoices, payment records, bank information and business financial exports.
- [ ] Replace real production data with clearly labelled synthetic demo data.
- [ ] Do not commit .env, access tokens, passwords, private keys, database dumps or service-role keys.
- [ ] Search the complete Git history for previously committed secrets. Rotate any exposed credentials; deleting a file in a later commit is not enough.
- [ ] Confirm Row Level Security (RLS) is enabled and policies enforce the intended Admin/Viewer permissions for every exposed table.
- [ ] Ensure no service-role key or privileged secret is bundled into the frontend.
- [ ] Check notebook outputs, logs, screenshots and build artifacts for sensitive data.
- [ ] Review Supabase Storage buckets and policies if the app stores uploaded logos or other files.
- [ ] Confirm the public repository does not contain proprietary data or files you do not have permission to share.
Important security note
Hiding a page or button in React is not a security boundary. Enforce access at the database/API layer using Supabase RLS and appropriate server-side checks. The VITE_ prefix exposes environment variables to browser code; use it only for values intended to be public.
Demo Data
For a public portfolio demo, use fictional records such as:
- Customer: Sample Hardware Store
- Supplier: Demo Pipe Supplies
- Product: PVC Pipe 25 mm
- Invoice: DEMO-INV-001
Mark demo data clearly. Do not use real names or actual financial figures without explicit permission.
Project Status
This README documents the intended project structure and features based on the project context. Confirm the current code, dependency versions, schema, policies and build before describing the app as fully tested or production-ready.
Author
Eklavya Kumar

Add a professional portfolio or LinkedIn link only if you want it public. Avoid publishing a personal phone number or email address unless you explicitly intend that information to be public