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

---

## [2026-09-18] — "Normal" Label Fix, Language Pass (mahakim.ma wording), Dead i18n Prune, Flaky Test + Fixture-Leak Fixes

### 1. Context & Objective
- A screenshot showed the Recherche de dossiers type filter still offering
  **"Normal"** and two date pickers. Audited the committed code: the search view
  had already been fixed, but the label was still rendered from
  `cur.normal` in the **Sub-tab form header**, the **SortantTable type badge**
  and the **SortantForm prop** — so the obsolete wording was still visible
  elsewhere. Replaced globally and locked with a regression spec.
- Verified the single date picker (the second had already been removed).
- Full-project audit for errors, warnings and dead code.
- Improved Arabic + French wording using official Moroccan judicial terminology
  (as used on mahakim.ma / justice.gov.ma).

### 2. Files Modified / Created / Deleted
- `[MODIFIED]` `frontend-juridique/lib/translations.ts` — `normal`
  ("Normal" / "عادي") replaced by `typeSortant` ("Courrier Sortant" /
  "مراسلة صادرة"); `mesDocuments` "Mes entités" → "Mes dossiers";
  `rechercheDossiers` → "Recherche de dossiers". Arabic corrections:
  `valider` "تأكييد" → "تأكيد" (typo), `aucunArchive` "لا يوجد مستخدمين
  مؤرشفين" → "لا يوجد مستخدمون مؤرشفون", `effacerFiltres` "مسح الفلاتر" →
  "مسح عوامل التصفية", `destinataireLabel` "المستفيد" → "المرسل إليه",
  `typeCircuit` "نوع الدائرة" → "نوع المسار", `demandeur` "المطالب" →
  "المدعي", `tasfiya` "تسوية المصاريف" → "تصفية الصوائر". Pruned **87
  unreferenced keys** (422 → 335 keys per language).
- `[MODIFIED]` `frontend-juridique/app/page.tsx` — the `sortant-normal` form
  header now uses `cur.typeSortant`; the dead `typeCourrier={cur.normal}` prop
  passed to `SortantForm` removed; `"Greffe"` Arabic label "القلم" →
  "كتاب الضبط".
- `[MODIFIED]` `frontend-juridique/app/components/tables/SortantTable.tsx` —
  type badge uses `cur.typeSortant`.
- `[MODIFIED]` `frontend-juridique/app/components/pages/RechercheDossiersView.tsx`
  — type dropdown and the active-filter pill use `cur.typeSortant`.
- `[MODIFIED]` `frontend-juridique/app/components/forms/SortantForm.tsx` —
  removed the declared-but-never-used `typeCourrier` prop.
- `[MODIFIED]` `frontend-juridique/lib/constants.ts` — `Greffe` Arabic label
  "القلم" → "كتاب الضبط"; `Greffier` "الكاتب القضائي" → "كاتب الضبط".
- `[CREATED]` `frontend-juridique/cypress/e2e/recherche-dossiers.cy.ts` — 3
  regression tests (empty state, exact type-filter option list with no
  "Normal", exactly one date input).
- `[MODIFIED]` `frontend-juridique/cypress/e2e/permission-persistence.cy.ts` —
  intercepts and awaits the `PUT /api/rbac/permissions/service/{id}` before
  reading the database (see "Key Decisions").
- `[MODIFIED]` `frontend-juridique/cypress/support/dbCleanup.ts` — fixture
  matching now inspects **every** candidate reference field instead of the first
  truthy one; added the missing `EXPORT-` document prefix; extended the purge to
  test **services and users**; command renamed `purgeTestDocuments` →
  `purgeTestFixtures`.
- `[MODIFIED]` `frontend-juridique/cypress/support/e2e.ts` — global `after` hook
  calls `purgeTestFixtures`.
- `[MODIFIED]` `frontend-juridique/cypress/e2e/admin-boundaries.cy.ts`,
  `app.cy.ts`, `dynamic-service-transfer.cy.ts`, `export.cy.ts` — sidebar
  selector updated from "Mes entités" to "Mes dossiers".

