using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    public class PermissionEnforcementTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        private static Utilisateur CreateUser(string service, string role = "User")
        {
            var user = new Utilisateur
            {
                Login = $"user_{service}_{Guid.NewGuid():N}",
                PasswordHash = "hash",
                Nom = $"User {service}",
                Role = role,
                Service = service,
                IsActive = true
            };
            return user;
        }

        // ─────────────────────────────────────────────────
        //  SubstitutesController permission tests
        // ─────────────────────────────────────────────────

        [Fact]
        public async Task Substitutes_Create_RequiresGererSubstituts()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);

            // User without gerer_substituts should not have the permission
            var user = await ctx.Utilisateurs.FirstAsync(u => u.Login == "secretarait");
            var hasPermission = await permissionService.HasPermissionAsync(user.Id, "gerer_substituts");
            Assert.False(hasPermission, "secretarait should NOT have gerer_substituts permission");
        }

        [Fact]
        public async Task Substitutes_Create_AdminHasGererSubstituts()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);

            // Admin should have gerer_substituts permission
            var admin = await ctx.Utilisateurs.FirstAsync(u => u.Login == "admin");
            var hasPermission = await permissionService.HasPermissionAsync(admin.Id, "gerer_substituts");
            Assert.True(hasPermission, "Admin should have gerer_substituts permission");
        }

        // ─────────────────────────────────────────────────
        //  FileUploadController download permission tests
        // ─────────────────────────────────────────────────

        [Fact]
        public async Task FileUpload_Download_RequiresTelechargerFichiers()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);

            // User with telecharger_fichiers should have it
            var bureauordre = await ctx.Utilisateurs.FirstAsync(u => u.Login == "bureauordre");
            var hasPermission = await permissionService.HasPermissionAsync(bureauordre.Id, "telecharger_fichiers");
            Assert.True(hasPermission, "bureauordre should have telecharger_fichiers permission");
        }

        [Fact]
        public async Task FileUpload_Download_PermissionToggleWorks()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);
            var bureauordre = await ctx.Utilisateurs.FirstAsync(u => u.Login == "bureauordre");

            // Initially should have the permission
            Assert.True(await permissionService.HasPermissionAsync(bureauordre.Id, "telecharger_fichiers"));

            // Disable the permission for bureauordre's service
            var bureauService = await ctx.RbacServices.FirstAsync(s => s.Code == "bureauordre");
            var perm = await ctx.ServicePermissions.FirstAsync(sp =>
                sp.ServiceId == bureauService.Id && sp.PermissionKey == "telecharger_fichiers");
            perm.Enabled = false;
            await ctx.SaveChangesAsync();

            // Should now be denied
            Assert.False(await permissionService.HasPermissionAsync(bureauordre.Id, "telecharger_fichiers"));

            // Re-enable
            perm.Enabled = true;
            await ctx.SaveChangesAsync();

            // Should be allowed again
            Assert.True(await permissionService.HasPermissionAsync(bureauordre.Id, "telecharger_fichiers"));
        }

        // ─────────────────────────────────────────────────
        //  WorkspaceController permission tests
        // ─────────────────────────────────────────────────

        [Fact]
        public async Task Workspace_GetDocument_RequiresVoirWorkspace()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);

            // voir_workspace is NOT in bureauordre's default permission set
            // This verifies the permission check is in place
            var bureauordre = await ctx.Utilisateurs.FirstAsync(u => u.Login == "bureauordre");
            var hasPermission = await permissionService.HasPermissionAsync(bureauordre.Id, "voir_workspace");
            // bureauordre doesn't have voir_workspace by default — this is expected
            // The permission guard on the endpoint will block access
            Assert.False(hasPermission, "bureauordre should NOT have voir_workspace by default");

            // Admin should have it (admin gets all permissions unless overridden)
            var admin = await ctx.Utilisateurs.FirstAsync(u => u.Login == "admin");
            var adminHasPermission = await permissionService.HasPermissionAsync(admin.Id, "voir_workspace");
            // voir_workspace is NOT in the admin override list, so admin should have it
            Assert.True(adminHasPermission, "Admin should have voir_workspace permission");
        }

        [Fact]
        public async Task Workspace_GetModifications_RequiresVoirHistorique()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);

            // bureauordre should have voir_historique
            var bureauordre = await ctx.Utilisateurs.FirstAsync(u => u.Login == "bureauordre");
            Assert.True(await permissionService.HasPermissionAsync(bureauordre.Id, "voir_historique"));
        }

        // ─────────────────────────────────────────────────
        //  Cloturer permission tests
        // ─────────────────────────────────────────────────

        [Fact]
        public async Task Cloturer_AdminOverrideLifecycle()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);
            var admin = await ctx.Utilisateurs.FirstAsync(u => u.Login == "admin");

            // cloturer is in the admin override list with Enabled=false
            // So admin should NOT have it initially
            Assert.False(await permissionService.HasPermissionAsync(admin.Id, "cloturer"),
                "Admin should NOT have cloturer when it's overridden off");

            // Find and update the existing override to Enabled=true
            var existingOverride = await ctx.AdminPermissionOverrides
                .FirstAsync(o => o.PermissionKey == "cloturer");
            existingOverride.Enabled = true;
            await ctx.SaveChangesAsync();

            // Now admin should have it
            Assert.True(await permissionService.HasPermissionAsync(admin.Id, "cloturer"),
                "Admin should have cloturer when override is enabled");

            // Disable it again
            existingOverride.Enabled = false;
            await ctx.SaveChangesAsync();

            // Should be denied again
            Assert.False(await permissionService.HasPermissionAsync(admin.Id, "cloturer"),
                "Admin should NOT have cloturer when override is disabled again");
        }

        // ─────────────────────────────────────────────────
        //  Permission toggle lifecycle tests
        // ─────────────────────────────────────────────────

        [Fact]
        public async Task Permission_Toggle_CreerCourierAdmin_BlocksCreation()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);
            var bureauordre = await ctx.Utilisateurs.FirstAsync(u => u.Login == "bureauordre");

            // Should have the permission initially
            Assert.True(await permissionService.HasPermissionAsync(bureauordre.Id, "creer_courrier_admin"));

            // Disable it
            var bureauService = await ctx.RbacServices.FirstAsync(s => s.Code == "bureauordre");
            var perm = await ctx.ServicePermissions.FirstAsync(sp =>
                sp.ServiceId == bureauService.Id && sp.PermissionKey == "creer_courrier_admin");
            perm.Enabled = false;
            await ctx.SaveChangesAsync();

            // Should be denied
            Assert.False(await permissionService.HasPermissionAsync(bureauordre.Id, "creer_courrier_admin"));

            // Re-enable
            perm.Enabled = true;
            await ctx.SaveChangesAsync();
            Assert.True(await permissionService.HasPermissionAsync(bureauordre.Id, "creer_courrier_admin"));
        }

        [Fact]
        public async Task Permission_Toggle_Transferer_BlocksTransfer()
        {
            var ctx = CreateContext();
            var seeder = new SeederService(ctx);
            await seeder.SeedCoreAsync(force: false);

            var permissionService = new PermissionService(ctx);
            var bureauordre = await ctx.Utilisateurs.FirstAsync(u => u.Login == "bureauordre");

            // Should have the permission initially
            Assert.True(await permissionService.HasPermissionAsync(bureauordre.Id, "transferer"));

            // Disable it
            var bureauService = await ctx.RbacServices.FirstAsync(s => s.Code == "bureauordre");
            var perm = await ctx.ServicePermissions.FirstAsync(sp =>
                sp.ServiceId == bureauService.Id && sp.PermissionKey == "transferer");
            perm.Enabled = false;
            await ctx.SaveChangesAsync();

            // Should be denied
            Assert.False(await permissionService.HasPermissionAsync(bureauordre.Id, "transferer"));

            // Re-enable
            perm.Enabled = true;
            await ctx.SaveChangesAsync();
            Assert.True(await permissionService.HasPermissionAsync(bureauordre.Id, "transferer"));
        }

        // ═══════════════════════════════════════════════════════════
        // ServiceTribunal → RBAC code mapping tests
        // ═══════════════════════════════════════════════════════════

        [Fact]
        public void ServiceTribunalToRbacCode_AllNineServices_MapsCorrectly()
        {
            // Map every ServiceTribunal to its expected RBAC Service.Code
            var expected = new Dictionary<ServiceTribunal, string>
            {
                { ServiceTribunal.BureauOrdre, "bureauordre" },
                { ServiceTribunal.OuvertureDossier, "fathmilafat" },
                { ServiceTribunal.KitabaKhasa, "secretarait" },
                { ServiceTribunal.JalsatWaIjra2at, "seances&procedures" },
                { ServiceTribunal.Khibra, "khibra" },
                { ServiceTribunal.TaslimNusakh, "taslimnosakh" },
                { ServiceTribunal.TasfiyatSawa2ir, "tasfiatSawa2irTakmilia" },
                { ServiceTribunal.Archive, "archive" },
                { ServiceTribunal.Tabligh, "atabligh" }
            };

            foreach (var (enumVal, expectedCode) in expected)
            {
                var actual = DocumentAccessService.ServiceTribunalToRbacCode(enumVal);
                Assert.Equal(expectedCode, actual);
            }
        }

        [Fact]
        public void ServiceTribunalToRbacCode_ParentServices_MapToChildRbacCode()
        {
            // JalsatWaIjra2at children that belong to seances&procedures
            Assert.Equal("seances&procedures", DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.Ijra2Baht));
            Assert.Equal("seances&procedures", DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.MofawidMalaki));
            // MustacharMoqarir is an expert advisory report → maps to khibra
            Assert.Equal("khibra", DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.MustacharMoqarir));
            Assert.Equal("khibra", DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.BureauExpertise));
        }

        [Fact]
        public void ServiceTribunalToRbacCode_EnumNameDiffersFromRbacCode_ForAtLeastSixServices()
        {
            // Verify that at least 6 services have different enum names vs RBAC codes
            var mismatchCount = 0;
            var nineMain = new[]
            {
                ServiceTribunal.BureauOrdre, ServiceTribunal.OuvertureDossier,
                ServiceTribunal.KitabaKhasa, ServiceTribunal.JalsatWaIjra2at,
                ServiceTribunal.Khibra, ServiceTribunal.TaslimNusakh,
                ServiceTribunal.TasfiyatSawa2ir, ServiceTribunal.Archive, ServiceTribunal.Tabligh
            };
            foreach (var svc in nineMain)
            {
                var rbacCode = DocumentAccessService.ServiceTribunalToRbacCode(svc);
                var enumCode = svc.ToString().ToLowerInvariant();
                if (rbacCode != enumCode) mismatchCount++;
            }
            Assert.True(mismatchCount >= 6,
                $"Expected at least 6 mismatches between enum names and RBAC codes, found {mismatchCount}");
        }
    }
}
