# ACME Project Hub

A project management application built for the AWS Workshop. Manages projects, deliverables, resources, and budgets with role-based access control.

## Tech Stack

- **Frontend:** React + Vite + Material UI
- **Backend:** Python Lambda functions (LocalStack locally, AWS Lambda on cloud)
- **Databases:** PostgreSQL (structured data) + MongoDB (unstructured data)
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

The start script handles PostgreSQL, MongoDB, LocalStack, all backend services, and the Vite frontend automatically.

## Test Accounts

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | admin@test.com | admin123 | Full access + user management |
| Manager | manager@test.com | manager123 | Create, edit, delete everything |
| Contributor | contributor@test.com | contributor123 | Create and edit, no delete |
| Viewer | viewer@test.com | viewer123 | Read-only |

## Features

- **Authentication** — Register, login, JWT session, protected routes
- **Projects** — Full CRUD with status/priority filtering and budget tracking
- **Deliverables** — Task tracking with project assignment, status, assignee
- **Resources** — Team capacity management with allocation tracking per project
- **Budget** — Expense and allocation tracking with per-project summaries
- **Dashboard** — Live stats: active projects, at-risk count, deliverables progress, over-allocated resources, budget overview

## Role-Based Access Control

- Public registration is limited to Viewer and Contributor roles
- Manager and Admin accounts are pre-seeded (privilege escalation prevention)
- Backend enforces role checks on every write/delete endpoint — not just UI
- Viewer POST attempts return 403 even via direct API call

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

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