### 3. Key Technical & Architectural Decisions
- **Label change kept translation-driven.** Added `typeSortant` rather than
  hardcoding, so both languages switch together. Because `TranslationKeys` is
  derived from the `fr` dictionary (`typeof translations.fr`), removing `normal`
  made `tsc` prove that no other component still referenced it.
- **Dead-key pruning is type-safe by construction.** The 87 keys were removed
  with a one-off script restricted to single-line entries, then validated with
  `tsc --noEmit`: any key still in use would have failed the build. Dictionaries
  remain exactly in sync (335 keys each, 0 missing in either direction).
- **Flaky `permission-persistence` root cause.** The spec clicked *Sauvegarder*
  and immediately read the database. The read could beat the in-flight PUT,
  which surfaced as `AssertionError: expected false to equal true` only under
  load (reproducible when `app.cy.ts` ran before it, never in isolation).
  Fixed with `cy.intercept` + `cy.wait` on the response — not by loosening the
  assertion, so the persistence guarantee is still enforced.
- **Test-fixture leak (introduced by the earlier `N° de bureau` refactor).**
  `numeroOrdre` now holds the system-assigned bureau id (e.g. "2/2026") while the
  unique fixture reference lives in `numeroReference`. The purge short-circuited
  on the first truthy field, so `numeroOrdre` matched and **no** fixture was ever
  collected. Now every candidate field is inspected, and the comparison is
  case-insensitive because references are upper-case (`DYN-…`) while service
  codes are lower-case (`e2edyn…`).
- **Services/users purged before services are deleted.**
  `DELETE /api/rbac/services/{id}/permanent` refuses while any user references
  the service, and that count ignores `IsActive`, so test users are permanently
  removed **first**, then services. Documents are still listed as `admin`
  (`admin` lacks `supprimer`) but deleted as `bureauordre`; services and users
  use the admin token, which owns `gerer_services` / `gerer_utilisateurs`.

### 4. Verification & Test Results
- Backend build: **0 errors, 0 warnings**; backend unit tests: **105/105**.
- Frontend `tsc --noEmit`: 0 errors; ESLint: 0 errors, 0 warnings;
  `next build` (Turbopack): compiled successfully, 4/4 static pages generated.
- Cypress E2E: **80/80 across 8 specs** (was 77/77 over 7 specs; +3 new).
- Re-ran the failing combination
  (`admin-boundaries` → `app` → `dynamic-service-transfer` →
  `permission-persistence`) and the full suite repeatedly: green each time.
- Database left at the seeded baseline after a full run: **9 services,
  10 users, 0 E2E services, 0 E2E users, 0 trashed documents**. One document
  (`NumeroReference` `123`, objet "hiii pdf") is preserved — it is hand-made,
  matches no fixture prefix, and the purge is designed never to touch it.
- Temporary audit scripts used for the scan were deleted from the tree.

### 5. Current System State & Pending Tasks
- System is fully green: 105 unit tests + 80 E2E tests, clean build, clean
  lint, and the test suite no longer pollutes the database.
- The E2E suite is now self-cleaning for documents, services and users, so
  service dropdowns stay free of `E2E Dynamic …` / `e2edyn…` entries.
- Pending / known: `CourrierSortant` still has no `Notes` column, so the Sortant
  Notes field is not persisted; `Tribunal / Source` shares the Source list and
  could get a dedicated tribunal list.

---

## [2026-09-18 16:32] — Dynamic Folder Journey, Last-Sender Field, Sortant Notes Persistence

### 1. Context & Objective
- When opening a folder (*Voir un dossier*), the service history was a **static**
  six-step pipeline (`WORKFLOW_STEPS`): services created from the admin panel
  mapped to no step, folders that skipped steps were shown as if they had not,
  and the pipeline was unrelated to where the folder had actually been.
- The detail view also displayed `N° Bureau d'ordre`, which the user wanted
  replaced by **the last service that sent the folder**.
- Two items left pending by the previous entry: `CourrierSortant` Notes were
  accepted by the form but never persisted, and `Tribunal / Source` reused the
  Source list instead of a dedicated tribunal list.
- Also: purge orphan uploads, stop committing runtime uploads, and remove
  unimportant shell/scaffold files.

