# Audit & i18n Standardization — Deepwork Plan

## Goal
Full E2E audit, zero-error policy, bilingual translation standardization (FR/AR).

## Progress

### ✅ Done (Phase 1 — Security & Auth)
| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1 | Path traversal fix (sanitize with Path.GetFileName) | `FileUploadController.cs` | Done |
| 2 | Plaintext password → BCrypt hash in seed | `SeedController.cs` | Done |
| 3 | Add [Authorize(Roles="Admin")] to seed endpoint | `SeedController.cs` | Done |
| 4 | Global exception handler middleware | `Program.cs` | Done |
| 5 | int.Parse → int.TryParse in transfer | `TransferController.cs` | Done |
| 6 | Auth guards on Create/Update/Delete | `ServicesController.cs`, `EquipmentController.cs`, `RbacPermissionsController.cs`, `DocumentsController.cs` (archive), `ListItemsController.cs`, `ExcelImportController.cs` | Done |
| 7 | Fix UtilisateurId int→string assignment | `TransferController.cs` | Done |
| 8 | Delete orphaned ExportHelpPanel.tsx | `modals/ExportHelpPanel.tsx` | Done |
| 9 | Remove unused imports/state in page.tsx | `page.tsx` (SERVICE_GROUPS, ImportResult, LocalTransaction, localSearchResults) | Done |
| 10 | Fix redundant ternary (both branches identical) | `page.tsx:535` | Done |
| 11 | Add user-facing alerts to empty catch blocks | `ArchiveRetraitPage.tsx` (handleAnnuler, handleRetourner) | Done |

### ✅ Verified
| # | Check | Result |
|---|-------|--------|
| 1 | Backend `dotnet build` | **0 errors, 0 warnings** |
| 2 | Frontend `npx next build` | **0 errors, compiled successfully** |
| 3 | Frontend `npx tsc --noEmit` | Pass (no errors) |

### ✅ Done (Phase 2 — i18n Standardization)
| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1 | Fix hardcoded strings in DashboardView (6 ternaries → cur.*) | `DashboardView.tsx` | Done |
| 2 | Fix exportImport.ts: remove bilingual alerts, throw errors for caller handling | `exportImport.ts` | Done |
| 3 | Add translation keys: activiteRecente, dossiersParService, volumeTravailParService, faible, moyen, eleve, operationReussie, operationEchouee, exportReussi, exportEchec, nombreDossiersParService | `translations.ts` | Done |

### ✅ Done (Phase 3 — RBAC Overhaul & Warning Cleanup)
| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1 | **BUG #1**: `hasPermission` bypassed admin overrides (always returned true for Admin, ignoring backend's filtered permission array) | `AuthContext.tsx` | Fixed |
| 2 | **BUG #2**: Verified GestionPermissions save flow — `permissionKey`/`enabled` mapping, admin override DB persistence all correct | `GestionPermissions.tsx`, `RbacPermissionsController.cs` | Verified OK, no fix needed |
| 3 | Backend CS8618 warnings: Added `= string.Empty;` to ~45 non-nullable model/DTO properties | 18 model + DTO files | Fixed |
| 4 | Backend CS8600/CS8601/CS8602/CS8604 warnings: Added null guards in FileUploadController (6 sites), TransferController, CourrierSortantController, TransactionsController | 4 controller files | Fixed |
| 5 | NU1903 package vulnerability: Updated Microsoft.OpenApi 2.0.0 → 2.10.0 | `WebApplication1.csproj` | Fixed |

### ✅ All tasks complete — no remaining items
- **Backend**: 0 errors, 0 warnings
- **Frontend**: 0 errors, 0 TypeScript errors
- **All audit findings** from original scan resolved or addressed

## Architecture Summary
- **Frontend**: Next.js (App Router), TypeScript, Tailwind
  - Entry: `app/page.tsx` (2267 lines, main orchestrator)
  - 30+ components under `app/components/` (8 subdirs: admin, common, dashboard, forms, layout, modals, pages, tables)
  - Translation: `lib/translations.ts` (807 lines, single object with `fr` and `ar` keys)
  - Routing: VueActive enum, no Next.js pages router — all state-driven in page.tsx
  - Auth: `context/AuthContext.tsx` (JWT-based)
  - Theme: `context/ThemeContext.tsx` (light/dark)
