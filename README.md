# LabTrack — Smart Inventory Management System

> AI-powered inventory system for college labs and libraries with predictive restocking, analytics, and automated procurement.

![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20PostgreSQL%20%7C%20Prophet-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Table of Contents
1. [Project Overview](#overview)
2. [Full Folder Structure](#folder-structure)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [ML Prediction Module](#ml-prediction-module)
7. [Role-Based Access](#role-based-access)
8. [Quick Start (Docker)](#quick-start-docker)
9. [Local Development](#local-development)
10. [Deployment Guide](#deployment-guide)
11. [Environment Variables](#environment-variables)

---

## Overview

LabTrack provides six core modules:

| Module | Description |
|---|---|
| **Inventory CRUD** | Full create/read/update/delete with QR/barcode scanning |
| **Predictive Restocking** | Prophet & ARIMA forecasting with academic demand cycles |
| **Analytics Dashboard** | Consumption trends, department usage, inventory turnover |
| **Procurement Suggestions** | AI-generated purchase orders with supplier integration |
| **Alerts** | Real-time low-stock, expiry, and predicted shortage alerts |
| **Role-Based Access** | Admin / Lab Staff / Student permissions |

---

## Folder Structure

```
smart-inventory/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic settings
│   │   │   └── security.py          # JWT, password hashing
│   │   ├── db/
│   │   │   ├── base.py              # SQLAlchemy Base
│   │   │   └── session.py           # Async engine + session
│   │   ├── models/
│   │   │   └── models.py            # All ORM models
│   │   ├── schemas/
│   │   │   └── schemas.py           # Pydantic request/response schemas
│   │   ├── api/routes/
│   │   │   ├── auth.py              # Login, register, refresh
│   │   │   ├── users.py             # User management
│   │   │   ├── inventory.py         # Item CRUD + usage logging
│   │   │   ├── analytics.py         # Dashboard, trends, turnover
│   │   │   ├── predictions.py       # ML forecast endpoints
│   │   │   ├── alerts.py            # Alert management + notifications
│   │   │   ├── procurement.py       # Purchase orders + AI suggest
│   │   │   └── qr.py                # QR code image endpoint
│   │   ├── services/
│   │   │   ├── auth_service.py      # JWT dependency injection
│   │   │   └── qr_service.py        # QR generation + SKU logic
│   │   └── ml/
│   │       └── forecaster.py        # Prophet / ARIMA / LinearRegression
│   ├── alembic/                     # Database migrations
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # Root layout with providers
│   │   │   ├── page.tsx             # Redirect → /dashboard
│   │   │   ├── login/page.tsx       # Auth page
│   │   │   └── (app)/               # Protected route group
│   │   │       ├── layout.tsx       # Sidebar + auth guard
│   │   │       ├── dashboard/       # KPI dashboard
│   │   │       ├── inventory/       # Item list + CRUD
│   │   │       ├── analytics/       # Charts & trends
│   │   │       ├── procurement/     # Purchase orders
│   │   │       ├── alerts/          # Alert center
│   │   │       └── settings/        # User management
│   │   ├── components/
│   │   │   ├── layout/              # Sidebar, Header
│   │   │   ├── ui/                  # StatCard, badges, skeletons
│   │   │   └── inventory/           # Forms, usage modal, QR scanner
│   │   ├── lib/
│   │   │   ├── api.ts               # Axios client + all API calls
│   │   │   ├── store.ts             # Zustand auth state
│   │   │   └── utils.ts             # Formatters, color maps
│   │   └── hooks/                   # Custom React hooks
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── .env.example
│
├── data/
│   ├── sample_inventory.csv         # 25 sample items
│   └── sample_usage_history.csv     # 6 months of usage data
│
├── scripts/
│   └── seed_db.py                   # Database seeding script
│
├── docker-compose.yml               # Full stack (db + redis + api + web)
└── README.md
```

---

## Database Schema

### Core Tables

```sql
-- Users (role-based access)
users (id, email, full_name, hashed_password, role, department, is_active, created_at)

-- Suppliers
suppliers (id, name, contact_email, contact_phone, address, lead_time_days, rating)

-- Inventory Items
inventory_items (
  id, item_name, sku, barcode, qr_code,
  category, description,
  quantity, unit, minimum_threshold, reorder_quantity, unit_cost,
  location, purchase_date, expiry_date, last_restocked,
  supplier_id, is_active, tags
)

-- Usage Logs (every stock movement)
usage_logs (
  id, item_id, user_id,
  quantity_change, quantity_after,
  action, notes, department, timestamp
)

-- Alerts
alerts (id, item_id, alert_type, status, message, severity, metadata, created_at, resolved_at)

-- Notifications (per-user in-app)
notifications (id, user_id, alert_id, title, message, is_read, channel, created_at)

-- Procurement Orders
procurement_orders (
  id, item_id, supplier_id,
  quantity, unit_cost, total_cost,
  status, reason, ai_generated, expected_delivery
)

-- ML Predictions (cached forecast results)
stock_predictions (
  id, item_id,
  predicted_stockout_date, recommended_restock_qty,
  daily_consumption_rate, confidence_score,
  forecast_data (JSON), model_used
)
```

### Enum Values
- **UserRole**: `admin`, `lab_staff`, `student`
- **ItemCategory**: `equipment`, `book`, `consumable`, `chemical`, `electronic`, `furniture`, `other`
- **AlertType**: `low_stock`, `expiry`, `predicted_shortage`, `reorder`
- **ProcurementStatus**: `suggested` → `approved` → `ordered` → `received` / `cancelled`

---

## API Endpoints

### Authentication
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login → JWT tokens | Public |
| POST | `/api/auth/refresh` | Refresh access token | Public |
| GET  | `/api/users/me` | Current user profile | Any |
| PATCH| `/api/users/me` | Update own profile | Any |
| GET  | `/api/users/` | List all users | Admin |
| PATCH| `/api/users/{id}` | Update user role/status | Admin |

### Inventory
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET  | `/api/inventory/` | List items (search, filter, paginate) | Any |
| POST | `/api/inventory/` | Create item (generates SKU + QR) | Staff+ |
| GET  | `/api/inventory/{id}` | Get item details | Any |
| PATCH| `/api/inventory/{id}` | Update item | Staff+ |
| DELETE| `/api/inventory/{id}` | Soft-delete item | Admin |
| POST | `/api/inventory/{id}/usage` | Log stock movement | Any |
| GET  | `/api/inventory/{id}/usage` | Usage history | Any |
| GET  | `/api/inventory/scan/barcode/{code}` | Look up by barcode/SKU | Any |

### Analytics
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/analytics/dashboard` | KPI summary stats | Any |
| GET | `/api/analytics/consumption/monthly` | Monthly trend (param: months) | Staff+ |
| GET | `/api/analytics/top-items` | Top consumed items (param: days, limit) | Staff+ |
| GET | `/api/analytics/department-usage` | Usage by department | Staff+ |
| GET | `/api/analytics/inventory-turnover` | Turnover by category | Staff+ |

### Predictions (ML)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/predictions/item/{id}` | Forecast for single item | Any |
| GET | `/api/predictions/bulk` | Forecasts for all low-stock items | Any |

### Alerts
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET  | `/api/alerts/` | List alerts (filter by status/severity) | Staff+ |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge alert | Staff+ |
| POST | `/api/alerts/{id}/resolve` | Resolve alert | Staff+ |
| GET  | `/api/alerts/notifications/mine` | My in-app notifications | Any |
| POST | `/api/alerts/notifications/{id}/read` | Mark notification read | Any |

### Procurement
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET  | `/api/procurement/` | List orders | Staff+ |
| POST | `/api/procurement/` | Create manual order | Staff+ |
| PATCH| `/api/procurement/{id}` | Update status (approve/order/receive) | Admin |
| POST | `/api/procurement/auto-suggest` | AI: generate suggestions for low-stock | Staff+ |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/qr/{item_id}.png` | Download QR code image |
| GET | `/api/health` | Health check |
| GET | `/api/docs` | Swagger UI |
| GET | `/api/redoc` | ReDoc UI |

---

## Frontend Components

| Component | Location | Description |
|---|---|---|
| `Sidebar` | `components/layout/sidebar.tsx` | Collapsible nav with role filtering |
| `Header` | `components/layout/header.tsx` | Title + notifications bell |
| `StatCard` | `components/ui/stat-card.tsx` | KPI metric card with trend |
| `InventoryFormModal` | `components/inventory/` | Create/edit item form |
| `UsageLogModal` | `components/inventory/` | Checkout / checkin / restock |
| `QRScannerModal` | `components/inventory/` | Camera QR + manual entry |
| Dashboard | `app/(app)/dashboard/` | Overview KPIs + charts |
| Inventory | `app/(app)/inventory/` | Filterable table with CRUD |
| Analytics | `app/(app)/analytics/` | Full chart suite |
| Procurement | `app/(app)/procurement/` | Order cards + AI suggest |
| Alerts | `app/(app)/alerts/` | Alert feed + prediction panel |
| Settings | `app/(app)/settings/` | User management |

---

## ML Prediction Module

**File**: `backend/app/ml/forecaster.py`

### Model Selection Logic
```
Usage history >= 14 days  →  Prophet (primary)
Usage history >= 7 days   →  ARIMA / SARIMAX
Usage history < 7 days    →  Linear Regression
No history                →  Conservative default
```

### Prophet Configuration
- Yearly + weekly seasonality
- Custom **academic demand cycle** seasonality (Fourier order 5)
- Changepoint prior scale: 0.05 (conservative)
- 95% confidence intervals

### Academic Demand Cycle Weights
```python
{
  1: 1.2,   # January  - new semester
  5: 1.3,   # May      - exams
  6: 0.6,   # June     - summer low
  9: 1.4,   # September - back to school peak
  12: 0.8,  # December - holiday break
}
```

### Output per Item
- `predicted_stockout_date` — when stock drops below threshold
- `days_until_stockout` — integer days remaining
- `recommended_restock_qty` — covers lead time + 30-day buffer + safety stock
- `confidence_score` — 0.0–0.95 based on data volume
- `forecast_data` — 30-day daily predictions with upper/lower bounds

---

## Role-Based Access

| Feature | Admin | Lab Staff | Student |
|---|:---:|:---:|:---:|
| View inventory | ✅ | ✅ | ✅ |
| View predictions | ✅ | ✅ | ✅ |
| Log usage | ✅ | ✅ | ✅ |
| Create/edit items | ✅ | ✅ | ❌ |
| Delete items | ✅ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ❌ |
| Manage alerts | ✅ | ✅ | ❌ |
| Create procurement | ✅ | ✅ | ❌ |
| Approve/update procurement | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |

---

## Quick Start (Docker)

**Prerequisites**: Docker + Docker Compose

```bash
# 1. Clone and navigate
git clone https://github.com/yourorg/smart-inventory.git
cd smart-inventory

# 2. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start all services
docker-compose up -d

# 4. Seed the database
docker exec smart_inventory_api python scripts/seed_db.py

# 5. Open browser
# Frontend: http://localhost:3000
# API Docs:  http://localhost:8000/api/docs
```

### Default Login Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@lab.edu | Admin@1234 |
| Lab Staff | staff@lab.edu | Staff@1234 |
| Student | student@lab.edu | Student@1234 |

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start PostgreSQL (locally or via Docker)
docker run -d -p 5432:5432 -e POSTGRES_DB=smart_inventory \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres postgres:16

# Configure environment
cp .env.example .env
# Edit DATABASE_URL in .env

# Run migrations and seed
python scripts/seed_db.py

# Start API server
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install

# Configure API URL
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# Open http://localhost:3000
```

---

## Deployment Guide

### 1. Database → Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database** and copy the connection string
3. Use format: `postgresql+asyncpg://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`

### 2. Backend → Render

1. Push backend to a GitHub repo
2. Create a new **Web Service** on [render.com](https://render.com):
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Set environment variables from `.env.example`
4. **Important**: Set `DATABASE_URL` to your Supabase connection string

```bash
# After deploy, run the seed script once:
curl -X POST https://your-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lab.edu","full_name":"Admin","password":"Admin@1234","role":"admin"}'
```

### 3. Frontend → Vercel

1. Push frontend to GitHub
2. Import at [vercel.com](https://vercel.com)
3. Set environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-api.onrender.com`
4. Deploy — Vercel auto-detects Next.js

### 4. Update CORS

In your backend `.env` on Render, update:
```
ALLOWED_ORIGINS=["https://your-app.vercel.app"]
```

---

## Environment Variables

### Backend (`.env`)
| Variable | Description | Required |
|---|---|:---:|
| `SECRET_KEY` | JWT signing key (use `openssl rand -hex 32`) | ✅ |
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `ALLOWED_ORIGINS` | JSON array of frontend URLs | ✅ |
| `SMTP_HOST` | Email server host | Optional |
| `SMTP_PASSWORD` | SendGrid API key | Optional |
| `REDIS_URL` | Redis for background tasks | Optional |

### Frontend (`.env.local`)
| Variable | Description | Required |
|---|---|:---:|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | ✅ |

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + custom design tokens |
| State | Zustand (auth) + TanStack Query (server state) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Backend | FastAPI + Python 3.11 |
| Auth | JWT (python-jose) + bcrypt |
| Database ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 16 |
| Migrations | Alembic |
| ML | Prophet + statsmodels (ARIMA) + scikit-learn |
| QR Codes | qrcode (Python) + html5-qrcode (browser) |
| Email | aiosmtplib + SendGrid |
| Containers | Docker + Docker Compose |
| CI/CD | Vercel (frontend) + Render (backend) |

---

## Extras Included

- ✅ **QR Scanner** — browser camera + manual code entry
- ✅ **Docker Support** — full docker-compose with postgres + redis
- ✅ **Swagger API Docs** — at `/api/docs` and `/api/redoc`
- ✅ **Academic Demand Cycles** — Prophet seasonality for semester patterns
- ✅ **Auto-generated SKUs** — category-prefixed unique identifiers
- ✅ **Soft deletes** — items never permanently deleted
- ✅ **Background alert checks** — `run_alert_checks()` callable by scheduler
