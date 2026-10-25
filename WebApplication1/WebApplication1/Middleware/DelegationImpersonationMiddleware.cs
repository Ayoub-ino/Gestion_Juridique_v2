using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;

namespace WebApplication1.Middleware
{
    /// <summary>
    /// Lets an accepted substitute work *as* the agent they replace.
    ///
    /// While a workspace session is open the client sends
    /// <see cref="DelegationConstants.HeaderName"/> naming the replaced agent. When
    /// a valid, accepted, in-period delegation exists for the caller, the principal
    /// is swapped for that agent's BEFORE the permission middleware and the
    /// controllers run — so every endpoint, listing, permission check and
    /// notification resolves exactly as if the replaced agent had signed in, with
    /// no per-endpoint special case. The real caller's id travels on as a claim so
    /// the substitution trace can still name the person who acted.
    ///
    /// With no header the middleware is a pass-through, so nothing about ordinary
    /// requests changes.
    /// </summary>
    public class DelegationImpersonationMiddleware
    {
        private readonly RequestDelegate _next;

        public DelegationImpersonationMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, AppDbContext db)
        {
            if (!context.Request.Headers.TryGetValue(DelegationConstants.HeaderName, out var raw)
                || !int.TryParse(raw.ToString(), out var absentUserId))
            {
                await _next(context);
                return;
            }

            var callerIdStr = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(callerIdStr, out var callerId))
            {
                await RejectAsync(context, StatusCodes.Status401Unauthorized, "Authentification requise.");
                return;
            }

            var now = DateTime.Now;
            var delegation = await db.Substitutes
                .Where(s => s.UserId == absentUserId
                            && s.SubstituteUserId == callerId
                            && s.Statut == SubstitutionStatusConstants.Accepte
                            && s.IsActive)
                .OrderByDescending(s => s.DateAssignation)
                .FirstOrDefaultAsync();

            if (delegation == null || delegation.DateDebut > now
                || (delegation.DateFin.HasValue && delegation.DateFin.Value < now))
            {
                await RejectAsync(context, StatusCodes.Status403Forbidden,
                    "Aucune délégation active ne vous autorise à travailler sur ce compte.");
                return;
            }

            // Swap the principal. The role claim is dropped on purpose: every
            // authorization path here resolves from the user id against the
            // database, so the replaced agent's own permissions apply.
            var identity = new ClaimsIdentity(
                new List<Claim>
                {
                    new(ClaimTypes.NameIdentifier, absentUserId.ToString()),
                    new(DelegationConstants.OriginalUserClaim, callerId.ToString()),
                    new(DelegationConstants.DelegationIdClaim, delegation.Id.ToString())
                },
                context.User.Identity?.AuthenticationType ?? "Bearer");

            context.User = new ClaimsPrincipal(identity);

            await _next(context);
        }

        private static async Task RejectAsync(HttpContext context, int status, string message)
        {
            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = message });
        }
    }
}