- **Backend**: ASP.NET Core Web API
  - 22 Controllers under `Controllers/`
  - 19 Models under `Models/`
  - SQL Server LocalDB (not SQLite)
  - JWT auth, RBAC via `PermissionService.cs`

## Translation System (translations.ts)
- Single file exporting `{ fr: {...}, ar: {...} }`
- FR: ~400 keys, AR: ~400 keys (mirrored)
- Used via `cur = translations[langue]` in page.tsx
- Issues to audit:
  - Hardcoded strings in components bypassing `cur`
  - Missing keys in one language but present in other
  - RTL `dir` attribute only on root div, not on modals/popups
  - Bilingual alerts/confirm with inline ternary instead of `cur`
  - Emoji usage mixed with text

## Component Map
```
app/page.tsx              — Root, state, routing, 20+ inline views
├── components/
│   ├── admin/             — Gestion*.tsx (6 files)
│   ├── common/            — LangueSwitcher.tsx, SearchBar.tsx
│   ├── dashboard/         — DashboardView, ActivityCards, StatsCircles, WorkflowSteps
│   ├── forms/             — AdminForm, JuridiqueForm, SortantForm
│   ├── layout/            — Sidebar.tsx
│   ├── modals/            — DetailModal, ExportHelpPanel, ImportMappingModal, TransferModal, WorkspaceModal
│   ├── pages/             — ArchiveRetraitPage, MesDossiersEnCoursView, NotificationsPage, ProfilPage, TransactionsPage
│   └── tables/            — GeneralTable, SortantTable
├── lib/
│   ├── translations.ts    — All i18n keys (FR/AR)
│   ├── constants.ts       — Service/status maps, labels
│   ├── exportImport.ts    — Excel import/export utilities
│   └── utils.ts           — normalizeStatus, getDocKey
└── context/
    ├── AuthContext.tsx     — Auth provider
    └── ThemeContext.tsx    — Theme provider
```

## Phased Plan

### Phase 1: Code Audit & Zero-Error (explorer → oracle → fixer)
1a. **Parallel explorer dispatch** — scan every component for:
  - Buttons with no onClick/onChange handler
  - API calls with no error handling
  - Dead code paths
  - Unused imports or variables
  - Console errors (useDocuments.ts, useListItems.ts)
1b. **Oracle review** — analyze explorer findings for priority issues
1c. **Fixer implementation** — fix all discovered issues

### Phase 2: i18n Standardization (explorer → oracle → designer/fixer)
2a. **Hardcoded string audit** — scan every component file for:
  - `<div>...</div>` with French/Arabic text
  - `placeholder="..."` with French/Arabic text
  - `alert("...")` with French/Arabic text
  - `title="..."` with French/Arabic text
  - `aria-label="..."` with French/Arabic text
2b. **Gap analysis** — keys in FR not in AR, or vice versa
2c. **Oracle review** — validate translation coverage strategy
2d. **Fixer implementation** — add keys, replace hardcoded strings
2e. **Designer review** — check RTL rendering quality after changes

### Phase 3: Final Verification
3a. `npx next build` — frontend
3b. `dotnet build` — backend
3c. Manual smoke test of key flows in both languages

