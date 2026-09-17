# CHANGELOG_AGENTS.md

Memory log for AI agent sessions working on this repository.
Append a new entry after every completed task using the format below.

---

## [2026-09-17] - Courrier Management Refactor: "Gérer les courriers" Consolidation

### 1. Context & Objective
- Consolidate the three separate mailing modules (`Courrier Administratif`,
  `Dossier Juridique`, `Courrier Sortant Normal`) into a single master tab
  **"Gérer les courriers"** with three sub-tabs.
- Align the forms with the supplied wireframes, purge the red-highlighted fields
  (**Provenance (Expéditeur)**, **Numéro interne**, **Année de numérotation**)
  from the Administratif form and from its creation payload.
- Enforce system-assigned values: `N° de bureau` = creator user id + year,
  `Service` = creator's originating service, `Numéro interne` = unique reference.
- Support "dossier lié" in the Juridique sub-tab: a document linked to an
  already-created folder **shares that folder's identification number** — the
  only case where two dossiers may carry the same reference.
- Preserve core business logic: transmissibility and document attachments.

### 2. Files Modified / Created / Deleted
- `[MODIFIED]` `frontend-juridique/lib/translations.ts` — renamed `juridique`
  to "Courrier Juridique" / "مراسلة قضائية واردة"; added `gererCourriers`,
  `ongletAdministratif`, `ongletJuridique`, `ongletSortant`, `numeroBureau`,
  `numeroDossierJuridique`, `typeDossier`, `autoYearSuffix`, `documentLie`,
  `dossierPrincipalTab`, `typeDocumentLie`, `sourceDocumentLie`,
  `choisirDossierParent`, `tribunalSource`.
- `[MODIFIED]` `frontend-juridique/app/components/layout/Sidebar.tsx` — the
  three menu entries collapsed into one **Gérer les courriers** button. The
  underlying `vueActive` value still carries the concrete type so the existing
  permission matrix stays authoritative.
- `[MODIFIED]` `frontend-juridique/app/page.tsx` — added `isCourrierView` and
  a `role="tablist"` sub-tab bar (Sortant / Judiciaire / Administratif, filtered
  by permission); header now shows "Gérer les courriers"; the shared
  Destinataire/Objet block now only serves the Juridique and Demande views;
  Administratif and Sortant creation payloads no longer send the removed
  fields; removed six now-dead `useState` declarations.
- `[MODIFIED]` `frontend-juridique/app/components/forms/AdminForm.tsx` —
  rewritten to the wireframe layout. Read-only `N° Bureau d'ordre` and `Service`;
  removed Provenance, Numéro interne and Année de numérotation inputs.
- `[MODIFIED]` `frontend-juridique/app/components/forms/SortantForm.tsx` —
  rewritten: owns Destinataire / Numéro de référence / Objet / Date; read-only
  auto `Service` and `N° Bureau d'ordre`; dropped the redundant type field and
  tribunal inputs.
- `[MODIFIED]` `frontend-juridique/app/components/forms/JuridiqueForm.tsx` —
  "dossier principal" / "document lié" toggle buttons; **Choisir un dossier
  parent** is now a live dropdown of existing dossiers (replacing the local
  directory picker) so a linked document inherits the parent's reference;
  read-only auto `N° Bureau d'ordre`.
- `[MODIFIED]` `frontend-juridique/cypress/e2e/app.cy.ts` — navigation updated
  to the consolidated tab + sub-tabs.
- `[MODIFIED]` `WebApplication1/WebApplication1/Models/CourrierAdministratif.cs`
  — added `Source`, `DateMessage`, `Etat`, `Notes`.
- `[MODIFIED]` `WebApplication1/WebApplication1/Models/DossierJuridique.cs` —
  added `NumeroPremiereInstance` and `DossierParentId` (self-referencing link
  for a linked document).
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/CourrierAdminController.cs`
  — server-side auto-fill of `N° de bureau` and `Expediteur` (from `Source`);
  `NumeroReference` is now the required unique identifier; `NumeroOrdre` kept as
  a legacy alias; new wireframe fields are persisted.
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/CourrierSortantController.cs`
  — `NumeroBureauOrdre` auto-assigned as `{userId}/{year}`.
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/CourrierJuridiqueController.cs`
  — linked-document handling (shared reference + `DossierParentId`, unknown
  parent → 400), auto `N° de bureau`, `NumeroPremiereInstance` persisted.
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/TransferController.cs`
  — transmissibility guard: a courrier marked `Non` is refused after its first
  transmission (403).
