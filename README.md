# ⚖️ Gestion Juridique — Système de Gestion des Dossiers Judiciaires

> Full-stack web application for managing judicial documents, court correspondence, and legal workflows in a Moroccan tribunal setting.

Built with **Next.js 16** (React 19) frontend and **ASP.NET Core 10** backend with **SQL Server** database.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Setup & Installation](#-setup--installation)
- [Running the Application](#-running-the-application)
- [Testing](#-testing)
- [Architecture](#-architecture)
- [RBAC Permission System](#-rbac-permission-system)
- [Available Scripts](#-available-scripts)
- [Default Users](#-default-users)

---

## ✨ Features

- **Document Management**: Create, edit, transfer, and archive administrative and juridical correspondence
- **Multi-Service Routing**: Transfer documents between tribunal services with single or multi-user assignment
- **RBAC Permission System**: 18 dynamic permissions controlling both API access and UI visibility
- **Admin Override Layer**: Admin user has 20 disabled-by-default permissions to prevent routine operations
- **Historical Services**: Record-only entities for audit trails — transfers auto-accept since no users log in
- **Service Soft-Delete**: Archive/restore services without data loss; permanent delete with safety guards
- **Bilingual Interface**: Full French/Arabic support with RTL layout
- **Import/Export**: Excel and Word document import/export
- **Dashboard & Analytics**: Real-time document statistics and workflow visualization
- **Dark/Light Theme**: Toggle between themes with persistent preference

---

## 🛠 Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.9 | React framework with App Router |
| React | 19.2.4 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| Cypress | 15.x | End-to-end testing |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| ASP.NET Core | 10.0 | Web API framework |
| Entity Framework Core | 10.0 | ORM & database access |
| SQL Server (LocalDB) | — | Database |
| BCrypt.Net | 4.2.0 | Password hashing |
| JWT Bearer Auth | 10.0 | Token-based authentication |

---

## 📁 Project Structure

```
projet-gestion-juridique-main/
├── WebApplication1/                    # Backend (.NET)
│   ├── WebApplication1/
│   │   ├── Controllers/                # API controllers (12 endpoints)
│   │   ├── Models/                     # EF Core entity models
│   │   ├── Services/                   # Business logic services
│   │   ├── Security/                   # RequirePermission attribute
│   │   ├── Middleware/                 # Auth & permission middleware
│   │   ├── Migrations/                 # EF Core database migrations
│   │   ├── Core/Enums/                 # ServiceTribunal, StatutDossier, etc.
│   │   ├── DTO/                        # Data Transfer Objects
│   │   ├── Helpers/                    # Utility helpers
│   │   ├── data/                       # DbContext (AppDbContext)
│   │   └── Program.cs                  # Application entry point
│   └── WebApplication1.Tests/          # xUnit unit tests (85 tests)
│
├── frontend-juridique/                 # Frontend (Next.js)
│   ├── app/
│   │   ├── page.tsx                    # Main SPA entry point
│   │   ├── layout.tsx                  # Root layout with providers
│   │   ├── components/
│   │   │   ├── admin/                  # Admin panels (GestionUtilisateurs, GestionServices, etc.)
│   │   │   ├── modals/                 # Transfer, Workspace, Detail modals
│   │   │   ├── pages/                  # LoginPage, NotificationsPage, etc.
│   │   │   ├── tables/                 # GeneralTable, SortantTable
│   │   │   ├── layout/                 # Sidebar, Header
│   │   │   ├── dashboard/              # DashboardView
│   │   │   └── common/                 # ExportButtons, shared components
│   │   ├── hooks/                      # useDocuments, useListItems
│   │   └── types/                      # TypeScript type definitions
│   ├── context/                        # AuthContext, ThemeContext
│   ├── lib/
│   │   ├── translations.ts             # FR/AR bilingual translations
│   │   ├── constants.ts                # Service groups, enums
│   │   ├── exportImport.ts             # Excel/Word export logic
│   │   ├── api/                        # HTTP client wrapper
│   │   └── utils.ts                    # Utility functions
│   ├── cypress/
│   │   └── e2e/                        # E2E test specs (59 tests)
│   └── public/                         # Static assets
│
├── scripts/
│   ├── permission-audit.sh             # RBAC endpoint audit (46 checks)
│   ├── generate-permission-matrix.sh   # Auto-generate permission docs
│   └── grant-permissions-existing-db.sql
│
├── dbinitialisation/                   # Database seed scripts
└── PERMISSION_MATRIX.md                # Auto-generated permission reference
```

---

## 📦 Prerequisites

- **.NET 10 SDK** — [Download](https://dotnet.microsoft.com/download/dotnet/10.0)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **SQL Server LocalDB** — Included with Visual Studio or [SQL Server Express](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)
- **Git** — For version control

---

## ⚙️ Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/Ayoub-ino/Gestion_Juridique.git
cd Gestion_Juridique
```

### 2. Backend setup

```bash
cd WebApplication1

# Restore NuGet packages
dotnet restore

# Apply database migrations
dotnet ef database update --project WebApplication1

# Build the project
dotnet build
```

### 3. Frontend setup

```bash
cd frontend-juridique

# Install dependencies
npm install
```

### 4. Seed the database

Start the backend first (see below), then seed:

```bash
# Login as admin to get token
ADMIN=$(curl -s http://localhost:5200/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Seed database with default users and permissions
curl -X POST http://localhost:5200/api/seed/run \
  -H "Authorization: Bearer $ADMIN"
```

---

## 🚀 Running the Application

### Start the backend (port 5200)

```bash
cd WebApplication1
dotnet run --project WebApplication1
```

### Start the frontend (port 3000)

```bash
cd frontend-juridique
npm run dev
```

### Access the application

Open **http://localhost:3000** in your browser.

---

## 🧪 Testing

### Run all tests

```bash
# Backend unit tests (85 tests)
cd WebApplication1
dotnet test WebApplication1.Tests/WebApplication1.Tests.csproj

# Frontend E2E tests (59 tests)
cd frontend-juridique
npx cypress run

# Permission audit (46 checks)
bash scripts/permission-audit.sh
```

### Test breakdown

| Test Suite | Count | Command |
|---|---|---|
| Backend unit tests | 85 | `dotnet test` |
| Cypress E2E — app.cy.ts | 35 | `npx cypress run --spec cypress/e2e/app.cy.ts` |
| Cypress E2E — permission-toggle | 24 | `npx cypress run --spec cypress/e2e/permission-toggle.cy.ts` |
| Permission audit | 46 | `bash scripts/permission-audit.sh` |

---

## 🏗 Architecture

### Request Flow

```
Browser → Next.js (port 3000) → ASP.NET API (port 5200) → SQL Server
                                        ↓
                                  JWT Auth Middleware
                                        ↓
                              Permission Validation Middleware
                                        ↓
                                   Controller → Service → EF Core → DB
```

### Authentication Flow

1. User submits credentials → `POST /api/auth/login`
2. Backend validates credentials (BCrypt) → returns JWT token
3. Frontend stores token in `AuthContext` (in-memory)
4. All API requests include `Authorization: Bearer <token>` header
5. `RequirePermission` attribute on controllers enforces RBAC

### Permission Evaluation (Backend)

```
Request → JwtBearerHandler → RequirePermission Middleware
    → Load user's service permissions from DB
    → Apply admin overrides (if Admin role)
    → Check: Is the required permission enabled?
        → Yes: proceed to controller
        → No: return 403 Forbidden
```

### Permission Evaluation (Frontend)

```
AuthContext.permissions (from /api/auth/me)
    → hasPermission(key) checks admin overrides for Admin users
    → Page-level: useEffect redirects unauthorized views to dashboard
    → Component-level: {canTransfer && <Button />}
    → Completely hides unauthorized UI elements from DOM
```

---

## 🔐 RBAC Permission System

The application uses a **service-level RBAC** system with **18 permission keys**:

| Category | Permissions |
|---|---|
| Documents | `creer_modifier`, `creer_courrier_admin`, `creer_courrier_juridique`, `supprimer`, `transferer`, `archiver`, `restaurer`, `voir_corbeille` |
| Juridique | `transferer_juridique`, `retrait_archive`, `etape_precedente`, `etape_suivante`, `ouvrir_dossier`, `cloturer` |
| Notifications | `accepter`, `refuser`, `voir_toutes` |
| Recherche | `recherche_avancee`, `export_excel`, `export_word` |
| Administration | `gerer_utilisateurs`, `gerer_services`, `gerer_permissions`, `gerer_equipements`, `gerer_listes` |

**How it works:**
- Each service (e.g., `bureauordre`, `archive`) has its own set of enabled/disabled permissions
- The Admin user has an override layer: 20 permissions are disabled by default to prevent routine operations
- Permissions dynamically control both API access (403 on disabled) and UI visibility (hidden from DOM)

See [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) for the complete reference.

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `bash scripts/permission-audit.sh` | Run 46 RBAC endpoint checks (enabled/disabled for each permission) |
| `bash scripts/generate-permission-matrix.sh` | Auto-generate PERMISSION_MATRIX.md from codebase scan |
| `npm run dev` | Start Next.js dev server with Webpack |
| `npm run dev:turbo` | Start Next.js dev server with Turbopack |
| `npm run build` | Build Next.js for production |
| `dotnet run --project WebApplication1` | Start ASP.NET backend |
| `dotnet test` | Run all .NET unit tests |

---

## 👥 Default Users

After seeding the database, these users are available:

| Login | Password | Role | Service | Description |
|---|---|---|---|---|
| `admin` | `admin123` | Admin | — | System administrator (limited permissions by default) |
| `bureauordre` | `bureauordre123` | User | Bureau d'ordre | Main document management |
| `fathmilafat` | `fathmilafat123` | User | Fathm Alafat | Juridical case tracking |
| `secretarait` | `secretarait123` | User | Secrétariat | Secretary functions |
| `archive` | `archive123` | User | Archive | Document archival |

---

## 📄 License

This project is for educational purposes (stage/stage SICOM).

---

> Auto-generated permission matrix: `bash scripts/generate-permission-matrix.sh`
> Last verified: September 2026 — 85 unit tests, 59 E2E tests, 46 audit checks ✅