### 2. Files Modified / Created / Deleted
- `[MODIFIED]` `frontend-juridique/app/components/modals/DetailModal.tsx`
  — removed the static `WORKFLOW_STEPS` progress bar; added a **dynamic journey**
  computed from the folder's real transactions (consecutive duplicates collapsed,
  current custodian closing the path); replaced the `N° Bureau d'ordre` field
  with `dernierExpediteur` (last sending service); restyled the timeline
  (gradient rail, status-coloured nodes, active last hop, refusal reason +
  *retourne* badge).
- `[MODIFIED]` `frontend-juridique/lib/translations.ts` — added
  `dernierExpediteur`, `parcoursDossier`, `aucunParcours` (FR + AR).
- `[MODIFIED]` `WebApplication1/WebApplication1/Models/Document.cs`
  — `Notes` moved onto the shared base class.
- `[MODIFIED]` `WebApplication1/WebApplication1/Models/CourrierAdministratif.cs`,
  `Models/CourrierSortant.cs` — dropped the per-type `Notes` duplicate.
- `[MODIFIED]` `WebApplication1/WebApplication1/DTO/SortantDto.cs`,
  `DTO/UpdateDocumentDto.cs` — `Notes` added to the Sortant create/update payloads.
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/CourrierSortantController.cs`,
  `Services/WorkspaceService.cs` — persist and return `Notes` for Sortant folders.
- `[MODIFIED]` `WebApplication1/WebApplication1/Services/SeederService.cs`
  — seeds a dedicated `tribunaux` list (13 entries, FR + AR), insert-if-missing so
  it never overwrites administrator edits.
- `[MODIFIED]` `frontend-juridique/app/components/admin/GestionListes.tsx`
  — `tribunaux` added to the dynamic-list categories.
- `[MODIFIED]` `frontend-juridique/app/components/forms/JuridiqueForm.tsx`
  — `Tribunal / Source` now reads the `tribunaux` list (built-in fallback only);
  removed the now-dead `sourceOptions` prop.
- `[MODIFIED]` `frontend-juridique/app/page.tsx` — passes `tribunalOptions`, no
  longer passes `sourceOptions` to `JuridiqueForm` (still passed to `AdminForm`).
- `[MODIFIED]` `WebApplication1/WebApplication1/Migrations/AppDbContextModelSnapshot.cs`
  — reflects the `Notes` re-parenting (no DDL).
- `[MODIFIED]` `.gitignore` — ignores `wwwroot/uploads/` (runtime data).
- `[MODIFIED]` `README.md`, `dbinitialisation/README.md` — dropped references to
  the removed audit script.
- `[DELETED]` `dbinitialisation/permission-audit.sh` — one-off dev audit script.
- `[DELETED]` `WebApplication1/WebApplication1/WebApplication1.http` — ASP.NET
  scaffold pointing at a non-existent `/weatherforecast/` on port 5138.
- `[DELETED]` 34 orphan files in `wwwroot/uploads/` (dated July/September, no
  document referenced them); the folder is now untracked.

### 3. Key Technical & Architectural Decisions
- **The journey is derived, never declared.** `GET /api/Transactions/history/{id}`
  already returned *all* transactions for a document with **no user filter**,
  ordered oldest-first. Verified this is genuinely viewer-independent: the final
  custodian sees every earlier hop. The modal builds the path by walking
  `serviceOrigine → serviceDestination` per hop and collapsing consecutive
  duplicates (multi-user routing records one transaction per recipient with the
  same endpoints), then closes it with the current custodian if not already last.
  Services created at runtime therefore appear correctly with no code change.
- **`lastSender` = origin of the most recent transaction**, i.e.
  `history[history.length - 1].serviceOrigine`. This is the real sender rather
  than the folder's own bureau id, and it stays correct for a pending transfer
  (it names the service that initiated it).
- **No schema change was needed for `Notes`.** Moving the property from
  `CourrierAdministratif` to the base `Document` is a pure CLR re-parenting
  inside the TPH hierarchy: the column was already `Documents.Notes nvarchar`,
  so `dotnet ef migrations add` produced an **empty** migration (only the
  snapshot moved). The empty migration was deleted; the snapshot update is kept
  because it now matches the model. This was confirmed against
  `INFORMATION_SCHEMA.COLUMNS` — a single `Notes` column, not a duplicate.
- **The tribunal list is data, not code.** `tribunaux` is a first-class dynamic
  list managed from « Listes dynamiques », seeded insert-if-missing. The built-in
  array in `JuridiqueForm` exists only as a fallback for a database whose list is
  still empty, so editing the list in the admin panel takes effect immediately.
- **RBAC is respected, not bypassed.** Deleting a folder requires both the
  `supprimer` permission *and* current custody — `khibra` and `admin` were
  correctly rejected with `403`. Admin is deliberately not a folder actor.

### 4. Verification & Test Results
- Backend build: **0 errors, 0 warnings**; backend unit tests: **105/105**.
- Frontend `tsc --noEmit`: 0 errors; ESLint: **0 errors, 0 warnings**
  (one unused-prop warning found and fixed); `next build` (Turbopack):
  compiled successfully, 4/4 static pages.
- Cypress E2E: **80/80 across 8 specs**.
- **Live multi-hop proof** (real API, three seeded services): created a folder as
  `bureauordre`, transferred to `secretarait` and accepted, transferred to
  `khibra` and accepted, then fetched the history **as the final custodian** and
  received both hops — `bureauordre → secretarait → khibra`. `lastSender`
  resolved to `secretarait`. The temporary test document was removed afterwards.
- `tribunaux` list confirmed seeded with 13 entries and correct Arabic through
  the API (`sqlcmd` renders `?` for Arabic due to console code page only).
- Database left at the seeded baseline: **1 active document** (the hand-made
  `123` / "hiii pdf"), **0 trashed**, **9 services**, **10 users**,
  **0 E2E leftovers**. `wwwroot/uploads/` holds exactly the 1 file that
  document references — 0 orphans.

### 5. Current System State & Pending Tasks
- All green: 105 backend unit tests, 80 E2E tests, clean build, clean lint,
  production build passing, database at baseline, no orphan uploads.
- Folder history, journey, last-sender field, transaction actions
  (accepter / refuser / annuler l'envoi) and notifications are unchanged where
  they were already correct, and now covered by the passing suite.
- Pending / known: the **dashboard** pipeline (`WORKFLOW_STEPS` in
  `lib/constants.ts`, used by `DashboardView` + `page.tsx#docsPerStep`) is still a
  hardcoded six-step list, so folders in admin-created services are undercounted
  there (they remain visible in the table below it). Left as-is this round to
  avoid regressions outside the requested scope.