- `[CREATED]` `WebApplication1/WebApplication1/Migrations/*_AddGererCourriersFields.*`
  — migration for the new columns (applied automatically on startup by
  `SeederService`).
- `[CREATED]` `CHANGELOG_AGENTS.md` — this file (it had been removed from the
  working tree).

### 3. Key Technical & Architectural Decisions
- **Consolidation without duplicating the permission model.** The master tab
  does not introduce a new `VueActive` value; it reuses `entrant-admin` /
  `entrant-juridique` / `sortant-normal`. The sub-tab bar drives `vueActive`, so
  every existing backend permission check and route guard keeps working.
- **Auto-assignment moved to the server.** `N° de bureau` and `Expediteur` are
  derived in the controllers from the JWT, never trusted from the client.
- **Linked dossiers.** A linked document reuses its parent's `NumeroReference`
  and stores `DossierParentId`; the global uniqueness check on `NumeroReference`
  is bypassed *only* on that path. This is the sole exception to reference
  uniqueness.
- **Reference uniqueness on Administratif** now keys on `NumeroReference`
  (previously `NumeroReference ?? NumeroOrdre`); `NumeroOrdre` is now the
  system-generated `N° de bureau`.
- **Backward compatibility.** The DTO still accepts `NumeroOrdre` as an alias so
  existing API clients and E2E fixtures keep working.
- **Schema change via EF migration** (no manual SQL); `SeederService` runs
  `Database.Migrate()` at startup.

### 4. Verification & Test Results
| Suite | Result |
|---|---|
| Backend build | 0 errors, 0 warnings |
| Backend unit tests | 105/105 |
| Frontend `tsc --noEmit` | 0 errors |
| Frontend ESLint | 0 errors, 0 warnings |
| Frontend production build (`next build`) | Compiled successfully |
| Cypress E2E (7 specs) | 77/77 |

Targeted API verification (executed against a live backend):
- New Administratif payload → `numeroBureauOrdre = "2/2026"` (creator id 2 + year), `expediteur = "Ministere"` (derived from Source), `source` / `dateMessage` / `etat` / `notes` / `transmissible` persisted.
- Duplicate `numeroReference` → **409**.
- Legacy `NumeroOrdre`-only payload → **201**.
- Transmissibility: `transmissible=true` → 1st transfer 200, 2nd transfer 200; `transmissible=false` → 1st transfer 200, 2nd transfer **403** ("Ce courrier n'est pas transmissible…").
- Linked dossier: parent created → linked doc reuses the parent's reference and stores `dossierParentId`; unknown parent → **400**; duplicate reference without linking → **409**.
- Admin permission overrides and service permission sets were snapshotted and restored exactly after the verification runs.

### 5. Current System State & Pending Tasks
- **Status:** green. All builds, type checks, lint, unit tests and E2E tests pass.
- **Database:** purged of all test artefacts (0 active documents, 0 in trash).
- **Note:** `sortant-demande` ("Requêtes & Réclamations") intentionally remains a
  separate sidebar entry — the consolidation covers only the three modules named
  in the specification.
- **Pending / recommended next steps:**
  - `CourrierSortant` still has no `Notes`/`Etat` column; the Sortant form's
    Notes field is not yet persisted.
  - Visual pass against the reference wireframes would confirm grid alignment on
    narrow viewports.
  - Consider extending the transmissibility rule to Juridique and Sortant if
    those types ever need it.

---

## [2026-09-17] - "Gérer les courriers" Refined Against Reference Implementation

