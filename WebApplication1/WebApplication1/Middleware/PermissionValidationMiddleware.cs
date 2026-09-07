using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Middleware
{
    /// <summary>
    /// Global permission enforcement middleware. Reads the [RequirePermission(...)]
    /// attribute from the matched endpoint metadata and validates it server-side
    /// via <see cref="PermissionValidationService"/>.
    /// </summary>
    public class PermissionValidationMiddleware
    {
        private readonly RequestDelegate _next;

        public PermissionValidationMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Read the [RequirePermission(...)] attribute from the matched endpoint metadata.
            // This replaces the old client-supplied ?permission= query string check,
            // which could be bypassed by simply omitting the query parameter.
            var endpoint = context.GetEndpoint();
            var permissionAttribute = endpoint?.Metadata.GetMetadata<RequirePermissionAttribute>();

            if (permissionAttribute != null)
            {
                var userIdStr = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new { error = "Non authentifié" });
                    return;
                }

                // Resolve from the request-scoped provider: the middleware instance itself
                // is constructed once with the ROOT provider, so resolving a scoped service
                // from the captured provider would throw (captive dependency).
                var permissionValidationService = context.RequestServices.GetRequiredService<PermissionValidationService>();
                var result = await permissionValidationService.ValidatePermissionAsync(userId, permissionAttribute.Permission, context);

                if (!result.IsAllowed)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new { error = result.Reason });
                    return;
                }
            }

            await _next(context);
        }
    }
}
