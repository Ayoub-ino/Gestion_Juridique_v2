using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    public class SeederServiceTests
    {
        // Counts below mirror the SeederService matrix — update them together if the
        // matrix changes (services, permission keys, overrides, historical services).
        private const int ExpectedServices = 9;
        private const int ExpectedPermissions = 37;
        private const int ExpectedOverrides = 20;
        private const int ExpectedHistoricalServices = 18;
        private const int ExpectedUsers = 10; // admin + 9 service users

        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        private static SeederService CreateService(AppDbContext ctx) => new(ctx);

        [Fact]
        public async Task SeedCoreAsync_EmptyDb_SeedsEverything()
        {
            var ctx = CreateContext();
            var seeder = CreateService(ctx);

            await seeder.SeedCoreAsync(force: false);

            Assert.Equal(ExpectedServices, await ctx.RbacServices.CountAsync());
            Assert.Equal(ExpectedPermissions, await ctx.Permissions.CountAsync());
            Assert.Equal(ExpectedOverrides, await ctx.AdminPermissionOverrides.CountAsync());
            Assert.Equal(ExpectedHistoricalServices, await ctx.HistoricalServices.CountAsync());
            Assert.Equal(ExpectedUsers, await ctx.Utilisateurs.CountAsync());

            // Matrix spot checks
            var bureauordre = await ctx.RbacServices.SingleAsync(s => s.Code == "bureauordre");
            var bureauPerms = await ctx.ServicePermissions
                .Where(sp => sp.ServiceId == bureauordre.Id)
                .Select(sp => sp.PermissionKey)
                .ToListAsync();
            Assert.Contains("creer_courrier_admin", bureauPerms);
            Assert.Contains("supprimer", bureauPerms);
            Assert.Contains("ajouter_notes", bureauPerms);

            var secretarait = await ctx.RbacServices.SingleAsync(s => s.Code == "secretarait");
            var secPerms = await ctx.ServicePermissions
                .Where(sp => sp.ServiceId == secretarait.Id)
                .Select(sp => sp.PermissionKey)
                .ToListAsync();
            Assert.DoesNotContain("supprimer", secPerms);
            Assert.DoesNotContain("creer_courrier_admin", secPerms);

            var archive = await ctx.RbacServices.SingleAsync(s => s.Code == "archive");
            var archPerms = await ctx.ServicePermissions
                .Where(sp => sp.ServiceId == archive.Id)
                .Select(sp => sp.PermissionKey)
                .ToListAsync();
            Assert.Contains("archiver", archPerms);
            Assert.Contains("retrait_archive", archPerms);
            Assert.Contains("supprimer", archPerms);

            // Admin must be created with a BCrypt hash
            var admin = await ctx.Utilisateurs.SingleAsync(u => u.Login == "admin");
            Assert.Equal("Admin", admin.Role);
            Assert.True(BCrypt.Net.BCrypt.Verify("admin123", admin.PasswordHash));
        }

        [Fact]
        public async Task SeedCoreAsync_ForceOnPopulatedDb_AddsOnlyMissing()
        {
            var ctx = CreateContext();
            var seeder = CreateService(ctx);

            // Pre-populate one row per table
            var bureauordre = new Service { Nom = "Bureau d'ordre", Code = "bureauordre" };
            ctx.RbacServices.Add(bureauordre);
            ctx.Permissions.Add(new Permission { Key = "dashboard", Category = "autres", LabelFr = "T", LabelAr = "ت", DefaultEnabled = true });
            ctx.HistoricalServices.Add(new HistoricalService { Code = "recherche", Nom = "Recherche", SortOrder = 1 });
            ctx.Utilisateurs.Add(new Utilisateur { Login = "admin", Nom = "Admin", Role = "Admin", Service = "Admin" });
            ctx.SaveChanges();
            var bureauId = bureauordre.Id;
            ctx.ServicePermissions.Add(new ServicePermission { ServiceId = bureauId, PermissionKey = "transferer", Enabled = true });
            ctx.AdminPermissionOverrides.Add(new AdminPermissionOverride { PermissionKey = "transferer", Enabled = false });
            ctx.SaveChanges();

            await seeder.SeedCoreAsync(force: true);

            // No duplicates: pre-seeded (transferer) still present, matrix keys added
            var bureauPerms = await ctx.ServicePermissions
                .Where(sp => sp.ServiceId == bureauId)
                .Select(sp => sp.PermissionKey)
                .ToListAsync();
            Assert.Contains("transferer", bureauPerms);
            Assert.Contains("creer_courrier_admin", bureauPerms);
            Assert.Contains("supprimer", bureauPerms);
            // bureauordre matrix has 18 keys -> pre-seeded transferer + 17 added
            Assert.Equal(18, bureauPerms.Count);

            // Overrides: pre-seeded transferer + the 19 missing ones
            Assert.Equal(ExpectedOverrides, await ctx.AdminPermissionOverrides.CountAsync());
            Assert.True(await ctx.AdminPermissionOverrides.AnyAsync(o => o.PermissionKey == "accepter"));

            // Permissions: pre-seeded dashboard + 35 missing
            Assert.Equal(ExpectedPermissions, await ctx.Permissions.CountAsync());

            // Users: admin pre-seeded + 9 service users
            Assert.Equal(ExpectedUsers, await ctx.Utilisateurs.CountAsync());
        }

        [Fact]
        public async Task SeedCoreAsync_Force_DoesNotFlipExistingDisabledRows()
        {
            var ctx = CreateContext();
            var seeder = CreateService(ctx);

            var bureauordre = new Service { Nom = "Bureau d'ordre", Code = "bureauordre" };
            ctx.RbacServices.Add(bureauordre);
            ctx.SaveChanges();
            var bureauId = bureauordre.Id;
            // Admin intentionally disabled 'transferer' for bureauordre
            ctx.ServicePermissions.Add(new ServicePermission { ServiceId = bureauId, PermissionKey = "transferer", Enabled = false });
            ctx.SaveChanges();

            await seeder.SeedCoreAsync(force: true);

            var transfererRow = await ctx.ServicePermissions
                .SingleAsync(sp => sp.ServiceId == bureauId && sp.PermissionKey == "transferer");
            Assert.False(transfererRow.Enabled); // non-destructive: unchanged
            // ...but the other matrix keys were added and enabled
            var courrierRow = await ctx.ServicePermissions
                .SingleAsync(sp => sp.ServiceId == bureauId && sp.PermissionKey == "creer_courrier_admin");
            Assert.True(courrierRow.Enabled);
        }

        [Fact]
        public async Task SeedCoreAsync_NoForce_SkipsNonEmptyTables_SeedsEmptyOnes()
        {
            var ctx = CreateContext();
            var seeder = CreateService(ctx);

            var bureauordre = new Service { Nom = "Bureau d'ordre", Code = "bureauordre" };
            ctx.RbacServices.Add(bureauordre);
            ctx.SaveChanges();
            ctx.ServicePermissions.Add(new ServicePermission { ServiceId = bureauordre.Id, PermissionKey = "transferer", Enabled = true });
            ctx.SaveChanges();

            await seeder.SeedCoreAsync(force: false);

            // Startup mode: the guard is PER TABLE — non-empty tables are skipped,
            // empty ones still get seeded (admin user is always ensured).
            Assert.Equal(1, await ctx.ServicePermissions.CountAsync());          // skipped (non-empty)
            Assert.Equal(ExpectedOverrides, await ctx.AdminPermissionOverrides.CountAsync());      // seeded (was empty)
            Assert.Equal(ExpectedHistoricalServices, await ctx.HistoricalServices.CountAsync());  // seeded (was empty)
            Assert.Equal(ExpectedPermissions, await ctx.Permissions.CountAsync());                // seeded (was empty)
            Assert.Equal(ExpectedUsers, await ctx.Utilisateurs.CountAsync());                     // admin + 9 service users
        }
    }
}