### 1. Context & Objective
- A reference implementation of the same feature was located at
  `D:\STAGE SICOM\Stage-de-projet-license-dans-cour-d-appele-administratif-de-fes-main`
  (React CRA `frontend/src/pages/GestionCourriers.js` + ASP.NET Core MVC
  `GestionCirculationWeb`). It is the app the reference screenshots were taken from
  and is a **different codebase** (unified `Courrier` entity, MVC, i18n locales).
- Objective: use that reference as the authoritative field spec and re-tune the
  `Gérer les courriers` tab already built in this repository so the placement,
  field set and buttons match, while keeping this project's own business logic
  (Mode de traitement, transmissibility, attachments).

### 2. Files Modified / Created
- `[MODIFIED]` `frontend-juridique/lib/translations.ts` — added `objetLabel`,
  `documentPdfWord`, `aucunFichier`, `ouvrirFichier` (FR + AR). Removed two
  duplicate keys (`choisirFichier`, `destinataireLabel`) that already existed.
- `[MODIFIED]` `frontend-juridique/app/components/forms/AdminForm.tsx` —
  `Transmissible` is now a single **"Oui" checkbox** (was Oui/Non radios);
  `N° Bureau d'ordre` displays the **creating user's id** with the
  `{year} / auto_year_suffix` hint beneath; Document is a **full-width row**
  with a preview box ("Aucun fichier sélectionné") and a "Choisir un fichier"
  button; Notes is a full-width row. Mode de traitement deliberately retained.
- `[MODIFIED]` `frontend-juridique/app/components/forms/SortantForm.tsx` —
  rewritten to the reference field set: **no "Numéro de référence" input**
  (assigned server-side), order `N° Bureau d'ordre · Service · Destinataire ·
  Objet · Date`, then full-width Document and Notes. Service is read-only.
- `[MODIFIED]` `frontend-juridique/app/components/forms/JuridiqueForm.tsx` —
  restructured into the reference grid. Row 1 (5 cols) `Objet · Tribunal/Source ·
  Date · Numéro dossier judiciaire · N° Bureau d'ordre` for a **dossier
  principal**; `Type du document lié · Source du document lié · Choisir un
  dossier parent · Date · N° Bureau d'ordre` for a **document lié**. Row 2
  (4 cols) `État · Service (read-only) · type de dossier · N° première instance`
  (or `Objet` for a linked document). Service is now read-only (was a select).
  Removed the `serviceGroups` select and the now-unused `useServiceOptions` import.
- `[MODIFIED]` `frontend-juridique/app/page.tsx` — removed the shared
  Destinataire/Objet/Reference/Service block entirely (each form now owns its
  fields); wired `setReference`/`setTiers`/`setObjet`/`sourceOptions`/
  `linkedDocumentType` into `JuridiqueForm`; the reference-required guard now
  applies only to the Administratif and Juridique sub-tabs; payloads gained
  `typeDossier` and `linkedDocumentType`; `juridiqueService` state replaced by
  `linkedDocumentType`.
- `[MODIFIED]` `WebApplication1/WebApplication1/Models/DossierJuridique.cs` —
  added `TypeDossier` and `LinkedDocumentType`.
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/CourrierJuridiqueController.cs`
  — `Reference` no longer `[Required]` (validated manually: required unless the
  entry is a linked document); `TypeDossier` / `LinkedDocumentType` persisted and
  updatable.
- `[MODIFIED]` `WebApplication1/WebApplication1/DTO/SortantDto.cs` — `Reference`
  made optional.
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/CourrierSortantController.cs`
  — when no reference is supplied, derives a unique one from the N° de bureau
  (`{userId}/{year}/{n}`, e.g. `2/2026/1`, `2/2026/2`); explicit references are
  still uniqueness-checked.
- `[CREATED]` `WebApplication1/WebApplication1/Migrations/*_AddJuridiqueTypeAndLinkedType.*`

### 3. Key Technical & Architectural Decisions
- **The reference is a spec, not a code source.** Its stack (CRA + MVC, unified
  `Courrier` entity) is incompatible with this repository's three-entity model
  (Next.js + Web API), so only the *field semantics and layout* were ported.
