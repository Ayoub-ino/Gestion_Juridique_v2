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
- **Multi-Service Routing**: Transfer documents between tribunal services; naming several recipients hands each of them their own independent copy of the folder
- **Reception Handshake**: A folder stays with the sender until the destination accepts it — a refusal keeps it in place and notifies the sender with the reason given
- **Dynamic Destination Picker**: The juridical form routes a folder by choosing a live service (plus an optional member of it) — the catalog is read from the database, so new services appear with no restart
- **Service-Based Custody**: Only the service currently holding a folder can edit, modify, or transfer it
- **Dynamic Service Catalog**: Services are resolved from the live database — no hardcoded labels
- **RBAC Permission System**: 18 dynamic permissions controlling both API access and UI visibility
- **Admin Override Layer**: Admin user has disabled-by-default permissions to prevent routine operations
- **Historical Services**: Record-only entities for audit trails — transfers add to history without moving custody
- **Service Soft-Delete**: Archive/restore services without data loss; permanent delete with safety guards
- **Bilingual Interface**: Full French/Arabic support with RTL layout and proper Arabic terminology
- **Transaction Lifecycle**: Full sender → receiver workflow with accept, refuse, cancel, and notification sync
- **Import/Export**: Excel and Word document import/export with self-seeding E2E tests
- **Dashboard & Analytics**: Real-time document statistics and a workflow pipeline built from the live service catalog — adding, renaming or archiving a service changes the stages immediately
- **Dark/Light Theme**: Toggle between themes with persistent preference
- **In-App Feedback**: Toast notifications and confirmation dialogs replacing native browser alerts

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
Gestion_Juridique-main/
├── WebApplication1/                    # Backend (.NET)
│   ├── WebApplication1/
│   │   ├── Controllers/                # API controllers
│   │   │   ├── AuthController.cs       # Login, logout, /me
│   │   │   ├── DocumentsController.cs  # CRUD + archive + permanent delete
│   │   │   ├── TransferController.cs   # Folder transfer between services
│   │   │   ├── TransactionsController.cs  # Accept/refuse/cancel transfers
│   │   │   ├── CourrierAdminController.cs
│   │   │   ├── CourrierJuridiqueController.cs
│   │   │   ├── CourrierSortantController.cs
│   │   │   ├── UsersController.cs
│   │   │   ├── RbacPermissionsController.cs
│   │   │   ├── RbacServicesController.cs
│   │   │   ├── WorkspaceController.cs  # Document access control
│   │   │   └── ... (12 controllers total)
│   │   ├── Models/                     # EF Core entity models + enums
│   │   │   ├── Document.cs
│   │   │   ├── CourrierAdministratif.cs
│   │   │   ├── DossierJuridique.cs
│   │   │   ├── CourrierSortant.cs
│   │   │   ├── Transaction.cs
│   │   │   ├── Utilisateur.cs
│   │   │   ├── Service.cs
│   │   │   ├── ServicePermission.cs
│   │   │   ├── DocumentAccess.cs
│   │   │   ├── ServiceTribunal.cs      # Legacy enum (mapped to RBAC codes)
│   │   │   ├── StatutDossier.cs
│   │   │   ├── StatutTransaction.cs
│   │   │   └── ... (18 models total)
│   │   ├── Services/                   # Business logic services
│   │   │   ├── DocumentAccessService.cs    # ACL + custody checks
│   │   │   ├── TransactionService.cs       # Transfer lifecycle
│   │   │   ├── PermissionService.cs        # Dynamic RBAC
│   │   │   ├── PermissionValidationService.cs
│   │   │   ├── ServiceCatalog.cs           # Live service resolution
│   │   │   ├── SeederService.cs            # DB seed on startup
│   │   │   └── WorkspaceService.cs
│   │   ├── Security/                   # RequirePermission attribute
│   │   ├── Middleware/                 # Auth & permission middleware
│   │   ├── Helpers/                    # ServiceMapper, utility helpers
│   │   ├── Data/                       # AppDbContext
│   │   ├── Migrations/                 # EF Core database migrations
│   │   └── Program.cs                  # Application entry point
│   └── WebApplication1.Tests/          # xUnit unit tests (125 tests)
│
├── frontend-juridique/                 # Frontend (Next.js)
│   ├── app/
│   │   ├── page.tsx                    # Main SPA entry point
│   │   ├── layout.tsx                  # Root layout with providers
│   │   ├── components/
│   │   │   ├── admin/                  # GestionUtilisateurs, GestionServices,
│   │   │   │                           # GestionPermissions, GestionEquipements,
│   │   │   │                           # GestionListes, GestionServicesHistoriques
│   │   │   ├── modals/                 # TransferModal, WorkspaceModal, DetailModal
│   │   │   ├── pages/                  # LoginPage, NotificationsPage, TransactionsPage,
│   │   │   │                           # MesEntitesView, ArchivesView, ProfilPage
│   │   │   ├── tables/                 # GeneralTable
│   │   │   ├── layout/                 # Sidebar, Header
│   │   │   ├── dashboard/              # DashboardView, WorkflowSteps, StatsCircles
│   │   │   ├── forms/                  # AdminForm, JuridiqueForm, SortantForm
│   │   │   └── common/                 # FeedbackHost, LangueSwitcher, ExportButtons
│   │   ├── hooks/                      # useDocuments, useListItems, useServiceLabels,
│   │   │                               # useServiceOptions
│   │   └── types/                      # TypeScript type definitions
│   ├── context/                        # AuthContext, ThemeContext
│   ├── lib/
│   │   ├── translations.ts             # FR/AR bilingual translations
│   │   ├── constants.ts                # Service groups, safeGetServiceLabel()
│   │   ├── exportImport.ts             # Excel/Word export (dynamic imports)
│   │   ├── feedback.ts                 # Toast + confirm dialog (replaces alert/confirm)
│   │   ├── api/                        # HTTP client wrapper
│   │   ├── types/                      # api.generated.ts (OpenAPI types)
│   │   └── utils.ts                    # getDocServiceCode, isDocInService, etc.
│   ├── cypress/
│   │   ├── e2e/                        # E2E test specs (94 tests across 11 specs)
│   │   │   ├── app.cy.ts               # Core app flows (35 tests)
│   │   │   ├── permission-toggle.cy.ts # Permission CRUD (27 tests)
│   │   │   ├── dynamic-service-transfer.cy.ts  # Transfer custody flow (9 tests)
│   │   │   ├── corbeille-vider.cy.ts   # Trash purge scoping (4 tests)
│   │   │   ├── juridique-destination.cy.ts  # Destination picker (3 tests)
│   │   │   ├── workflow-pipeline.cy.ts # Pipeline follows the catalog (4 tests)
│   │   │   ├── repeated-actions.cy.ts  # Regression: repeated clicks (3 tests)
│   │   │   ├── export.cy.ts            # Excel/Word export (3 tests)
│   │   │   ├── recherche-dossiers.cy.ts # Search filters (3 tests)
│   │   │   ├── admin-boundaries.cy.ts  # Admin role isolation (2 tests)
│   │   │   └── permission-persistence.cy.ts  # Permission reload (1 test)
│   │   └── support/                    # dbCleanup.ts (fixture purge), commands.ts
│   └── public/                         # Static assets
│
├── dbinitialisation/
│   ├── README.md                       # Seed logic + default accounts
│   └── grant-permissions-existing-db.sql
│
├── CHANGELOG_AGENTS.md                 # Agent session log
├── PERMISSION_MATRIX.md                # Permission reference
└── README.md
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
# Backend unit tests (125 tests)
cd WebApplication1/WebApplication1.Tests
dotnet test