---

## [2026-09-18 17:21] — Pending Transfer: Folder Stays Until Accepted + ❌ on Rejected Journey

### 1. Context & Objective
- When a user sent a folder to another service, the folder was immediately moved
  to the receiver's service. The user wanted it to **stay with the sender** until
  the receiver explicitly accepts or refuses the transfer.
- If the receiver refuses, a notification should go to the sender with the
  refusal reason.
- If the sender cancels before acceptance, the folder stays.
- In *Parcours du dossier* (journey), a rejected transition should show **❌**
  on the arrow instead of →, making the denial visually clear.

### 2. Files Modified
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/TransferController.cs`
  — Removed the immediate `ServiceActuel` / `ServiceActuelCode` move for
  non-historical services; destination access grant is now deferred to acceptance.
- `[MODIFIED]` `WebApplication1/WebApplication1/Services/TransactionService.cs`
  — `AccepterAsync`: on normal accept, moves the folder + grants access; on
  doitRevenir accept, folder stays with sender (no return transaction, no revoke).
  `RefuserAsync`: removed the doitRevenir return logic (folder never moved);
  sender notification kept. `AnnulerTransitionAsync`: removed the folder restore
  (folder never moved); access revoke kept as idempotent no-op.
- `[MODIFIED]` `WebApplication1/WebApplication1.Tests/TransactionServiceTests.cs`
  — Updated `AccepterAsync_WithDoitRevenir_*` and
  `AnnulerTransitionAsync_*` tests for the new semantics (no return transaction,
  folder stays with sender).
- `[MODIFIED]` `frontend-juridique/app/components/modals/DetailModal.tsx`
  — Journey nodes now carry a `rejected` flag derived from the `Refuse` status
  in the transaction history. Rejected nodes render with a red background, ✗ in
  the badge, and ❌ instead of → on the connecting arrow.
- `[MODIFIED]` `frontend-juridique/cypress/e2e/dynamic-service-transfer.cy.ts`
  — Updated custody test to verify: sender keeps folder before acceptance,
  receiver does NOT see it before acceptance, folder moves only after accept.
- `[MODIFIED]` `frontend-juridique/cypress/e2e/permission-toggle.cy.ts`
  — Custody tests now accept the transfer before asserting 403 (since the
  folder stays with the sender during the pending phase).

### 3. Key Technical & Architectural Decisions
- **Folder custody is now a two-phase process:** Phase 1 (pending transfer):
  folder stays with sender, no destination access granted. Phase 2 (accepted):
  folder moves, destination gets Editor access. This eliminates the previous
  "instant move" that caused the receiver to see folders before acting on them.
- **Historical services are the exception:** they auto-accept immediately (no
  login possible), so their folder is moved and access granted in the Transfer
  controller itself.
- **No return transaction on refusal:** since the folder never moved from the
  sender, refusing a transfer requires no rollback. The sender gets a
  `[REFUS]` notification with the refusal reason, and the journey records the
  rejection visually.
- **Journey rejected-pair tracking:** rejected transitions are tracked as
  `"originKey→destKey"` pairs in a Set. When building the journey nodes, each
  destination node checks if it was rejected. The UI renders rejected nodes with
  a red badge and ❌ on the connecting arrow.

### 4. Verification & Test Results
- Backend build: **0 errors, 0 warnings**.
- Backend unit tests: **105/105**.
- Frontend `tsc --noEmit`: 0 errors; ESLint: **0 errors, 0 warnings**.
- Cypress E2E: **80/80 across 8 specs**.
- The dynamic-service-transfer spec now exercises the full pending → accept →
  custody-transfer flow and confirms the sender loses custody only after
  acceptance. The permission-toggle custody tests accept first, then assert 403.

### 5. Current System State & Pending Tasks
- Fully green: 105 unit tests + 80 E2E tests, clean build, clean lint.
- Transfer → accept/refuse/cancel, notifications, journey (including ❌ for
  rejected transitions), and the Parcours du dossier visual all function
  correctly.
- Pending: the dashboard pipeline (`WORKFLOW_STEPS`) is still hardcoded.

---

## [2026-09-19 16:22] - Verified User→User Transfer Custody Flow (No Code Changes Required)

### 1. Context & Objective
- Verify, against the live running system, that a folder sent between two real
  (non-historical) users is **not** visible to the receiver until they accept it,
  that accept moves custody, that refuse leaves the folder with the sender and
  notifies them with the refusal reason, that cancel-before-accept keeps the
  folder with the sender, and that a transfer to a **historical** service is
  recorded in history only (no physical move).
- The implementation already matched the specification, so no code was changed —
  this entry records the evidence.

### 2. Files Modified / Created / Deleted
- `[VERIFIED]` `WebApplication1/WebApplication1/Controllers/TransferController.cs` - transfer records a `EnAttente` transaction and leaves `ServiceActuelCode` untouched (only sets `StatutActuel = EnInstance`); historical destinations are recorded `Accepte` with no move and no access grant.
- `[VERIFIED]` `WebApplication1/WebApplication1/Services/TransactionService.cs` - `AccepterAsync` moves the folder and grants editor access; `RefuserAsync` leaves the folder put and creates a `[REFUS]` notification carrying the receiver's message; `AnnulerTransitionAsync` cancels only pending rows and needs no restore.
- `[VERIFIED]` `CourrierAdminController.cs`, `CourrierJuridiqueController.cs`, `CourrierSortantController.cs` - list queries are scoped by `ServiceActuelCode`, so the receiver cannot see a pending folder in *Mes dossiers*, *Courriers Entrants*, *Courrier Juridique* or *Courrier Sortant*.
- No files added or deleted; temp verification scripts were created under `/tmp` and removed afterwards.

### 3. Key Technical & Architectural Decisions
- Confirmed the design is **"hold at sender until accepted"**: the document keeps
  its `ServiceActuelCode` while the transaction is `EnAttente`, so service-scoped
  listing queries naturally hide it from the receiver. Visibility is therefore
  enforced at the query level, not by UI filtering.
- Historical services are record-only: `IsHistoricalService = true` writes an
  auto-`Accepte` transaction for the history timeline but never moves the folder
  and never grants access (a historical service has no accounts to log in with).
- No hardcoded service lists are involved; destination codes resolve from the live
  RBAC catalog.

### 4. Verification & Test Results
- Live end-to-end run against backend on `:5200` with the seeded database
  (`(localdb)\MSSQLLocalDB` / `GestionJuridiqueDB`), **22/22 checks passed**:
  - ACCEPT: sender keeps folder → receiver has no folder but sees the pending
    transaction → accept → receiver sees folder, sender no longer does, history
    has the hop.
  - REFUSE: sender keeps folder, receiver never sees it, sender receives a
    `[REFUS]` notification containing the exact refusal message
    (`MOTIF-TEST-42`).
  - CANCEL before accept: sender keeps folder, receiver never sees it, and the
    pending transaction disappears from the receiver.
  - HISTORICAL (`greffe`): folder stays with the sender and the hop is recorded
    in the history as `Accepte`.
- Cross-tab run, **14/14 checks passed**: identical accept flow verified for
  `entrant-juridique` (*Courrier Juridique*) and `sortant-normal` (*Courrier
  Sortant*) — receiver hidden before accept, visible after, sender loses custody
  after accept.
- Test artifacts (10 documents + their transactions and access rows) were purged
  from the database afterwards; the 5 pre-existing user-made documents were left
  untouched.

### 5. Current System State & Pending Tasks
- Behavior is confirmed correct exactly as specified; the frontend tabs
  (*Mes dossiers*, *Courriers Entrants*, *Courrier Juridique*, *Courrier Sortant*)
  reflect the real custody state.
- Backend was started for this verification and left running on `:5200`; the
  frontend (`:3000`) was not running and was not started.- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.

---

## [2026-09-19 17:58] — Soft-Delete → Archive + Dynamic Service Transfer Verification

### 1. Context & Objective
- **Delete → Archive:** When a user deletes a dossier, it should NOT be
  permanently deleted immediately. It should first move to the user's own
  Archive tab (corbeille), where they can restore it or permanently delete it.
  Previously, the corbeille was only accessible to the `archive` service
  (`voir_corbeille` permission), so regular users could soft-delete a folder
  but never see it again to restore or permanently delete.
- **Transfer flow with a new user in a new service:** Verify the full
  accept / refuse / cancel flow works end-to-end when a brand-new service and
  user are created at runtime — confirming the permission engine and custody
  logic are truly dynamic.

### 2. Files Modified / Created / Deleted
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/DocumentsController.cs`
  — Added a `ResolveScopeAsync()` helper (service-scoping for non-admin
  callers, identical to the pattern used by listing controllers). Scoped
  `GetCorbeille()` so a regular user only sees their own service's trashed
  documents; admin-like roles keep the global view.
