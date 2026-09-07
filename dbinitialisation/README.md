# Database Initialisation

This folder contains the database initialization and seeding documentation for the project.

## Seed Logic

The primary seed logic is implemented in:

**`WebApplication1/WebApplication1/Services/SeederService.cs`**

This C# service is called automatically on application startup and can also be triggered via the `POST /api/seed/run` endpoint (Admin role required).

### What Gets Seeded

| # | Step | Description |
|---|------|-------------|
| 1 | Admin User | Creates `admin` / `admin123` if not exists |
| 2 | RBAC Services | 9 services (BureauOrdre, FathMlafat, Secrétariat, etc.) |
| 3 | Permissions | ~35 permission keys across categories (documents, notifications, juridique, recherche, admin, autres) |
| 4 | ServicePermissions | Maps permissions to each service (permission matrix) |
| 5 | AdminPermissionOverrides | 20 permissions disabled for admin by default |
| 5b | HistoricalServices | Virtual services for history tracking |
| 6 | Demo Users | One user per RBAC service with default credentials |

### Default Users

| Login | Password | Service |
|-------|----------|---------|
| admin | admin123 | Admin |
| bureauordre | bureauordre123 | BureauOrdre |
| fathmilafat | fathmilafat123 | FathMlafat |
| secretarait | secretarait123 | Secrétariat |
| seances | seances123 | Séances & Procédures |
| khibra | khibra123 | Expertise |
| taslimnosakh | taslim123 | Taslim Nusakh |
| tasfiya | tasfiya123 | Tasfiyat Sawa2ir |
| archive | archive123 | Archive |
| atabligh | atabligh123 | Atabligh |

### SQL Scripts

- **`grant-permissions-existing-db.sql`** — Grants database permissions for an existing SQL Server database.
- **`permission-audit.sh`** — Validates permission matrix across all users and endpoints (moved from `scripts/`).

## Startup Flow

```
Program.cs
  → app.Services.CreateScope()
    → scope.ServiceProvider.GetRequiredService<SeederService>()
      → seeder.SeedAsync()
        → Database.Migrate()          // Apply pending EF Core migrations
        → SeedCoreAsync(force: false) // Insert-if-missing for each step
```

## Re-seeding

To force a re-seed (e.g., after permission changes):

```bash
# Via API (Admin token required)
curl -X POST http://localhost:5200/api/seed/run \
  -H "Authorization: Bearer <admin-token>"
```

This runs `SeedAsync(force: true)` which performs idempotent insert-if-missing for each row. Existing rows (including those modified by admins) are **not** overwritten.