# Frontend E2E tests (94 tests across 11 specs)
cd frontend-juridique
CYPRESS_API_URL=http://localhost:5200 npx cypress run

# Frontend type check
cd frontend-juridique
npx tsc --noEmit

# Frontend lint
cd frontend-juridique
npx eslint .
```

### Test breakdown

| Test Suite | Count | Command |
|---|---|---|
| Backend unit tests | 125 | `dotnet test` |
| Cypress E2E — app.cy.ts | 35 | `npx cypress run --spec cypress/e2e/app.cy.ts` |
| Cypress E2E — permission-toggle.cy.ts | 27 | `npx cypress run --spec cypress/e2e/permission-toggle.cy.ts` |
| Cypress E2E — dynamic-service-transfer.cy.ts | 9 | `npx cypress run --spec cypress/e2e/dynamic-service-transfer.cy.ts` |
| Cypress E2E — export.cy.ts | 3 | `npx cypress run --spec cypress/e2e/export.cy.ts` |
| Cypress E2E — repeated-actions.cy.ts | 3 | `npx cypress run --spec cypress/e2e/repeated-actions.cy.ts` |
| Cypress E2E — admin-boundaries.cy.ts | 2 | `npx cypress run --spec cypress/e2e/admin-boundaries.cy.ts` |
| Cypress E2E — permission-persistence.cy.ts | 1 | `npx cypress run --spec cypress/e2e/permission-persistence.cy.ts` |
| Cypress E2E — recherche-dossiers.cy.ts | 3 | `npx cypress run --spec cypress/e2e/recherche-dossiers.cy.ts` |
| Cypress E2E — corbeille-vider.cy.ts | 4 | `npx cypress run --spec cypress/e2e/corbeille-vider.cy.ts` |
| Cypress E2E — juridique-destination.cy.ts | 3 | `npx cypress run --spec cypress/e2e/juridique-destination.cy.ts` |
| Cypress E2E — workflow-pipeline.cy.ts | 4 | `npx cypress run --spec cypress/e2e/workflow-pipeline.cy.ts` |
| **Total** | **219** | |

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
| `fathmilafat` | `fathmilafat123` | User | Ouverture des dossiers | Juridical case tracking |
| `secretarait` | `secretarait123` | User | Secrétariat général | Secretary functions |
| `seances` | `seances123` | User | Séances & Procédures | Hearing management |
| `khibra` | `khibra123` | User | Expertise judiciaire | Judicial expertise |
| `taslimnosakh` | `taslim123` | User | Délivrance des copies | Copy delivery |
| `tasfiya` | `tasfiya123` | User | Règlement des dépens | Cost settlement |
| `archive` | `archive123` | User | Archive | Document archival |
| `atabligh` | `atabligh123` | User | Notification | Notification service |

---

## 📄 License

This project is for educational purposes (stage/stage SICOM).

---

> Last verified: September 2026 — 125 unit tests, 94 E2E tests ✅
> All 208 tests passing. 0 ESLint errors, 0 TypeScript errors, 0 unused imports.