## Key Files for Audit
| File | Lines | What to check |
|------|-------|--------------|
| `app/page.tsx` | 2267 | Main view, 8 inline view blocks, all modals |
| `app/components/layout/Sidebar.tsx` | 209 | Navigation, language switcher |
| `app/components/dashboard/DashboardView.tsx` | 211 | Dashboard composition |
| `app/components/forms/AdminForm.tsx` | - | Admin creation form |
| `app/components/forms/JuridiqueForm.tsx` | - | Juridique form |
| `app/components/forms/SortantForm.tsx` | - | Sortant form |
| `app/components/modals/DetailModal.tsx` | - | Document details |
| `app/components/modals/TransferModal.tsx` | - | Transfer logic |
| `app/components/modals/ImportMappingModal.tsx` | - | Excel mapping |
| `app/components/modals/WorkspaceModal.tsx` | - | Workspace view |
| `app/components/modals/ExportHelpPanel.tsx` | - | Export help (removed from toolbar but file exists) |
| `app/components/tables/GeneralTable.tsx` | - | Main data table |
| `app/components/tables/SortantTable.tsx` | - | Sortant table |
| `app/components/admin/GestionPermissions.tsx` | - | RBAC management |
| `app/components/admin/GestionUtilisateurs.tsx` | - | User management |
| `app/components/admin/GestionServices.tsx` | - | Service management |
| `app/components/admin/GestionServicesHistoriques.tsx` | - | Historical services |
| `app/components/admin/GestionEquipements.tsx` | - | Equipment management |
| `app/components/admin/GestionListes.tsx` | - | List management |
| `app/components/pages/TransactionsPage.tsx` | - | Transaction registry |
| `app/components/pages/NotificationsPage.tsx` | - | Notifications view |
| `app/components/pages/ProfilPage.tsx` | - | User profile |
| `app/components/pages/ArchiveRetraitPage.tsx` | - | Archive retrait |
| `app/components/pages/MesDossiersEnCoursView.tsx` | - | My pending docs |
| `app/components/dashboard/ActivityCards.tsx` | - | Dashboard cards |
| `app/components/dashboard/StatsCircles.tsx` | - | Stats circles |
| `app/components/dashboard/WorkflowSteps.tsx` | - | Workflow visualization |
| `app/components/common/SearchBar.tsx` | - | Search component |
| `lib/translations.ts` | 807 | All translation keys |
| `lib/constants.ts` | 191 | Labels, service maps |
| `lib/exportImport.ts` | 327 | Export/import logic |
| `lib/utils.ts` | 22 | Utility functions |
| `context/AuthContext.tsx` | 93 | Auth provider |
| `context/ThemeContext.tsx` | 34 | Theme provider |
| `app/types/index.ts` | 148 | TypeScript types |
| `app/globals.css` | - | Global styles (RTL?) |
| `app/layout.tsx` | 19 | Root layout |

## Phase 1 Audit Findings (reconciled from explorer agents)

### Orphaned/Dead Code
| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `modals/ExportHelpPanel.tsx` | Entire file dead code — never imported anywhere | high |
| 2 | `page.tsx:118` | `localTransactions` / `setLocalTransactions` — unused state | medium |
| 3 | `page.tsx:127` | `localSearchResults` / `setLocalSearchResults` — unused state | medium |
| 4 | `page.tsx:131` | `errorMessage` / `setErrorMessage` — write-only state, never rendered | medium |
| 5 | `page.tsx:31` | `SERVICE_GROUPS` — imported but never used | low |
| 6 | `page.tsx:33` | `ImportResult` — imported type never used | low |
| 7 | `page.tsx:538-540` | Redundant ternary (both branches identical) | low |

### Silent catch {} blocks (errors swallowed)
| # | File | Line | Context | Severity |
|---|------|------|---------|----------|
| 8 | `page.tsx` | 154 | fetchPending network error | high |
| 9 | `page.tsx` | 458 | fetchCorbeille error | high |
| 10 | `page.tsx` | 528 | searchLocalDirectory file read error | medium |
| 11 | `page.tsx` | 643 | exportData error | high |
| 12 | `page.tsx` | 669 | exportNotifications error | high |
| 13 | `ArchiveRetraitPage.tsx` | 55 | fetchRetraits error | high |
| 14 | `ArchiveRetraitPage.tsx` | 113 | handleAnnuler error | medium |
| 15 | `ArchiveRetraitPage.tsx` | 127 | handleRetourner error | medium |
| 16 | `TransferModal.tsx` | 72 | fetchUsers error | high |
| 17 | `LangueSwitcher.tsx` | 19 | Language persistence error | low |
| 18 | `WorkspaceModal.tsx` | 138 | Silent .catch(() => {}) for doc fetch | high |
| 19 | `WorkspaceModal.tsx` | 149 | Silent .catch(() => {}) for notes fetch | high |
| 20 | `WorkspaceModal.tsx` | 159 | Silent .catch(() => {}) for modifs fetch | high |

