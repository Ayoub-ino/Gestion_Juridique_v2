using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Absence delegations ("remplaçant") managed from Mon profil.
    /// A user manages their <b>own</b> substitute by default; acting on someone
    /// else's delegation requires the gerer_substituts permission. Revocation closes
    /// the active delegation and stamps the date, so the register always shows who
    /// covered whom, from when to when.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SubstitutesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PermissionService _permissionService;

        public SubstitutesController(AppDbContext context, PermissionService permissionService)
        {
            _context = context;
            _permissionService = permissionService;
        }

        // ============ QUERIES ============

        /// <summary>Active delegation of the given agent (if any).</summary>
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUserId(int userId)
        {
            var sub = await _context.Substitutes
                .Where(s => s.UserId == userId && s.IsActive)
                .Select(s => new {
                    s.Id,
                    s.UserId,
                    s.SubstituteUserId,
                    SubstituteUserName = _context.Utilisateurs
                        .Where(u => u.Id == s.SubstituteUserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    s.DateAssignation,
                    s.DateRevocation,
                    s.IsActive
                })
                .ToListAsync();
            return Ok(sub);
        }

        /// <summary>Full delegation history of the given agent, most recent first.</summary>
        [HttpGet("history/{userId}")]
        public async Task<IActionResult> GetHistory(int userId)
        {
            var history = await _context.Substitutes
                .Where(s => s.UserId == userId)
                .Select(s => new {
                    s.Id,
                    s.UserId,
                    s.SubstituteUserId,
                    SubstituteUserName = _context.Utilisateurs
                        .Where(u => u.Id == s.SubstituteUserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    s.DateAssignation,
                    s.DateRevocation,
                    s.IsActive
                })
                .OrderByDescending(s => s.DateAssignation)
                .ToListAsync();
            return Ok(history);
        }

        /// <summary>
        /// Delegations this user is currently covering, so the profile can tell the
        /// substitute whose folders they are handling.
        /// </summary>
        [HttpGet("covering/{userId}")]
        public async Task<IActionResult> GetCovering(int userId)
        {
            var covering = await _context.Substitutes
                .Where(s => s.SubstituteUserId == userId && s.IsActive)
                .Select(s => new {
                    s.Id,
                    AbsentUserId = s.UserId,
                    AbsentUserName = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    s.DateAssignation
                })
                .OrderByDescending(s => s.DateAssignation)
                .ToListAsync();
            return Ok(covering);
        }

        /// <summary>
        /// Audit trail: who acted in place of whom. A user sees their own trace
        /// (both the actions they performed for others and those performed for them);
        /// gerer_substituts unlocks everyone's.
        /// </summary>
        [HttpGet("actions/{userId}")]
        public async Task<IActionResult> GetActions(int userId)
        {
            if (!await CanManageAsync(userId))
                return StatusCode(403, new { error = "Accès refusé à la trace des substitutions." });

            var actions = await _context.SubstitutionActions
                .Where(a => a.EffectueParUserId == userId || a.PourUserId == userId)
                .OrderByDescending(a => a.DateAction)
                .Select(a => new {
                    a.Id,
                    a.EffectueParUserId,
                    EffectueParNom = _context.Utilisateurs
                        .Where(u => u.Id == a.EffectueParUserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    a.PourUserId,
                    PourNom = _context.Utilisateurs
                        .Where(u => u.Id == a.PourUserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    a.Action,
                    a.DocumentId,
                    a.Reference,
                    a.DateAction
                })
                .ToListAsync();

            return Ok(actions);
        }

        // ============ COMMANDS ============

        /// <summary>
        /// Designate a substitute for an agent. Any previous active delegation of
        /// that agent is closed first, so there is never more than one active
        /// substitute at a time.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SubstituteDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var callerIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(callerIdStr, out var callerId))
                return Unauthorized();

            // Default to the caller's own delegation (self-service from Mon profil).
            var targetUserId = dto.UserId > 0 ? dto.UserId : callerId;
            if (targetUserId != callerId && !await HasPermissionAsync(callerId, "gerer_substituts"))
                return StatusCode(403, new { error = "Vous ne pouvez gérer que votre propre remplaçant." });

            if (dto.SubstituteUserId <= 0)
                return BadRequest(new { error = "Veuillez choisir un remplaçant." });

            if (dto.SubstituteUserId == targetUserId)
                return BadRequest(new { error = "Un agent ne peut pas être son propre remplaçant." });

            var now = DateTime.Now;

            var substituteUser = await _context.Utilisateurs.FindAsync(dto.SubstituteUserId);
            if (substituteUser == null)
                return NotFound(new { error = "Remplaçant introuvable." });
            if (!substituteUser.IsActive)
                return BadRequest(new { error = "Le remplaçant choisi n'est pas un compte actif." });

            // Close whatever delegation was already running for this agent.
            var previous = await _context.Substitutes
                .Where(s => s.UserId == targetUserId && s.IsActive)
                .ToListAsync();
            foreach (var p in previous)
            {
                p.IsActive = false;
                p.DateRevocation = now;
            }

            _context.Substitutes.Add(new Substitute
            {
                UserId = targetUserId,
                SubstituteUserId = dto.SubstituteUserId,
                DateAssignation = now,
                IsActive = true
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Remplaçant défini avec succès" });
        }

        /// <summary>Revoke a delegation: closes it and stamps the revocation date.</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var callerIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(callerIdStr, out var callerId))
                return Unauthorized();

            var sub = await _context.Substitutes.FindAsync(id);
            if (sub == null)
                return NotFound(new { message = "Substitution non trouvée" });

            // The agent concerned can close their own delegation, or an administrator.
            var isOwner = sub.UserId == callerId || sub.SubstituteUserId == callerId;
            if (!isOwner && !await HasPermissionAsync(callerId, "gerer_substituts"))
                return StatusCode(403, new { error = "Vous ne pouvez pas révoquer cette substitution." });

            if (!sub.IsActive)
                return BadRequest(new { message = "Cette substitution est déjà close" });

            sub.IsActive = false;
            sub.DateRevocation = DateTime.Now;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Remplaçant annulé avec succès" });
        }

        // ============ HELPERS ============

        private async Task<bool> HasPermissionAsync(int userId, string permissionKey)
        {
            var permissions = await _permissionService.GetUserPermissionsAsync(userId);
            return permissions.Contains(permissionKey);
        }

        /// <summary>The caller may see the given user's trace when it is their own
        /// or when they administer substitutions.</summary>
        private async Task<bool> CanManageAsync(int userId)
        {
            var callerIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(callerIdStr, out var callerId))
                return false;

            if (callerId == userId) return true;
            return await HasPermissionAsync(callerId, "gerer_substituts");
        }
    }

    public class SubstituteDto
    {
        public int UserId { get; set; }
        public int SubstituteUserId { get; set; }
    }
}
