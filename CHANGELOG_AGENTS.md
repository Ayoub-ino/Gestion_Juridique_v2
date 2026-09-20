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
  frontend (`:3000`) was not running and was not started.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
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


---

## [2026-09-19 19:08] — Archive Endpoint Fix + Admin Panel Cleanup

### 1. Context & Objective
- **Archive endpoint bug:** The generic `PATCH /api/Documents/{id}/archive`
  and `POST /api/Documents/archive-batch` endpoints set `ServiceActuel` and
  `StatutActuel` but did NOT set `ServiceActuelCode`. Since the listing
  controllers scope by `ServiceActuelCode`, archived folders stayed in the
  original service's list instead of moving to the archive service's custody.
- **Remove Listes dynamiques tab:** The admin panel had a "Listes dynamiques"
  tab for managing dynamic lists (tribunaux, sources). The user requested its
  removal from the admin sidebar and tab panel.
- **Add `archiver` to bureauordre defaults:** Bureauordre was missing the
  `archiver` permission in its seeder defaults, causing the permission-toggle
  E2E test to fail (it toggles `archiver` for bureauordre).

### 2. Files Modified
- `[MODIFIED]` `WebApplication1/WebApplication1/Controllers/DocumentsController.cs`
  — `ArchiveDocument` and `ArchiveBatch` now set `ServiceActuelCode =
  DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.Archive)`.
  `ArchiveDocument` also gains a custody check (only the current holder can
  archive). Injected `DocumentAccessService` into the controller.
- `[MODIFIED]` `WebApplication1/WebApplication1/Services/SeederService.cs`
  — Added `archiver` to bureauordre's default permission matrix.
- `[MODIFIED]` `dbinitialisation/grant-permissions-existing-db.sql`
  — Added `archiver` grant for bureauordre (idempotent).
- `[MODIFIED]` `WebApplication1/WebApplication1.Tests/SeederServiceTests.cs`
  — Updated expected count from 22 → 23.
- `[MODIFIED]` `frontend-juridique/app/types/index.ts`
  — Removed `"admin-listes"` from `VueActive` union.
- `[MODIFIED]` `frontend-juridique/app/components/layout/Sidebar.tsx`
  — Removed the "Listes dynamiques" button and its `canSeeListesAdmin` prop.
- `[MODIFIED]` `frontend-juridique/app/page.tsx`
  — Removed `canSeeListesAdmin`, the `GestionListes` lazy import, the
  `admin-listes` tab content, and the tab label rendering.
- `[MODIFIED]` `frontend-juridique/cypress/e2e/admin-boundaries.cy.ts`
  — Removed the "Listes dynamiques exists" assertion.
- `[MODIFIED]` `frontend-juridique/cypress/e2e/permission-toggle.cy.ts`
  — Removed "Listes dynamiques exists/not-exists" assertions.

### 3. Key Technical & Architectural Decisions
- **`ServiceActuelCode` is mandatory for scoping.** The listing controllers
  filter by `ServiceActuelCode`, not `ServiceActuel`. Any endpoint that
  changes a folder's custody MUST update `ServiceActuelCode` as well. The
  generic archive endpoints were the only ones that missed this.
- **Custody check on single archive.** The `PATCH /{id}/archive` endpoint
  now verifies the caller holds custody via `IsUserCustodian()`, preventing
  cross-service archival via direct API calls. The batch endpoint is left
  un-scoped for cleanup compatibility.
- **Listes dynamiques removed.** The admin panel no longer shows the list
  management tab. The underlying list data (tribunaux, sources) is still
  used by the forms; it's just not managed from the admin UI.

### 4. Verification & Test Results
- Backend build: **0 errors, 0 warnings**.
- Backend unit tests: **105/105**.
- Frontend tsc / ESLint: **0 errors, 0 warnings**.
- Cypress E2E: **80/80 across 8 specs**.
- Live archive flow verified: transfer to archive → accept → archive
  (`PATCH /archive`) → `ServiceActuelCode` correctly set to `"archive"`.

### 5. Current System State & Pending Tasks
- All green: 105 backend tests, 80 E2E tests, clean build, clean lint.
- The archive service can properly move a folder to the archive state (not
  the corbeille); the `ServiceActuelCode` is correctly updated.
- The admin panel no longer shows the "Listes dynamiques" tab.
- All archive/corbeille permissions (`archiver`, `voir_corbeille`,
  `restaurer`, `archives_view`) are configurable per-service in the
  Gestion des Permissions panel.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.


---

## [2026-09-20 14:01] — Corbeille Moved from Archive to Mes Dossiers