- `[MODIFIED]` `WebApplication1/WebApplication1/Services/SeederService.cs`
  — Added `voir_corbeille`, `restaurer`, `archives_view` to the default
  permission matrix for `bureauordre` (who has `supprimer`). Insert-if-missing
  semantics: the seeder block only runs on an empty DB, so this is a new-DB
  default; the existing DB is handled by the SQL grant script.
- `[MODIFIED]` `dbinitialisation/grant-permissions-existing-db.sql`
  — Added `voir_corbeille` and `restaurer` grants for bureauordre (idempotent
  insert-if-missing) and the re-enable list for existing databases.
- `[MODIFIED]` `WebApplication1/WebApplication1.Tests/SeederServiceTests.cs`
  — Updated `SeedCoreAsync_ForceOnPopulatedDb_AddsOnlyMissing` expected count
  from 19 → 22 to reflect the three new default keys for bureauordre.
- `[MODIFIED]` `frontend-juridique/app/page.tsx`
  — Updated `handleDelete`: confirmation message now uses the new
  `cur.suppressionVersArchive` key (explains it's a soft move, not permanent);
  toast changed to `cur.documentArchive`; after deleting, the corbeille is
  kept in sync when it's currently open.
- `[MODIFIED]` `frontend-juridique/lib/translations.ts`
  — Added `suppressionVersArchive` and `documentArchive` in both FR and AR
  dictionaries.
- `[MODIFIED]` `frontend-juridique/cypress/e2e/repeated-actions.cy.ts`
  — Replaced the fixed `cy.wait(700)` in the delete loop with a deterministic
  assertion: captures the first row's unique `objet` text before clicking
  delete, then waits for that text to leave the table. This eliminates the
  race between the delete+refetch and the next iteration.

### 3. Key Technical & Architectural Decisions
- **Scope the corbeille by service, not globally.** The trashed documents
  belong to the service that held custody when they were deleted; a regular
  user should see only their own service's trash. Admin-like roles (Admin,
  Greffier, Directeur, Consultant) see everything, matching the listing
  controllers' scoping. This is enforced at the query level, not in the UI.
