# AO Core ERP

Modern ERP for small business / organic products — React + Vite frontend, Express + MongoDB backend.

## Stack

- **Frontend:** React, Vite, Recharts, custom CSS (dark mode + brand theme)
- **Backend:** Node.js, Express, Mongoose
- **Database:** MongoDB Atlas
- **Auth:** JWT + bcrypt

## Setup

### 1. MongoDB Atlas

1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Add your IP under **Network Access** (or `0.0.0.0/0` for dev).
3. Create a database user and copy the connection string.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_SECRET
npm install
npm run seed
npm run dev
```

API runs at `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`

### 4. Run both (from root)

```bash
npm install
npm run install:all
npm run dev
```

## Default login

| Email | Password | Role |
|-------|----------|------|
| admin@aocore.com | Admin@123 | Admin |

Change the password after first login.

## Roles

| Module | Admin | Staff |
|--------|-------|-------|
| Dashboard, Products, Sales, Customers | Yes | Yes |
| Inventory, Purchases, Analytics, Reports, Users, Settings | Yes | No |

## Features

- Product & customer CRUD with search and pagination
- Sales invoices with GST, discount, PDF download, print
- Inventory movements, adjust, repack, manufacturing
- Purchases (stock in)
- Dashboard analytics (MongoDB aggregation)
- Excel report exports
- Low stock notifications
- Activity logs
- Global search
- Company branding (logo, colors, dark mode)

## Project structure

```
ao-core/
├── backend/     Express API
├── frontend/    React app
└── README.md
```