### 1. Context & Objective
- The trash (corbeille) was a sub-tab inside the **Archive** view, which was
  a poor fit: deleting a folder is a *Mes dossiers* action, so restoring or
  purging it belongs next to the folders rather than behind an unrelated
  archive screen that many services cannot even open (`archives_view`).
- Objective: relocate the corbeille sub-tab into **Mes dossiers** and leave
  the Archive view focused solely on archived folders.

### 2. Files Modified / Created / Deleted
- `[MODIFY]` `frontend-juridique/app/components/pages/MesEntitesView.tsx`
  — Added the corbeille/mes-dossiers sub-tab toggle and the corbeille table
  (reference, objet, service, restaurer / supprimer définitivement). New
  props: `showCorbeille`, `setShowCorbeille`, `corbeilleDocs`,
  `onFetchCorbeille`, `onRestoreDocument`, `onPermanentDelete`,
  `canSeeCorbeille`. Imported `confirmAction` for the irreversible-delete
  double confirmation.
- `[MODIFY]` `frontend-juridique/app/components/pages/ArchivesView.tsx`
  — Removed the corbeille toggle, the corbeille table, and all six now-dead
  props; the view renders only archived folders.
- `[MODIFY]` `frontend-juridique/app/page.tsx` — Moved the corbeille prop
  block from `ArchivesView` to `MesEntitesView`. The corbeille data,
  restore, and permanent-delete handlers are unchanged, so delete → trash →
  restore/purge keeps working exactly as before.
- `[MODIFY]` `frontend-juridique/lib/translations.ts` — The delete
  confirmation and toast no longer point to "l'onglet Archive"; they now say
  the folder goes to the corbeille and is managed from « Mes dossiers »
  (`ملفاتي` in Arabic).

### 3. Key Technical & Architectural Decisions
- **Visibility gate unchanged.** The corbeille sub-tab is still gated by
  `voir_corbeille` (or the Greffier role) — no hardcoded service checks, so
  it appears automatically for any service the admin grants the permission
  to in Gestion des Permissions.
- **Archive stays permission-gated.** Since the corbeille no longer lives
  there, a service with `voir_corbeille` but without `archives_view` can
  finally manage its trash.
- **Single source of truth.** `showCorbeille` / `corbeilleDocs` still live
  in `page.tsx`; only the rendering moved, so the post-delete sync
  (`if (showCorbeille) await fetchCorbeille()`) is untouched.

### 4. Verification & Test Results
- Frontend `tsc --noEmit`: **0 errors**.
- Frontend ESLint (`app`, `lib`): **0 errors, 0 warnings**.
- Cypress E2E: **80/80 across 8 specs** (admin-boundaries, app,
  dynamic-service-transfer, export, permission-persistence,
  permission-toggle, recherche-dossiers, repeated-actions).