- **Permanent delete remains un-scoped** (requires `supprimer` only). The
  E2E cleanup relies on `permanent-delete-batch` crossing service boundaries
  via bureauordre, and scoping it would break the cleanup. The UI only
  surfaces the user's own service's trash, so cross-service permanent delete
  is only possible via the API — acceptable for a `supprimer`-gated endpoint.
- **Seeder defaults only apply to fresh DBs.** The seeder's permission block
  is guarded by `if (!ServicePermissions.Any())`. To bring the existing DB
  in line, the `grant-permissions-existing-db.sql` script was updated with
  the new keys (idempotent). On next startup the seeder is a no-op; the SQL
  script is the migration path.
- **Deterministic E2E deletes.** The test now reads the fixture's unique
  `objet` text from the first row and asserts it leaves the table. This makes
  the loop wait for the actual refetch result instead of racing it with a
  fixed 700ms sleep — which was the root cause of the intermittent failure
  in `repeated-actions.cy.ts`.

### 4. Verification & Test Results
- **Delete → Archive flow live-tested (18/18 checks):**
  - Permissions: bureauordre now has `voir_corbeille`, `restaurer`,
    `archives_view` (confirmed via JWT claims).
  - Corbeille scoping: bureauordre sees 5 trashed docs (their own service);
    archive sees 0 (different service); admin sees all 5.
  - Full cycle: create → soft-delete → appears in corbeille → restore → back
    in active list → delete again → permanent delete → gone.