- **Field mapping applied end-to-end**, per the user's dictionary:
  `N° de bureau` ← creating user's id (+ year, server-side);
  `Numéro interne` ← `NumeroReference` (unique dossier id);
  `Service` ← the creator's originating service (read-only, dynamic label);
  `Tribunal / Source` ← `tiers`; `type de dossier` ← `TypeDossier`;
  `Numéro dossier judiciaire` ← `Reference` + `NumeroDossierJuridique`.
- **Reference uniqueness exception preserved**: only a linked document
  (`DossierLie` + `ParentReference`) may reuse an existing reference, and it now
  also records `DossierParentId` and `LinkedDocumentType`.
- **Sortant has no reference field** (matching the reference UI), so the backend
  derives uniquely from the N° de bureau — no collisions between users or years.
- **Mode de traitement retained** on the Administratif sub-tab (explicit user
  requirement) even though the reference layout has no equivalent control.

### 4. Verification & Test Results
| Suite | Result |
|---|---|
| Backend build | 0 errors, 0 warnings |
| Backend unit tests | 105/105 |
| Frontend `tsc --noEmit` | 0 errors |
| Frontend ESLint | 0 errors, 0 warnings |
| Frontend production build | compiled successfully |
| Cypress E2E (7 specs) | 77/77 |

Targeted live API verification:
- Sortant with no reference → `200`, generated `2/2026/1`; a second one → `2/2026/2`; `numeroBureauOrdre = 2/2026`.
- Juridique with `typeDossier` + `numeroPremiereInstance` → persisted (201).
- Linked document → `201`, shares the parent's `numeroReference`, `dossierParentId` set, `linkedDocumentType = expertise`.
- Juridique without a reference and not linked → `400` "Le numéro de référence est requis".
- Administratif auto-fill, duplicate-reference 409, legacy `NumeroOrdre` alias, and the transmissibility rule (first transfer 200, subsequent 403) re-verified.
- Admin permission overrides snapshotted and restored exactly.

### 5. Current System State & Pending Tasks
- **Status:** green — builds, types, lint, unit tests and E2E all pass.
- **Database:** purged of all test artefacts (0 active documents, 0 in trash).
- **Not carried over from the reference** (deliberate, needs a decision):
  the editable `idBureauOrdre` for admin/greffier (here it is always
  auto-filled from the creator); list-driven Excel import/export and the
  customisable column menu of the reference registry table.
- **Pending / recommended next steps:**
  - `CourrierSortant` still has no `Notes`/`Etat` column, so the Sortant Notes
    field is not yet persisted.
  - The reference's `Tribunal / Source` is a dedicated tribunal list; here it
    reuses the dynamic `Source` list — a dedicated list would be more accurate.
  - A visual pass against the reference screenshots on narrow viewports.

---

## [2026-09-17] - Remove Requêtes & Réclamations, DetailModal Fields, RechercheDossiers Filters, Dynamic Service Filters

### 1. Context & Objective
- Remove the **Requêtes & Réclamations** sub-tab (`sortant-demande`) entirely.
- Ensure the **Voir un dossier** (DetailModal) shows all the important fields from
  the "Gérer les courriers" forms — including N° bureau, Numéro interne, État,
  Transmissible, and juridique-specific fields (Type de dossier, N° première
  instance, Document lié info).
- Enhance **Recherche d'un dossier** with a dynamic service filter (from DB
  catalog, not just services with existing documents), a visible type filter,
  date d'arrivée range, and **active filter indicator pills**.
- Confirm the service dropdown filters across the entire project read from the
  live database.

### 2. Files Modified
- `[MODIFIED]` `frontend-juridique/app/types/index.ts` — removed
  `"sortant-demande"` from the `VueActive` union.
- `[MODIFIED]` `frontend-juridique/app/components/layout/Sidebar.tsx` — removed
  `canSeeSortantDemande` prop and its button.
- `[MODIFIED]` `frontend-juridique/app/page.tsx` — all `sortant-demande`
  conditionals, state, form rendering, and table rendering removed or narrowed to
  `sortant-normal` only. `canCreateSortantDemande` and `filteredSortantDemande`
  deleted.
