# Business Management Dashboard

A web-based business management dashboard designed to help businesses manage daily operations, monitor inventory, track transactions, and organize business information in one place.

**Live Demo:** [Open Dashboard](https://business-management-dashboard-glwoq9kqs.vercel.app)  
**GitHub Repository:** [View Source Code](https://github.com/CYBERWORKE1/business-management-dashboard)

## Overview

This project is a general-purpose business management dashboard suitable for retail stores, wholesalers, distributors, and other businesses. It provides a centralized interface for organizing business records and monitoring operational and financial information.

## Features

- **Dashboard & Reports:** View business information and performance summaries.
- **Sales Management:** Manage sales invoices and transactions.
- **Purchase Management:** Organize purchase records.
- **Inventory Management:** Maintain product and stock information.
- **Customer & Supplier Management:** Organize customer and supplier records.
- **Employee Management:** Maintain employee information.
- **Payments & Expenses:** Track payments, expenses, and financial activity.
- **Role-Based Access:** Support for Admin and Viewer roles, subject to the application's configured permissions.

## Technology Stack

- **React + TypeScript** — Frontend development.
- **Vite** — Development server and production build tooling.
- **Supabase** — Authentication, PostgreSQL database, and backend services.
- **CSS** — Styling and responsive user interface.
- **Vercel** — Deployment and hosting.

## Demo Access

A dedicated demo Viewer account may be provided to explore the dashboard.

- **Role:** Viewer
- **Email:** Available when demo access is enabled.
- **Password:** Use the credentials provided for the demo account.

The demo should use synthetic data and read-only permissions. Never use personal account credentials for public demonstrations.

## Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/CYBERWORKE1/business-management-dashboard.git
cd business-management-dashboard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Use the URL and publishable key from your Supabase project. Never expose a Supabase secret key or service-role key in frontend code or public repositories.

### 4. Start the development server

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

## Deployment

The application can be deployed using Vercel by importing the GitHub repository, configuring the required environment variables, and deploying the project.

## Security

- Keep `.env` files and private credentials out of Git.
- Use synthetic data for public demonstrations.
- Configure appropriate Row Level Security (RLS) policies in Supabase.
- Verify that Viewer accounts cannot perform unauthorized changes.
- Grant Admin privileges only to trusted accounts.
- Never include passwords or privileged secret keys in the README.

## Purpose

This project demonstrates full-stack web development using React, TypeScript, Supabase, authentication, database integration, and role-based access control.
