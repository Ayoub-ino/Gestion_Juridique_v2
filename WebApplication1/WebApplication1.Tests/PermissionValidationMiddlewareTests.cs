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
    public class PermissionValidationMiddlewareTests
    {
        private static (IServiceProvider provider, AppDbContext ctx) BuildProvider()
        {
            var services = new ServiceCollection();
            services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
            services.AddScoped<PermissionService>();
            services.AddScoped<PermissionValidationService>();
            var provider = services.BuildServiceProvider();
            var ctx = provider.GetRequiredService<AppDbContext>();
            return (provider, ctx);
        }

        private static DefaultHttpContext HttpContextWithEndpoint(IServiceProvider provider, string? permission, int? userId)
        {
            var context = new DefaultHttpContext();
            context.RequestServices = provider;
            var metadata = permission == null
                ? new EndpointMetadataCollection()
                : new EndpointMetadataCollection(new RequirePermissionAttribute(permission));
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

        [Fact]
        public async Task InvokeAsync_NoRequirePermissionAttribute_PassesThrough()
        {
            var (provider, _) = BuildProvider();
            var context = HttpContextWithEndpoint(provider, null, 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }

        [Fact]
        public async Task InvokeAsync_RequiresPermission_NoAuth_Returns401()
        {
            var (provider, _) = BuildProvider();
            var context = HttpContextWithEndpoint(provider, "transferer", null);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
        }

        [Fact]
        public async Task InvokeAsync_RequiresPermission_UserWithoutPermission_Returns403()
        {
            var (provider, ctx) = BuildProvider();
            ctx.Utilisateurs.Add(new Utilisateur { Login = "u1", Nom = "Agent", Role = "User", Service = "archive", ServiceId = null });
            ctx.SaveChanges();

            var context = HttpContextWithEndpoint(provider, "transferer", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.False(flag.Called);
            Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        }

        [Fact]
        public async Task InvokeAsync_RequiresPermission_UserWithPermission_PassesThrough()
        {
            var (provider, ctx) = BuildProvider();
            var svc = new Service { Nom = "Bureau ordre", Code = "bureauordre" };
            ctx.RbacServices.Add(svc);
            ctx.SaveChanges();
            ctx.ServicePermissions.Add(new ServicePermission { ServiceId = svc.Id, PermissionKey = "transferer", Enabled = true });
            ctx.Utilisateurs.Add(new Utilisateur { Login = "bureauordre", Nom = "Agent", Role = "User", Service = "bureauordre", ServiceId = svc.Id });
            ctx.SaveChanges();

            var context = HttpContextWithEndpoint(provider, "transferer", 1);
            var (middleware, flag) = CreateMiddleware();

            await middleware.InvokeAsync(context);

            Assert.True(flag.Called);
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        }
    }
}
