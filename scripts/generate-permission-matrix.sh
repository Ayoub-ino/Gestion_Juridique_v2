#!/usr/bin/env bash
# generate-permission-matrix.sh
# Auto-generates PERMISSION_MATRIX.md from the codebase.
# Usage: bash scripts/generate-permission-matrix.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$ROOT_DIR/WebApplication1/WebApplication1"
FRONTEND="$ROOT_DIR/frontend-juridique"
OUTPUT="$ROOT_DIR/PERMISSION_MATRIX.md"

# Count tests
CYPRESS_COUNT=$(grep -c '^\s*it(' "$FRONTEND/cypress/e2e/permission-toggle.cy.ts" 2>/dev/null || echo "0")
CYPRESS_APP_COUNT=$(grep -c '^\s*it(' "$FRONTEND/cypress/e2e/app.cy.ts" 2>/dev/null || echo "0")
DOTNET_COUNT=$(grep -c '\[Fact\]\|\[Theory\]' "$ROOT_DIR/WebApplication1/WebApplication1.Tests/"*.cs 2>/dev/null | awk -F: '{s+=$2}END{print s+0}')

echo "Scanning backend controllers..."

# Get all unique permissions
ALL_PERMS=$(grep -rn 'RequirePermission' "$BACKEND/Controllers/" 2>/dev/null | \
    sed 's/.*RequirePermission("\([^"]*\)".*/\1/' | sort -u)

cat > "$OUTPUT" << EOF
# 📋 Permission Matrix — Complete Reference

> Every permission key in the system, with its protected API endpoints and guarded UI elements.
> Auto-generated from RBAC codebase scan.

---

## Permission Keys

| # | Permission Key | Backend Controllers |
|---|---|---|
EOF

i=1
for perm in $ALL_PERMS; do
    controllers=$(grep -rn "RequirePermission(\"$perm\")" "$BACKEND/Controllers/" 2>/dev/null | \
        cut -d: -f1 | sed "s|$BACKEND/Controllers/||" | sort -u | tr '\n' ', ' | sed 's/,$//')
    echo "| $i | \`$perm\` | $controllers |" >> "$OUTPUT"
    i=$((i+1))
done

cat >> "$OUTPUT" << 'EOF'

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
EOF

PERM_COUNT=$(echo "$ALL_PERMS" | wc -l)
echo "✅ Generated $OUTPUT"
echo "   Permissions found: $PERM_COUNT"
echo "   Cypress tests: $CYPRESS_COUNT permission-toggle + $CYPRESS_APP_COUNT app"
echo "   Dotnet tests: $DOTNET_COUNT"