- **Dynamic new-service transfer flow live-tested (20/20 checks):**
  - Created a new service (`vfnew{stamp}`) and user via admin API.
  - New user logs in and has `accepter`, `refuser`, `annuler_transfert`.
  - ACCEPT: sender keeps folder → receiver doesn't see it before accept →
    accepts → receiver sees it, sender loses it.
  - REFUSE: sender keeps folder, receiver doesn't see it, sender gets
    `[REFUS]` notification carrying `MOTIF-NEW-99`.
  - CANCEL: sender keeps folder, pending transaction disappears.
- **Backend unit tests: 105/105** (SeederServiceTests updated).
- **Frontend tsc / ESLint: 0 errors, 0 warnings.
- **Cypress E2E: 80/80 across 8 specs** (the `repeated-actions` flake is
  resolved by deterministic row-disappearance assertions).
- **Production build: clean.
- **Database after full run: 5 docs (user's own), 10 services, 11 users,
  9 transactions — no E2E artifacts.

### 5. Current System State & Pending Tasks
- All green: 105 backend tests, 80 E2E tests, clean build, clean lint.
- Delete now routes to the user's archive (corbeille) where restore and
  permanent delete are available; the UI confirms "déplacé vers l'archive"
  instead of "supprimé".
- All transfers (accept / refuse / cancel / historical) work correctly with
  both seeded and dynamically-created services.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.




