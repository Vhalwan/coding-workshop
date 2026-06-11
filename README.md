# ACME Project Hub

A project management application built for the AWS Workshop. Manages projects, deliverables, resources, and budgets with role-based access control.

**Live App:** https://d17z47e4o82vum.cloudfront.net

## Tech Stack
- **Frontend:** React + Vite + Material UI + React Responsive
- **Backend:** Python Lambda functions (LocalStack locally, AWS Lambda on cloud)
- **Database:** PostgreSQL
- **Auth:** JWT tokens with bcrypt password hashing
- **Infrastructure:** AWS Lambda, API Gateway, S3, CloudFront (via LocalStack locally)

## Running Locally (VDI)
```bash
# 1. Make sure environment variables are set
source ~/.bashrc
# 2. Start everything
./bin/start-dev.sh
# 3. Open in browser
http://localhost:3000
```
The start script handles PostgreSQL, LocalStack, all backend services, and the Vite frontend automatically.

## Test Accounts
| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | admin@test.com | admin123 | Full access + user management |
| Manager | manager@test.com | manager123 | Create, edit, delete everything |
| Contributor | contributor@test.com | contributor123 | Create and edit, no delete |
| Viewer | viewer@test.com | viewer123 | Read-only |

## Features
- **Authentication** — Register, login, JWT session, protected routes
- **Projects** — Full CRUD with status/priority filtering, budget tracking, and automatic at-risk flagging when deadline is within 14 days
- **Deliverables** — Task tracking with dependency chain support and circular dependency prevention
- **Resources** — Team capacity management with allocation tracking and over-allocation warnings
- **Budget** — Expense and allocation tracking with per-project summaries, over-budget and at-risk warnings
- **Dashboard** — Live stats: active projects, at-risk count, deliverables progress, over-allocated resources, budget chart, activity timeline
- **Export** — CSV and PDF export on all pages for stakeholder reporting
- **Responsive** — Mobile and desktop layouts using React Responsive

## Role-Based Access Control
| Action | Admin | Manager | Contributor | Viewer |
|--------|-------|---------|-------------|--------|
| Read everything | ✅ | ✅ | ✅ | ✅ |
| Create records | ✅ | ✅ | ✅ | ❌ |
| Edit records | ✅ | ✅ | ✅ | ❌ |
| Delete records | ✅ | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |

Backend enforces role checks on every write/delete endpoint — not just UI. Viewer POST attempts return 403 even via direct API call.

## Running Tests
```bash
cd backend
python -m pytest tests/ -v
```
40 tests covering all five services.

## API Endpoints
All endpoints run through the proxy at `http://localhost:3001/api/`

| Service | Base Path |
|---------|-----------|
| Auth | `/auth-service/` |
| Projects | `/projects-service/projects` |
| Deliverables | `/deliverables-service/deliverables` |
| Resources | `/resources-service/resources` |
| Allocations | `/resources-service/allocations` |
| Budget | `/budget-service/budget` |

All endpoints require `Authorization: Bearer <token>` header except `/auth-service/login` and `/auth-service/register`.