- Database after the run: 3 documents (user's own), 0 soft-deleted, 0 E2E
  artifacts.

### 5. Current System State & Pending Tasks
- All green: 80 E2E tests, clean typecheck and lint.
- Corbeille is reachable from **Mes dossiers**; the **Archive** tab now shows
  archived folders only.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.


---

## [2026-09-20 14:40] — « Vider la corbeille » (Bulk Purge of the Trash)

### 1. Context & Objective
- The corbeille only supported one-by-one permanent deletion. A user emptying a
  full trash had to confirm an irreversible dialog per folder.
- Objective: add a single "Vider la corbeille" action that purges the whole
  trash at once, **scoped to the caller's own service** so it can never reach
  another service's deleted folders, and enforced by the backend rather than
  the UI.

### 2. Files Modified / Created / Deleted
- `[MODIFY]` `WebApplication1/WebApplication1/Controllers/DocumentsController.cs`
  — Added `DELETE /api/Documents/corbeille` (`[RequirePermission("supprimer")]`).
  Extracted `ScopedCorbeilleQuery(...)` so the listing (`GET corbeille`) and the
  purge share one scope definition, and `PurgeDocumentsAsync(List<Document>)`
  so single, batch and bulk deletion share one cleanup path. `PermanentDelete`
  and `PermanentDeleteBatch` were refactored onto that helper (behaviour
  unchanged).
- `[NEW]` `frontend-juridique/cypress/e2e/corbeille-vider.cy.ts` — 4 new E2E
  tests (cross-service scoping, empty-trash idempotency, backend RBAC 403, and
  the UI entry point).
- `[MODIFY]` `frontend-juridique/app/components/pages/MesEntitesView.tsx` —
  Added the `Vider la corbeille` button to the corbeille header (shown only when
  `canEmptyCorbeille && corbeilleDocs.length > 0`) and `data-testid` hooks
  (`mes-dossiers-tab`, `corbeille-tab`, `empty-corbeille`).
- `[MODIFY]` `frontend-juridique/app/components/layout/Sidebar.tsx` — Added a
  `nav-mes-dossiers` testid for language-independent navigation in tests.
- `[MODIFY]` `frontend-juridique/app/page.tsx` — Added the `emptyCorbeille`
  handler (confirm → purge → refresh corbeille + folder list → toast) and passed
  `onEmptyCorbeille` / `canEmptyCorbeille` down.
- `[MODIFY]` `frontend-juridique/lib/translations.ts` — Added `viderCorbeille`,
  `viderCorbeilleConfirm`, `corbeilleVidee` in French and Arabic.
- `[MODIFY]` `README.md` — Test counts updated (105 unit, 84 E2E across 9
  specs, 189 total).

### 3. Key Technical & Architectural Decisions
- **Route choice:** `DELETE /api/Documents/corbeille` — a single literal
  segment, so it cannot collide with the existing `DELETE {id}/permanent` or
  the `GET corbeille` listing.
- **One scope definition.** `ScopedCorbeilleQuery` is now the single place that
  decides which trashed rows a caller may see; the listing and the purge both
  call it, so "what you see" and "what gets purged" cannot drift apart.
- **Deliberately did NOT scope `permanent-delete-batch`.** The E2E harness
  relies on it crossing service boundaries for cleanup, so the scoped purge got
  its own endpoint instead of tightening the existing one.
- **Backend-enforced permission.** `RequirePermission("supprimer")` — a service
  without it gets 403 even when calling the API directly. The UI merely hides
  the button; nothing is hardcoded to a service name.

### 4. Verification & Test Results
- Backend build: **0 errors, 0 warnings**.
- Backend unit tests: **105/105**.
- Live API run: **17/17 checks** — bureauordre trashes A, archive trashes B;
  bureauordre's purge reports `count: 1`, A is hard-deleted (404 after),
  **B survives in archive's trash**, emptying an empty trash returns `count: 0`,
  and `khibra` (no `supprimer`) gets 403.
- Frontend `tsc --noEmit`: **0 errors**. ESLint (`app`, `lib`, `cypress`):
  **0 errors, 0 warnings**.
- Cypress E2E: **84/84 across 9 specs** (was 80/80 across 8).
- `next build`: **compiled successfully**.
- Database after the full run: 3 documents (user's own), 0 trashed, 0 test
  artifacts.

### 5. Current System State & Pending Tasks
- At the time of this entry: all green — 105 unit tests, 84 E2E tests, clean
  build, clean lint (see the 14:36 entry for the current 86).
- The corbeille lives in **Mes dossiers** and can be emptied in one confirmed
  action, scoped to the caller's service.
- Note: `tsc` can report a stale `Cannot redeclare 'API_URL'` across Cypress
  specs from `tsconfig.tsbuildinfo`. Deleting that cache file (git-ignored)
  clears it; a clean `--incremental false` run passes.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.


---

## [2026-09-20 14:36] — Transfer Lifecycle Verification + 2 New E2E Guards

### 1. Context & Objective
- Re-verify the whole user-to-user transfer contract, explicitly including a
  **service and user created fresh at runtime**, since that is the case most
  likely to break the routing (it cannot be represented by the legacy
  `ServiceTribunal` enum).
- Contract: a folder must stay with the sender until the receiver accepts from
  Notifications or the Registre; acceptance moves it into the receiver's
  Mes dossiers / Courriers Entrants / Courrier Juridique; refusal leaves it with
  the sender and notifies them with the receiver's reason; `Annuler l'envoi`
  before acceptance keeps it with the sender; a transfer to a **historique**
  service is history-only and moves nothing.

### 2. Files Modified / Created / Deleted
- `[MODIFY]` `frontend-juridique/cypress/e2e/dynamic-service-transfer.cy.ts`
  — Added two regression tests: *"keeps the folder out of every receiver list
  until it is accepted"* (asserts CourrierAdmin, CourrierJuridique AND
  CourrierSortant are all clear before acceptance, while Notifications + the
  Registre do show it) and *"Annuler l'envoi keeps the folder with the sender
  and closes the transfer"*. No production code was changed — the behaviour was
  already correct.
- `[MODIFY]` `README.md` — E2E counts refreshed (86 tests, 191 total).
- Temporary verification scripts were created, run and then deleted (not part of
  the committed tree).

### 3. Key Technical & Architectural Decisions
- **No production change was needed.** The live run confirmed the existing
  design: `Transfer` leaves `ServiceActuelCode` untouched (only sets
  `StatutActuel = EnInstance`), `Accepter` performs the move + grants Editor
  access, `Refuser` creates a `[REFUS]` notice transaction destined for the
  sender carrying the refusal reason, `AnnulerTransition` only marks the row
  `Annule`, and historical destinations are auto-accepted without a move.
- **Verification note (not a bug):** `NumeroOrdre` / `NumeroBureauOrdre` is
  system-assigned as `{creatorUserId}/{year}` — so folders created by the same
  user legitimately share it. The folder's identity is `NumeroReference`, which
  the create endpoints validate for uniqueness across all document types (409).
  Anything matching folders must key on `NumeroReference`, not `NumeroOrdre`.

### 4. Verification & Test Results
- Live API run against a **brand-new service + brand-new user**: **40/40
  checks**. Highlights: pre-accept the folder is absent from all three receiver
  lists yet present in Notifications and the Registre; the sender keeps custody;
  post-accept it appears for the receiver and disappears for the sender; refusal
  keeps it with the sender and delivers the exact reason via a `[REFUS]`
  notification; cancellation leaves the row `Annule` and unactionable; a
  historique destination records an auto-accepted hop while the folder stays put.
- Cypress E2E: **86/86 across 9 specs** (was 84/84).
- Frontend `tsc --noEmit` and ESLint (`app`, `lib`, `cypress`): **0 errors, 0
  warnings**.
- Database after the run: 2 documents (pre-existing), 0 trashed, 10 services,
  11 users, 0 test artifacts (verified no orphaned transactions).

### 5. Current System State & Pending Tasks
- At the time of this entry: 105 unit tests, 86 E2E tests, clean typecheck and
  lint (see the 14:57 entry for the current 110).
- The transfer lifecycle is confirmed working for runtime-created services and
  users; the cancel path and cross-list invisibility are now covered by
  regression tests.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.


---

## [2026-09-20 14:57] — Folder History Records a Transfer Only Once Accepted

### 1. Context & Objective
- `GET /api/Transactions/history/{documentId}` returned **every** transaction,
  so a transfer that was still pending (or had been cancelled) appeared in
  *Parcours du dossier* as if the folder had actually moved. Historical
  (record-only) transmits were correct, but a folder sitting in Service A with a
  pending send to Service B was drawn as `A → B`.
- Objective: a folder's history must describe what actually happened to it — a
  transfer is only recorded once the receiver accepts — while historique
  services (auto-accepted, since they have no accounts and cannot act) are still
  recorded immediately.

### 2. Files Modified / Created / Deleted
- `[MODIFY]` `WebApplication1/WebApplication1/Services/TransactionService.cs`
  — `GetHistoryAsync` now keeps only committed entries: `Accepte` (a completed
  movement, including historique services) and `Refuse` (the folder did not
  move, but the denied attempt is kept so the journey can mark that hop with ❌).
  `EnAttente`, `Annule`, and `"[REFUS]"` notices are excluded.
- `[MODIFY]` `WebApplication1/WebApplication1.Tests/TransactionServiceTests.cs`
  — Added 5 unit tests pinning the filter (pending/cancelled excluded, accepted
  and refused kept, refusal notices excluded even when accepted, and a mixed-bag
  case).
- `[MODIFY]` `README.md` — Test counts refreshed (110 unit, 86 E2E, 196 total).

### 3. Key Technical & Architectural Decisions
- **Filtered in the backend, not the UI.** The history endpoint is the single
  source of truth, so *Parcours du dossier* and *Chronologie* can no longer
  disagree, and the rule holds for any future consumer.
- **`Refuse` deliberately kept.** The folder never moved, but an explicit
  earlier requirement asks for denied transitions to render with ❌; dropping
  them would remove that marker. Only the *pending* and *cancelled* states are
  hidden.
- **NULL-safe exclusion.** `Commentaire <> '[REFUS]'` alone would have silently
  dropped every row with a NULL `Commentaire` under SQL three-valued logic, so
  the predicate is guarded with an explicit `Commentaire == null ||`.
- **`"[REFUS]"` notices are messages, not movements.** Excluding them also
  removes a spurious `receiver → sender` hop that used to appear in the path
  after a refusal (and again once the sender acknowledged the notice).

### 4. Verification & Test Results
- Backend build: **0 errors, 0 warnings**.
- Backend unit tests: **110/110** (105 + 5 new).
- Live API run: **19/19 checks** — pending transfer leaves the history empty;
  accepting adds exactly one `Accepte` hop (`bureauordre → secretarait`); a
  refusal leaves one `Refuse` entry and its `[REFUS]` notice adds no hop even
  after the sender acknowledges it; cancelling leaves the history empty; a
  historique destination (`greffe`) is recorded immediately as `Accepte` while
  the folder stays put.
- Cypress E2E: **86/86 across 9 specs**.
- Database after the run: 2 documents (pre-existing), 0 trashed, 0 test
  artifacts.

### 5. Current System State & Pending Tasks
- At the time of this entry: 110 unit tests, 86 E2E tests, clean build (see the
  15:22 entry for the current 114).
- A folder's history now reflects real movement only; pending, cancelled and
  refusal-notice transactions never appear as hops.
- Note: since pending transfers are no longer in the history, the detail modal's
  "Dernier service expéditeur" (`lastSender`) is derived from committed hops
  and stays hidden for a folder that has never completed a transfer.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.


---

## [2026-09-20 15:22] — Fixed: Stale Requests Left by Multi-User Transfers

### 1. Context & Objective
- One send can target **several users** of the destination service, which creates
  one transaction per targeted user (`TargetUserIds`). Verifying that contract
  exposed a real defect: when one user accepted, the **other users' requests
  stayed pending**. They were then asked to accept a folder already sitting in
  their own service, and could still *refuse* it — producing a refusal notice for
  a transfer that had in fact completed.

### 2. Files Modified / Created / Deleted
- `[MODIFY]` `WebApplication1/WebApplication1/Services/TransactionService.cs`
  — `AccepterAsync` now closes the competing pending requests for the document;
  `RefuserAsync` closes the sibling requests of the same send (same origin →
  destination pair). "[REFUS]" notices are excluded from both.
- `[MODIFY]` `WebApplication1/WebApplication1.Tests/TransactionServiceTests.cs`
  — 4 new tests: accept closes the other requests for the document, accept leaves
  refusal notices pending, refuse closes the siblings of the same send, and
  refuse keeps handoffs to *other* services actionable.
- `[MODIFY]` `README.md` — Test counts refreshed (114 unit, 86 E2E, 200 total).

### 3. Key Technical & Architectural Decisions
- **Accept closes everything for that document.** The folder physically moved, so
  every other pending handoff of it is stale and would hijack it if accepted
  later. This includes handoffs to *different* services.
- **Refuse closes only the same send.** The folder did not move, so a handoff to
  another service remains legitimately actionable. "First answer wins" per send,
  which prevents the sender receiving both a refusal notice and a completed move.
- **Refusal notices are never cancelled** by either path — they are messages to
  the sender, not handoffs.
- **Legacy-tolerant matching.** Rows written before the code columns existed only
  carry the `ServiceTribunal` enum, so the sibling comparison falls back to the
  enum when the code column is NULL — the same pattern already used elsewhere in
  the service.

### 4. Verification & Test Results
- Backend build: **0 errors, 0 warnings**.
- Backend unit tests: **114/114** (110 + 4 new).
- Live API run on a fresh service with **two users**: **35/35 checks** — the
  service-wide path worked already; targeting both users then accepting as u1 now
  leaves **0** pending for u2, and refusing as u1 also leaves 0 pending for u2.
- Cypress E2E: **86/86 across 9 specs**.
- Database after the run: 0 test artifacts, 0 orphans.

### 5. Current System State & Pending Tasks
- All green: 114 unit tests, 86 E2E tests, clean build.
- Multi-user transfers no longer leave stale requests in other users' inboxes.
- Decision to confirm with the project owner: on a targeted send, the **first
  answer wins** — if one user refuses, the other targeted users can no longer
  accept that send (they would need the sender to re-send).
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.


---

## [2026-09-20 16:03] — Folders no longer reach the receiver before the transfer is accepted

### 1. Context & Objective
- Reported: sending a folder put it **straight into the receiver's** *Mes dossiers*,
  *Courriers Entrants* and *Courrier Juridique* tabs, instead of staying with the
  sender until the receiver accepted the request.
- Verified live against a freshly-created service and user: plain transfers were
  already correct, but the **"Transaction Unique" creation mode** (Gérer les
  courriers → Mode de traitement) moved the folder to its destination at creation
  time while still recording a `EnAttente` request. Fixed at the source in an
  earlier session; this entry adds the repair for the rows that build left behind,
  a permanent regression test, and confirms the whole contract end to end.

### 2. Files Modified / Created / Deleted
- `[MODIFY]` `WebApplication1/WebApplication1/Services/DocumentAccessService.cs` —
  new `RepairUnansweredHandoversAsync()`: puts a folder that sits at a destination
  while its handover is still unanswered back with the service that sent it.
  Idempotent, returns the number of folders moved.
- `[MODIFY]` `WebApplication1/WebApplication1/Controllers/WorkspaceController.cs` —
  `POST /api/Workspace/document/backfill-acl` now also reports `repaired`.
- `[MODIFY]` `WebApplication1/WebApplication1/Program.cs` — runs the repair once at
  startup so an existing database self-heals without manual action.
- `[CREATE]` `WebApplication1/WebApplication1.Tests/DocumentAccessServiceTests.cs` —
  7 unit tests pinning the repair rule.
- `[MODIFY]` `frontend-juridique/cypress/e2e/dynamic-service-transfer.cy.ts` — new
  test: a `unique` creation stays with the creator and the destination is only
  asked to accept.
- `[MODIFY]` `README.md` — test counts (121 unit / 87 E2E / 208 total).

### 3. Key Technical & Architectural Decisions
- Custody is `Document.ServiceActuelCode`; only `TransactionService.AccepterAsync`
  may change it on a transfer. The pre-fix create handler wrote it directly, which
  is the bug class the repair targets.
- The repair looks for **unanswered handovers whose destination equals the folder's
  current service** (`Statut = EnAttente`, no `Commentaire`, origin ≠ destination,
  not deleted). That signature cannot occur in a healthy database, so a repaired
  database matches 0 rows and the pass is a no-op.
- Refusal notices (`Commentaire = '[REFUS]'`) are excluded, as are deleted folders.
- The folder is returned to the exact origin **code**, so services created from the
  admin panel work too; the legacy `ServiceActuel` enum is refreshed with the same
  best-effort mapping creation and transfer already use.
- Repair is exposed both dynamically (admin backfill endpoint) and automatically
  (startup), so no hardcoded service list is involved.

### 4. Verification & Test Results
- Startup log confirmed the repair ran and fixed exactly the 3 stranded folders
  created before the fix (`4567`, `11`, `2` — all back in `bureauordre`; stranded
  rows now 0).
- Live API run against brand-new services and users — **32/32**:
  unique creation (creator keeps it, receiver sees nothing, request waits in the
  Notifications and Registre, empty history, accept moves it and records the hop,
  notification dismissed); plain transfer; refusal (stays with sender, sender
  notified with the exact wording, no bogus hop); `Annuler l'envoi`; historical
  service (folder does not move, hop recorded immediately).
- Backend build: **0 errors, 0 warnings**. Backend unit tests: **121/121**.
- `tsc --noEmit` and ESLint: 0 errors, 0 warnings. Cypress E2E: **87/87 (9 specs)**.
- Database after run: 6 documents (all pre-existing), 0 trashed, 0 orphaned
  transactions, 0 test artifacts (temp services/users/documents purged).

### 5. Current System State & Pending Tasks
- All green: 121 unit tests, 87 E2E tests, clean build, clean lint.
- Folder custody now matches the specified contract in every path: sender keeps the
  folder, receiver only gains it on accept, refusals notify the sender with the
  reason, cancels leave it with the sender, historical services are record-only.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.

---

## [2026-09-20 17:17] — One Folder per Named Recipient + Dynamic Destination Picker

### 1. Context & Objective
- A send that named several users gave them **one shared row**. The first to
  answer moved it out from under the others, so recipients competed over the same
  folder and could not work independently. Each named recipient must now receive
  their **own copy** — same information, separate folder.
- The juridical form's **Circuit du dossier** (5-circle path) and **Nature du
  circuit initial** (Maktab Dabt / Kitaba Khasa radios, plus their whole step
  wizard) had to be replaced by the **destination service** the folder is sent to:
  a live list of every service **and** historical service, with a recipients group
  appearing beside it once a service is chosen — one member, or the whole service.
- Multiple users inside one service must be able to work without colliding.

### 2. Files Modified / Created / Deleted
- `[MODIFIED]` `WebApplication1/Models/Document.cs` — added `CopieDeDocumentId`,
  the link from a copy back to the folder it was duplicated from.
- `[CREATED]` `WebApplication1/Services/DocumentCloneService.cs` — rebuilds the
  concrete document type field-by-field, gives the copy its own physical
  attachment, and replays the source's committed journey onto it.
- `[CREATED]` `WebApplication1/Migrations/20260920155225_AddDocumentCopyLink.cs`
  + designer + updated snapshot — `Documents.CopieDeDocumentId` (nullable int).
- `[MODIFIED]` `WebApplication1/Program.cs` — registered `DocumentCloneService`.
- `[MODIFIED]` `WebApplication1/Services/TransactionService.cs` — accept now hands
  a copy over when another **named** recipient is still pending, otherwise moves
  the folder itself; the decision is recorded *after* the copy step (so the
  acceptance is not replayed into the copy's own history); competing-request
  cancellation is skipped on the copy path; refusal no longer closes requests that
  name a **different** recipient.
- `[MODIFIED]` `WebApplication1/WebApplication1.Tests/TransactionServiceTests.cs`
  — service-wide accept, copy-per-named-recipient, last-recipient-takes-the-
  original, inherited history, and refusal-leaves-other-recipients-actionable.
- `[MODIFIED]` `frontend-juridique/app/hooks/useServiceOptions.ts` — also reads
  `/api/historical-services`, exposing `historicalOptions` and `isHistorical()`.
- `[MODIFIED]` `frontend-juridique/app/components/forms/JuridiqueForm.tsx` —
  circuit blocks removed and replaced by the destination service select
  (`jur-service-destination`) plus a recipients group
  (`jur-recipients-group` → `jur-recipient-user`) fed by
  `/api/Users/by-service/{code}`; `Numéro de dossier (Cour d'Appel)` kept as a
  first-class required field so no data entry was lost with the wizard.
- `[MODIFIED]` `frontend-juridique/app/page.tsx` — dropped 13 circuit state
  variables and their props; added `jurServiceDestination`/`jurRecipientUserIds`;
  the juridical creation now issues the reception **request** right after the
  folder is created; added `data-testid` hooks on the sub-tabs and submit button.
- `[MODIFIED]` `frontend-juridique/lib/translations.ts` — removed the 39 keys left
  dead by the removed circuit UI *and* the pre-existing dead ones (343 → 304 keys,
  FR/AR still perfectly symmetric).
- `[MODIFIED]` `frontend-juridique/app/components/layout/Sidebar.tsx` — added the
  `nav-gerer-courriers` test hook.
- `[CREATED]` `frontend-juridique/cypress/e2e/juridique-destination.cy.ts` — 3
  tests: live service list + scoped recipients group, send to one chosen user,
  send to the whole service.
- `[MODIFIED]` `README.md` — feature bullets and test counts (125 unit / 90 E2E).

### 3. Key Technical & Architectural Decisions
- **Copy at accept time, not at send time.** The folder stays with the sender
  while pending, so the sender sees one folder, not N. The first named recipient to
  accept spins off a copy and the **last** one moves the folder itself — exactly N
  folders for N recipients, with nothing left behind.
- **Only named recipients fork.** A service-wide request (nobody named) still moves
  the folder into the service where every member can work on it; that is what keeps
  sending to a service from multiplying it into one folder per member.
- A copy carries the **same `NumeroReference`** as its source (the allowance already
  granted to a `document lié`) and points at the root via `CopieDeDocumentId`.
- Copies inherit the committed journey (accepted/refused hops; pending, cancelled
  and `[REFUS]` notices excluded), so `Parcours du dossier` is preserved.
- The existing `[RequirePermission]` guards and custody checks are untouched, so a
  copy is only ever created by the recipient's own acceptance.
- No hardcoding: the destination list and the recipients list are both read live
  (`/api/rbac/services`, `/api/historical-services`, `/api/Users/by-service/{code}`).

### 4. Verification & Test Results
- Live API run against a **brand-new service with two brand-new users** — **45/45**:
  both get a request and neither sees the folder before answering; recipient 1
  accepts → a *separate* copy arrives while the original stays with the sender and
  recipient 2's request stays open; recipient 2 accepts → takes the original and
  there is no pending left; service-wide send → exactly one folder lands and both
  members see it; one named recipient refuses → folder stays with the sender, the
  sender is notified with the exact wording, and the other recipient is still able
  to accept; historical service → folder does not move and the hop is recorded.
- E2E `juridique-destination.cy.ts` — 3/3: the live service list contains a service
  created at runtime, the recipients group appears only once a service is chosen
  and is scoped to it, a chosen user is the only one asked to accept, and choosing
  nobody asks the whole service.
- Backend build: **0 errors, 0 warnings**. Backend unit tests: **125/125** (was 121).
- `tsc --noEmit` and ESLint: **0 errors, 0 warnings**. Cypress E2E: **90/90 (10 specs)**
  (was 87/9).
- Database after run: 7 documents (all pre-existing), 0 trashed, 0 copies, 0 E2E
  services/users, 0 fixtures.

### 5. Current System State & Pending Tasks
- All green: 125 unit tests, 90 E2E tests, clean build, clean lint, clean DB.
- The juridical sub-tab routes by destination service (live catalog) and can address
  one member of it or the whole service.
- Worth knowing: visibility is **service-scoped**, so members of the same service see
  every folder the service holds — including a copy a colleague just received. The
  copies are separate rows with separate histories, which is what makes them
  independently editable.
- Pending (unchanged): the dashboard pipeline (`WORKFLOW_STEPS`) is still a
  hardcoded six-step list.

---

## [2026-09-20 18:05] — Dashboard Workflow Pipeline Reads the Live Service Catalog

### 1. Context & Objective
- `WORKFLOW_STEPS` in `lib/constants.ts` was a fixed six-stage list
  (`bureauordre`, `ouverture`, `secretarait`, `seances`, `greffe`,
  `bureaudetranscription`), with a parallel `WORKFLOW_SERVICE_MAP`. Keeping a
  service on the chart meant editing the file by hand, and every view that drew
  the pipeline (dashboard, both tables, the detail modal, the per-stage
  counters) read from it independently.
- Service management is dynamic — services are created, renamed and archived from
  the admin panel — so any of those actions silently desynchronised the chart
  from the live catalog: a newly created service never appeared as a stage, an
  archived one stayed on the chart forever, and reordering was impossible
  without code.
- Goal: derive the pipeline from the same live catalog the rest of the app uses,
  with no static service list anywhere in that path.

### 2. Files Modified / Created / Deleted
- `[MODIFY]` `frontend-juridique/lib/constants.ts` — Removed `WORKFLOW_STEPS`
  and `WORKFLOW_SERVICE_MAP`. Added `buildWorkflowSteps()` (catalog rows → steps:
  code, FR/AR label, order) and `workflowProgress()` (the index of a document's
  current service inside the pipeline).
- `[CREATE]` `frontend-juridique/app/hooks/useWorkflowSteps.ts` —
  `useWorkflowSteps()` merges the active catalog (`/api/rbac/services`) with
  `/api/historical-services`, de-duplicates by code and returns the ordered
  steps.
- `[MODIFY]` `frontend-juridique/app/components/dashboard/WorkflowSteps.tsx` —
  Takes `steps` as a prop; step colour is derived (active vs. pending) instead of
  coming from a baked-in map. Added `data-testid="workflow-step"` /
  `data-step-label` for stable selectors.
- `[MODIFY]` `frontend-juridique/app/components/dashboard/DashboardView.tsx` —
  Consumes the hook and passes the ordered steps down.
- `[MODIFY]` `frontend-juridique/app/components/tables/GeneralTable.tsx`,
  `frontend-juridique/app/components/tables/SortantTable.tsx` — Accept the
  pipeline as a prop instead of importing the removed map.
- `[MODIFY]` `frontend-juridique/app/page.tsx` — Dropped `WORKFLOW_SERVICE_MAP`
  and `getWorkflowIndex`; per-stage counters now key on the service code from the
  hook.
- `[MODIFY]` `frontend-juridique/app/components/modals/DetailModal.tsx` — Stage
  lookup goes through the hook-backed pipeline.
- `[CREATE]` `frontend-juridique/cypress/e2e/workflow-pipeline.cy.ts` — 4 tests:
  the pipeline renders from the catalog; a service created at runtime becomes a
  stage; an archived service disappears; parent/child ordering is respected.
- `[MODIFY]` `README.md` — Test counts and the dynamic-pipeline description.

### 3. Key Technical & Architectural Decisions
- **No static service list in the chart path.** The pipeline *is* the catalog;
  the only merge is with historical services, which are read from the API too.
- **Ordering is data-driven.** The catalog's own order column wins over array
  position, so reordering services in the admin panel reorders the chart with no
  code change.
- **Stage membership keyed on the service code, not the label**, so renaming a
  service updates the chart text without breaking progress or the counters.
- A single hook is now the source of truth for the dashboard, both tables and the
  detail modal, so those views can no longer disagree about the pipeline.

### 4. Verification & Test Results
- **Live catalog check:** created a service through the admin API at runtime — it
  rendered as a stage immediately; archived it — it left the chart.
- Backend build: **0 errors, 0 warnings**.
- Backend unit tests: **125/125**.
- `tsc --noEmit`: 0 errors. `eslint`: 0 errors, 0 warnings.
- Cypress E2E: **94/94 across 11 specs** (the 4 new pipeline tests plus the
  existing 90, no regressions).
- Database after the run: no test artifacts, no trashed rows, no orphaned
  transactions.

### 5. Current System State & Pending Tasks
- **System operational status:** Fully green. API on `:5200`, web on `:3000`.
- The dashboard pipeline, both tables and the detail modal all follow the live
  service catalog.
- **Known interaction:** a document sitting in a service that is later archived
  keeps its stage until that service leaves the catalog entirely — historical
  services are intentionally part of the pipeline, since a document can still
  reside in them.

