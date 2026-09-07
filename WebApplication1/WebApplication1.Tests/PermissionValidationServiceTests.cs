using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    public class PermissionValidationServiceTests
    {
        private static (AppDbContext ctx, PermissionValidationService service) Create()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            var ctx = new AppDbContext(options);
            var service = new PermissionValidationService(ctx, new PermissionService(ctx));
            return (ctx, service);
        }

        private static DefaultHttpContext HttpContext()
        {
            var http = new DefaultHttpContext();
            http.Request.Method = "POST";
            http.Request.Path = "/api/Transfer";
            return http;
        }

        [Fact]
        public async Task ValidatePermissionAsync_UserWithoutPermission_Denied()
        {
            var (ctx, service) = Create();
            ctx.Utilisateurs.Add(new Utilisateur { Login = "u1", Nom = "Agent", Role = "User", Service = "archive", ServiceId = null });
            ctx.SaveChanges();

            var result = await service.ValidatePermissionAsync(1, "transferer", HttpContext());

            Assert.False(result.IsAllowed);
            Assert.Contains("not granted", result.Reason);
        }

        [Fact]
        public async Task ValidatePermissionAsync_UserWithPermission_AllowedAndLogged()
        {
            var (ctx, service) = Create();
            var svc = new Service { Nom = "Archive", Code = "archive" };
            ctx.RbacServices.Add(svc);
            ctx.SaveChanges();
            ctx.ServicePermissions.Add(new ServicePermission { ServiceId = svc.Id, PermissionKey = "archiver", Enabled = true });
            ctx.Utilisateurs.Add(new Utilisateur { Login = "archive", Nom = "Agent", Role = "User", Service = "archive", ServiceId = svc.Id });
            ctx.SaveChanges();

            var result = await service.ValidatePermissionAsync(1, "archiver", HttpContext());

            Assert.True(result.IsAllowed);
            // Audit log must have been written with a valid FK to the user
            // (regression: UtilisateurId used to stay 0 -> FK violation on SQL Server)
            var log = await ctx.PermissionValidationLogs.SingleAsync();
            Assert.Equal(1, log.UserId);
            Assert.Equal(1, log.UtilisateurId);
        }

        [Fact]
        public async Task ValidatePermissionAsync_AdminWithDisabledOverride_Denied()
        {
            var (ctx, service) = Create();
            ctx.AdminPermissionOverrides.Add(new AdminPermissionOverride { PermissionKey = "transferer", Enabled = false });
            ctx.Utilisateurs.Add(new Utilisateur { Login = "admin", Nom = "Admin", Role = "Admin", Service = "Admin" });
            ctx.SaveChanges();

            var result = await service.ValidatePermissionAsync(1, "transferer", HttpContext());

            Assert.False(result.IsAllowed);
            Assert.Contains("not granted", result.Reason);
        }

        [Fact]
        public async Task ValidatePermissionAsync_AdminWithoutOverride_Allowed()
        {
            var (ctx, service) = Create();
            ctx.Permissions.Add(new Permission
            {
                Key = "dashboard",
                Category = "dashboard",
                LabelFr = "Tableau de bord",
                LabelAr = "لوحة القيادة",
                DefaultEnabled = true
            });
            ctx.Utilisateurs.Add(new Utilisateur { Login = "admin", Nom = "Admin", Role = "Admin", Service = "Admin" });
            ctx.SaveChanges();

            var result = await service.ValidatePermissionAsync(1, "dashboard", HttpContext());

            Assert.True(result.IsAllowed);
        }

        [Fact]
        public async Task ValidatePermissionAsync_UnknownUser_Denied()
        {
            var (ctx, service) = Create();

            var result = await service.ValidatePermissionAsync(999, "dashboard", HttpContext());

            Assert.False(result.IsAllowed);
        }
    }
}
