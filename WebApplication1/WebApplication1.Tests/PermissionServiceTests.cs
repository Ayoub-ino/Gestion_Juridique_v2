using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    public class PermissionServiceTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        private static void AddPermissions(AppDbContext ctx, params string[] keys)
        {
            foreach (var key in keys)
            {
                ctx.Permissions.Add(new Permission
                {
                    Key = key,
                    LabelFr = key,
                    LabelAr = key,
                    Category = "documents",
                    DefaultEnabled = true
                });
            }
            ctx.SaveChanges();
        }

        [Fact]
        public async Task GetUserPermissionsAsync_AdminWithoutOverrides_ReturnsAllPermissions()
        {
            using var ctx = CreateContext();
            AddPermissions(ctx, "transferer", "consulter", "supprimer");
            ctx.Utilisateurs.Add(new Utilisateur { Login = "admin", Nom = "Admin", Role = "Admin", Service = "Admin" });
            ctx.SaveChanges();

            var service = new PermissionService(ctx);
            var result = await service.GetUserPermissionsAsync(1);

            Assert.Contains("transferer", result);
            Assert.Contains("consulter", result);
            Assert.Contains("supprimer", result);
        }

        [Fact]
        public async Task GetUserPermissionsAsync_AdminWithDisabledOverride_ExcludesThatPermission()
        {
            using var ctx = CreateContext();
            AddPermissions(ctx, "transferer", "consulter");
            ctx.AdminPermissionOverrides.Add(new AdminPermissionOverride { PermissionKey = "transferer", Enabled = false });
            ctx.Utilisateurs.Add(new Utilisateur { Login = "admin", Nom = "Admin", Role = "Admin", Service = "Admin" });
            ctx.SaveChanges();

            var service = new PermissionService(ctx);
            var result = await service.GetUserPermissionsAsync(1);

            Assert.DoesNotContain("transferer", result);
            Assert.Contains("consulter", result);
        }

        [Fact]
        public async Task GetUserPermissionsAsync_ServiceUser_ReturnsOnlyEnabledServicePermissions()
        {
            using var ctx = CreateContext();
            var svc = new Service { Nom = "Bureau ordre", Code = "bureauordre" };
            ctx.RbacServices.Add(svc);
            ctx.SaveChanges();
            ctx.ServicePermissions.AddRange(
                new ServicePermission { ServiceId = svc.Id, PermissionKey = "transferer", Enabled = true },
                new ServicePermission { ServiceId = svc.Id, PermissionKey = "supprimer", Enabled = false }
            );
            ctx.Utilisateurs.Add(new Utilisateur { Login = "bureauordre", Nom = "Agent", Role = "User", Service = "bureauordre", ServiceId = svc.Id });
            ctx.SaveChanges();

            var service = new PermissionService(ctx);
            var result = await service.GetUserPermissionsAsync(1);

            Assert.Contains("transferer", result);
            Assert.DoesNotContain("supprimer", result);
        }

        [Fact]
        public async Task GetUserPermissionsAsync_UserWithoutService_ReturnsEmpty()
        {
            using var ctx = CreateContext();
            ctx.Utilisateurs.Add(new Utilisateur { Login = "sansservice", Nom = "Agent", Role = "User", ServiceId = null });
            ctx.SaveChanges();

            var service = new PermissionService(ctx);
            var result = await service.GetUserPermissionsAsync(1);

            Assert.Empty(result);
        }

        [Fact]
        public async Task HasPermissionAsync_AdminWithDisabledOverride_ReturnsFalse()
        {
            using var ctx = CreateContext();
            ctx.AdminPermissionOverrides.Add(new AdminPermissionOverride { PermissionKey = "transferer", Enabled = false });
            ctx.Utilisateurs.Add(new Utilisateur { Login = "admin", Nom = "Admin", Role = "Admin", Service = "Admin" });
            ctx.SaveChanges();

            var service = new PermissionService(ctx);
            Assert.False(await service.HasPermissionAsync(1, "transferer"));
            Assert.True(await service.HasPermissionAsync(1, "dashboard"));
        }

        [Fact]
        public async Task HasPermissionAsync_ServiceUser_RespectsEnabledFlag()
        {
            using var ctx = CreateContext();
            var svc = new Service { Nom = "Archive", Code = "archive" };
            ctx.RbacServices.Add(svc);
            ctx.SaveChanges();
            ctx.ServicePermissions.Add(new ServicePermission { ServiceId = svc.Id, PermissionKey = "archiver", Enabled = true });
            ctx.Utilisateurs.Add(new Utilisateur { Login = "archive", Nom = "Agent", Role = "User", Service = "archive", ServiceId = svc.Id });
            ctx.SaveChanges();

            var service = new PermissionService(ctx);
            Assert.True(await service.HasPermissionAsync(1, "archiver"));
            Assert.False(await service.HasPermissionAsync(1, "transferer"));
        }
    }
}