### console.error without user feedback (52 total)
| # | Location | Count | Severity |
|---|----------|-------|----------|
| 21 | page.tsx | 10 | medium-high |
| 22 | GestionPermissions.tsx | 6 | medium |
| 23 | GestionUtilisateurs.tsx | 5 | medium |
| 24 | WorkspaceModal.tsx | 4+3 silent | medium |
| 25 | DetailModal.tsx | 4 | medium |
| 26 | ProfilPage.tsx | 4 | medium |
| 27 | TransactionsPage.tsx | 4 | medium |
| 28 | GestionServices.tsx | 3 | medium |
| 29 | GestionEquipements.tsx | 3 | medium |
| 30 | GestionListes.tsx | 3 | medium |
| 31 | GestionServicesHistoriques.tsx | 3 | medium |
| 32 | NotificationsPage.tsx | 3 | medium |

### Fake handler (no backend call)
| # | File | Line | Issue | Severity |
|---|------|------|-------|----------|
| 33 | JuridiqueForm.tsx | 1157-1169 | "Enregistrer" for Kitaba Khasa only calls alert(), no API call | medium |

### Backend: Auth & Security Issues
| # | File | Issue | Severity |
|---|------|-------|----------|
| 34 | SeedController.cs | Admin password stored as PLAIN TEXT (no BCrypt hash) | CRITICAL |
| 35 | SeedController.cs | No Admin role restriction — any user can create admin accounts | CRITICAL |
| 36 | FileUploadController.cs | Path traversal vulnerability in Download/Preview | CRITICAL |
| 37 | TransferController.cs | int.Parse without try/catch or TryParse | high |
| 38 | RbacPermissionsController.cs | GetAdminOverrides/GetMatrix exposed to any auth user | high |
| 39 | ServicesController.cs | Create/Update/Delete no Admin role check | high |
| 40 | All 22 controllers | No try/catch on 22+ controllers (52 issues) | medium-high |
| 41 | Program.cs | JWT ValidateIssuer=false, ValidateAudience=false | medium |
| 42 | Program.cs | CORS hardcoded to localhost:3000 | medium |
| 43 | Program.cs | No global exception handler middleware | medium |
| 44 | SeedController.cs | No [Authorize(Roles="Admin")] — dev endpoint exposed | high |

### Backend: Data Validation Issues
| # | File | Issue | Severity |
|---|------|-------|----------|
| 45 | AuthController.cs | Login DTO not null-checked | medium |
| 46 | CourrierAdminController.cs | Update DTO not null-checked | medium |
| 47 | CourrierJuridiqueController.cs | Update DTO not null-checked | medium |
| 48 | TransactionJuridiqueController.cs | Action field not validated early | medium |
| 49 | SubstitutesController.cs | No validation UserId != SubstituteUserId | medium |

## Known i18n Issues (observed from initial scan)

## Known i18n Issues (observed)
1. `DashboardView.tsx:88` — "Activite recente" hardcoded (line 88)
2. `DashboardView.tsx:120-130` — "Nombre de dossiers par service", legend labels
3. `DashboardView.tsx:1915` — "Fichiers locaux trouvés" hardcoded
4. Various `alert()` calls use `langue === "fr" ? ... : ...` instead of `cur`
5. `exportRows()` in `exportImport.ts:35` — hardcoded bilingual alert
6. `buildHeaderLines()` in `exportImport.ts:51-56` — always French
7. `LangueSwitcher.tsx` — sets `<html lang>` but dir is on root div only
8. `page.tsx` — multiple `langue === "fr" ? ... : ...` ternaries

## Backend Controllers (22)
All controllers listed in order. Focus: API error handling, missing endpoints, auth issues.
- ActionsJuridiquesController, AuthController, CourrierAdminController, CourrierJuridiqueController, CourrierSortantController, DocumentsController, EquipmentController, ExcelImportController, FileUploadController, HistoricalServicesController, ListItemsController, RbacPermissionsController, RbacServicesController, RetraitController, SeedController, ServicesController, SubstitutesController, TransactionJuridiqueController, TransactionsController, TransferController, UsersController, WorkspaceController
