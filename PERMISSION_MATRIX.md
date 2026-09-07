# 📋 Permission Matrix — Complete Reference

> Every permission key in the system, with its protected API endpoints and guarded UI elements.
> Auto-generated from RBAC codebase scan.

---

## Permission Keys

| # | Permission Key | Backend Controllers |
|---|---|---|
| 1 | `accepter` | TransactionsController.cs |
| 2 | `ajouter_notes` | WorkspaceController.cs |
| 3 | `archiver` | DocumentsController.cs |
| 4 | `creer_courrier_admin` | CourrierAdminController.cs |
| 5 | `creer_courrier_juridique` | CourrierJuridiqueController.cs |
| 6 | `creer_modifier` | CourrierSortantController.cs |
| 7 | `gerer_equipements` | EquipmentController.cs |
| 8 | `gerer_listes` | ListItemsController.cs |
| 9 | `gerer_permissions` | RbacPermissionsController.cs |
| 10 | `gerer_services` | HistoricalServicesController.cs,RbacServicesController.cs,ServicesController.cs |
| 11 | `gerer_utilisateurs` | UsersController.cs |
| 12 | `refuser` | TransactionsController.cs |
| 13 | `restaurer` | DocumentsController.cs |
| 14 | `retrait_archive` | RetraitController.cs |
| 15 | `supprimer` | CourrierAdminController.cs,CourrierJuridiqueController.cs,CourrierSortantController.cs,DocumentsController.cs |
| 16 | `transferer` | TransferController.cs |
| 17 | `transferer_juridique` | ActionsJuridiquesController.cs,TransactionJuridiqueController.cs |
| 18 | `voir_corbeille` | DocumentsController.cs |

---

## Service Soft-Delete & Archive Workflow

### Soft-Delete (Archive) Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `DELETE /api/rbac/services/{id}` | Soft-delete | Sets `IsActive = false`, `DeletedAt = now` |
| `GET /api/rbac/services?includeInactive=true` | List all | Returns both active and archived services |
| `GET /api/rbac/services` | List active | Returns only active services (default) |
| `POST /api/rbac/services/{id}/restore` | Restore | Sets `IsActive = true`, `DeletedAt = null` |
| `DELETE /api/rbac/services/{id}/permanent` | Permanent delete | Removes from DB (only if no users assigned) |

### Archive Rules

- **Active filter**: All service dropdowns query only active services by default.
- **Permanent delete guard**: Cannot permanently delete a service with assigned users (returns 400).
- **Admin archive view**: GestionServices panel has "Voir Archives" button with Restore + Permanent Delete.

### Multi-User Transfer Routing

| Feature | Description |
|---|---|
| `targetUserIds` | Array of user IDs in `POST /api/Transfer` body |
| Behavior | Creates a separate transaction for each selected user |
| Backward compat | `targetUserId` (single) still works; `targetUserIds` takes priority |
| UI | TransferModal shows checkboxes for multi-user selection per service |

---

## Audit Commands

```bash
# Run the full permission audit (46 checks)
bash scripts/permission-audit.sh

# Run Cypress E2E tests (permission-toggle + app tests)
cd frontend-juridique && npx cypress run

# Run .NET unit tests
cd WebApplication1 && dotnet test WebApplication1.Tests/WebApplication1.Tests.csproj

# Re-seed the database
curl -X POST http://localhost:5200/api/seed/run -H "Authorization: Bearer $ADMIN_TOKEN"

# Regenerate this matrix
bash scripts/generate-permission-matrix.sh
```
