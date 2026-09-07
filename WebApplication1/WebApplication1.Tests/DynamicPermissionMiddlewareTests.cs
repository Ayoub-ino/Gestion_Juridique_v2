using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;
using WebApplication1.Data;
using WebApplication1.Middleware;
using WebApplication1.Models;
using WebApplication1.Security;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    /// <summary>
    /// Tests for dynamically-gated permissions on newly protected endpoints.
    /// Covers: restaurer, voir_corbeille, gerer_services, gerer_equipements,
    ///         gerer_listes, gerer_permissions, gerer_utilisateurs.
    /// </summary>
    public class DynamicPermissionMiddlewareTests
    {
        private static readonly string[] AllPermissionKeys = new[]
        {
            "creer_modifier", "transferer", "supprimer", "restaurer", "archiver",
            "creer_courrier_admin", "creer_courrier_juridique",
            "accepter", "refuser", "voir_toutes", "voir_corbeille",
            "etape_precedente", "etape_suivante", "ouvrir_dossier",
            "cloturer", "transferer_juridique", "retrait_archive",
            "recherche_avancee", "export_excel", "export_word", "ajouter_notes",
            "gerer_utilisateurs", "gerer_services", "gerer_equipements",
            "gerer_listes", "gerer_permissions", "gerer_substituts"
        };

        private static (IServiceProvider provider, AppDbContext ctx) BuildProvider()
        {
            var services = new ServiceCollection();
            services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
            services.AddScoped<PermissionService>();
            services.AddScoped<PermissionValidationService>();
            var provider = services.BuildServiceProvider();
            var ctx = provider.GetRequiredService<AppDbContext>();
            // Seed the master Permissions table so admin GetUserPermissionsAsync works
            foreach (var key in AllPermissionKeys)
            {
                ctx.Permissions.Add(new Permission { Key = key, LabelFr = key, LabelAr = key, Category = "test" });
            }
            ctx.SaveChanges();
            return (provider, ctx);
        }

        private static DefaultHttpContext HttpContextWithEndpoint(IServiceProvider provider, string permission, int? userId)
        {
            var context = new DefaultHttpContext();
            context.RequestServices = provider;
            var metadata = new EndpointMetadataCollection(new RequirePermissionAttribute(permission));
            context.SetEndpoint(new Endpoint(null, metadata, "test-endpoint"));

            if (userId.HasValue)
            {
                context.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString())
                }, "TestAuth"));
            }
            return context;
        }

        private sealed class NextFlag
        {
            public bool Called { get; set; }
        }

        private static (PermissionValidationMiddleware middleware, NextFlag flag) CreateMiddleware()
        {
            var flag = new NextFlag();
            var middleware = new PermissionValidationMiddleware(
                async ctx => { flag.Called = true; ctx.Response.StatusCode = StatusCodes.Status200OK; });
            return (middleware, flag);
        }

        private static void SeedAdminWithOverrides(AppDbContext ctx, string[]? disabledKeys = null)
        {
            ctx.Utilisateurs.Add(new Utilisateur
            {
                Login = "admin", Nom = "Admin", Role = "Admin", Service = "Admin"
            });
            if (disabledKeys != null)
            {
                foreach (var key in disabledKeys)
                {
                    ctx.AdminPermissionOverrides.Add(new AdminPermissionOverride
                    {
                        PermissionKey = key,
                        Enabled = false
                    });
                }
            }
            ctx.SaveChanges();
        }

        private static (Service svc, Utilisateur user) SeedServiceUser(
            AppDbContext ctx, string serviceCode, string permissionKey, bool permissionEnabled = true)
        {
            var svc = new Service { Nom = serviceCode, Code = serviceCode };
            ctx.RbacServices.Add(svc);
            ctx.SaveChanges();
            ctx.ServicePermissions.Add(new ServicePermission
            {
                ServiceId = svc.Id,
                PermissionKey = permissionKey,
                Enabled = permissionEnabled
            });
            var user = new Utilisateur
            {
                Login = serviceCode,
                Nom = serviceCode,
                Role = "User",
                Service = serviceCode,
                ServiceId = svc.Id
            };
            ctx.Utilisateurs.Add(user);
            ctx.SaveChanges();
            return (svc, user);
        }

        // ===========================================================
        //  Group 1: restaurer — enabled user passes, disabled user 403
        // ===========================================================

        [Fact]
        public async Task Restaurer_UserWithPermission_PassesThrough()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "archive", "restaurer");

            var context = HttpContextWithEndpoint(provider, "restaurer", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        [Fact]
        public async Task Restaurer_UserWithoutPermission_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "bureauordre", "restaurer", false);

            var context = HttpContextWithEndpoint(provider, "restaurer", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 2: voir_corbeille — enabled user passes, disabled 403
        // ===========================================================

        [Fact]
        public async Task VoirCorbeille_UserWithPermission_PassesThrough()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "archive", "voir_corbeille");

            var context = HttpContextWithEndpoint(provider, "voir_corbeille", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        [Fact]
        public async Task VoirCorbeille_UserWithoutPermission_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "bureauordre", "voir_corbeille", false);

            var context = HttpContextWithEndpoint(provider, "voir_corbeille", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 3: gerer_services — admin enabled, non-admin 403
        // ===========================================================

        [Fact]
        public async Task GererServices_AdminWithoutOverride_Allowed()
        {
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx);

            var context = HttpContextWithEndpoint(provider, "gerer_services", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        [Fact]
        public async Task GererServices_NonAdminWithoutPermission_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "bureauordre", "gerer_services", false);

            var context = HttpContextWithEndpoint(provider, "gerer_services", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 4: gerer_equipements — admin enabled, non-admin 403
        // ===========================================================

        [Fact]
        public async Task GererEquipements_AdminWithoutOverride_Allowed()
        {
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx);

            var context = HttpContextWithEndpoint(provider, "gerer_equipements", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
        }

        [Fact]
        public async Task GererEquipements_NonAdminWithoutPermission_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "bureauordre", "gerer_equipements", false);

            var context = HttpContextWithEndpoint(provider, "gerer_equipements", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 5: gerer_listes — admin enabled, non-admin 403
        // ===========================================================

        [Fact]
        public async Task GererListes_AdminWithoutOverride_Allowed()
        {
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx);

            var context = HttpContextWithEndpoint(provider, "gerer_listes", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
        }

        [Fact]
        public async Task GererListes_NonAdminWithoutPermission_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "bureauordre", "gerer_listes", false);

            var context = HttpContextWithEndpoint(provider, "gerer_listes", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 6: gerer_permissions — admin enabled, non-admin 403
        // ===========================================================

        [Fact]
        public async Task GererPermissions_AdminWithoutOverride_Allowed()
        {
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx);

            var context = HttpContextWithEndpoint(provider, "gerer_permissions", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
        }

        [Fact]
        public async Task GererPermissions_NonAdminWithoutPermission_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "bureauordre", "gerer_permissions", false);

            var context = HttpContextWithEndpoint(provider, "gerer_permissions", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 7: gerer_utilisateurs — admin enabled, non-admin 403
        // ===========================================================

        [Fact]
        public async Task GererUtilisateurs_AdminWithoutOverride_Allowed()
        {
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx);

            var context = HttpContextWithEndpoint(provider, "gerer_utilisateurs", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
        }

        [Fact]
        public async Task GererUtilisateurs_NonAdminWithoutPermission_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, "bureauordre", "gerer_utilisateurs", false);

            var context = HttpContextWithEndpoint(provider, "gerer_utilisateurs", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 8: Admin override semantics — correct per key
        // ===========================================================

        [Fact]
        public async Task AdminRestaurer_OverrideDisabled_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx, new[] { "restaurer" });

            var context = HttpContextWithEndpoint(provider, "restaurer", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        [Fact]
        public async Task AdminVoirCorbeille_NotInOverrides_Allowed()
        {
            // voir_corbeille is intentionally NOT in the 20-key override list
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx, new[] {
                "creer_modifier", "transferer", "supprimer", "restaurer", "archiver",
                "creer_courrier_admin", "creer_courrier_juridique",
                "accepter", "refuser", "voir_toutes",
                "etape_precedente", "etape_suivante", "ouvrir_dossier",
                "cloturer", "transferer_juridique", "retrait_archive",
                "recherche_avancee", "export_excel", "export_word", "ajouter_notes"
            });

            var context = HttpContextWithEndpoint(provider, "voir_corbeille", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        [Fact]
        public async Task AdminGererServices_NotInOverrides_Allowed()
        {
            // gerer_* permissions are NOT in the override list — admin keeps them
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx, new[] {
                "creer_modifier", "transferer", "supprimer", "restaurer", "archiver",
                "creer_courrier_admin", "creer_courrier_juridique",
                "accepter", "refuser", "voir_toutes",
                "etape_precedente", "etape_suivante", "ouvrir_dossier",
                "cloturer", "transferer_juridique", "retrait_archive",
                "recherche_avancee", "export_excel", "export_word", "ajouter_notes"
            });

            var context = HttpContextWithEndpoint(provider, "gerer_services", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 9: No auth at all → 401
        // ===========================================================

        [Theory]
        [InlineData("restaurer")]
        [InlineData("voir_corbeille")]
        [InlineData("gerer_services")]
        [InlineData("gerer_equipements")]
        [InlineData("gerer_listes")]
        [InlineData("gerer_permissions")]
        [InlineData("gerer_utilisateurs")]
        [InlineData("etape_precedente")]
        [InlineData("etape_suivante")]
        [InlineData("ouvrir_dossier")]
        [InlineData("cloturer")]
        public async Task NoAuth_AnyNewPermission_Returns401(string permission)
        {
            var (provider, _) = BuildProvider();
            var context = HttpContextWithEndpoint(provider, permission, null);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
        }

        // ===========================================================
        //  Group 10: Workflow step permissions (frontend-gated only,
        //  no backend [RequirePermission] yet, but middleware handles
        //  them correctly if enforcement is added)
        // ===========================================================

        [Theory]
        [InlineData("etape_precedente")]
        [InlineData("etape_suivante")]
        [InlineData("ouvrir_dossier")]
        [InlineData("cloturer")]
        public async Task WorkflowStep_AdminWithoutOverride_Allowed(string permission)
        {
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx);

            var context = HttpContextWithEndpoint(provider, permission, 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        [Theory]
        [InlineData("etape_precedente", "seances&procedures")]
        [InlineData("etape_suivante", "seances&procedures")]
        [InlineData("ouvrir_dossier", "fathmilafat")]
        [InlineData("cloturer", "archive")]
        public async Task WorkflowStep_UserWithPermission_PassesThrough(string permission, string serviceCode)
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, serviceCode, permission);

            var context = HttpContextWithEndpoint(provider, permission, 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        [Theory]
        [InlineData("etape_precedente", "secretarait")]
        [InlineData("etape_suivante", "secretarait")]
        [InlineData("ouvrir_dossier", "secretarait")]
        [InlineData("cloturer", "secretarait")]
        public async Task WorkflowStep_UserWithoutPermission_Returns403(string permission, string serviceCode)
        {
            var (provider, ctx) = BuildProvider();
            SeedServiceUser(ctx, serviceCode, permission, false);

            var context = HttpContextWithEndpoint(provider, permission, 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        // Admin with etape_* in override list → 403
        [Fact]
        public async Task AdminEtapeSuivante_OverrideDisabled_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            SeedAdminWithOverrides(ctx, new[] { "etape_suivante" });

            var context = HttpContextWithEndpoint(provider, "etape_suivante", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }
    }
}