- `[MODIFIED]` `frontend-juridique/app/components/modals/DetailModal.tsx` —
  `DocDetails` interface extended with `Source`, `DateMessage`, `Etat`, `Notes`,
  `Transmissible`, `NumeroPremiereInstance`, `TypeDossier`, `LinkedDocumentType`,
  `DossierParentId`; the render grid now shows N° bureau, Numéro interne,
  État, Transmissible, and juridique extras (linked parent, linked type, etc.).
- `[MODIFIED]` `frontend-juridique/app/components/pages/RechercheDossiersView.tsx`
  — service filter now uses `useServiceOptions` (live DB catalog) instead of
  deriving from `visibleCourriers`; `sortant-demande` removed from type dropdown;
  **active filter pills** (with per-pill × dismiss buttons) shown when any filter
  is active. Removed unused `getDocServiceCode` import.
- `[MODIFIED]` `frontend-juridique/app/components/tables/SortantTable.tsx` —
  removed `sortant-demande` type label.
- `[MODIFIED]` `frontend-juridique/app/hooks/useDocuments.ts` — sortant
  documents always mapped to `"sortant-normal"` (was conditional).
- `[MODIFIED]` `WebApplication1/WebApplication1/Services/WorkspaceService.cs` —
  `GetDocumentAsync` now returns `Source`, `DateMessage`, `Etat`, `Notes`,
  `Transmissible` for administratifs and `NumeroPremiereInstance`, `TypeDossier`,
  `LinkedDocumentType`, `DossierParentId` for juridiques; sortant type always
  `"sortant-normal"`.

### 3. Verification & Test Results
| Suite | Result |
|---|---|
| Backend build | 0 errors, 0 warnings |
| Backend unit tests | 105/105 |
| Frontend `tsc --noEmit` | 0 errors |
| Frontend ESLint | 0 errors, 0 warnings |
| Cypress E2E (7 specs) | 77/77 |

### 4. Current System State
- **Database:** 0 active documents, 0 in trash.
- The **Requêtes & Réclamations** sub-tab no longer exists anywhere in the UI,
  types, or backend routing. Documents previously created as `sortant-demande`
  (if any remain in the DB) are served as `sortant-normal` by the Workspace API.
- All service dropdown filters (admin panel, detail modal, recherche dossiers)
  read from the live RBAC service catalog — any service added via the admin panel
  appears immediately without code changes.

## [2026-09-17 14:30] — Searchable Parent Picker + Required Reference Fields + RechercheDossiers Cleanup

### 1. Context & Objective
- Replace the "Choisir un dossier parent" dropdown with a real-time searchable input
- Enforce Numéro interne and Numéro dossier judiciaire as required fields
- Fix RechercheDossiers: rename "Normal" → "Sortant", remove second date picker

### 2. Files Modified
- `frontend-juridique/app/components/forms/JuridiqueForm.tsx` — Added `parentSearchTerm`/`showParentDropdown` state; replaced `<select>` with a searchable `<input>` + filtered `<ul>` dropdown that matches on `numeroReference` and `objet` in real-time
- `frontend-juridique/app/components/forms/AdminForm.tsx` — Added `*` required indicator and `required` attribute to Numéro interne input
- `frontend-juridique/app/components/forms/JuridiqueForm.tsx` — Added `*` required indicator to Numéro dossier judiciaire label
- `frontend-juridique/app/components/pages/RechercheDossiersView.tsx` — Renamed "Normal" → "Sortant" in type dropdown; removed second date picker (`searchFilterDateFin`); updated active filter pill display
- `frontend-juridique/app/page.tsx` — Removed `searchFilterDateFin` state and prop passing

### 3. Key Technical Decisions
- Parent dossier picker uses `onFocus`/`onBlur` with a 200ms delay to prevent dropdown from closing before `onMouseDown` fires on list items
- Reference validation was already enforced in `handleFormSubmit` (`needsReference` check for admin + juridique)
- `searchFilterDateFin` completely removed from state management chain (Props → View → Page)

### 4. Verification
- TypeScript compilation: 0 errors
- ESLint: 0 errors, 0 warnings
- Cypress E2E (all 7 specs): **77/77 passing**

