using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
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
    /// Absence delegations (« Mon profil » → remplaçant).
    ///
    /// The flow is a handshake, not a switch: the absent agent names a colleague for
    /// a bounded period, the colleague is notified and must ACCEPT, and only then
    /// does the replacement workspace open — a tab where the substitute works as
    /// that agent, with their folders, their permissions and their notifications.
    /// The absent agent can stop it at any time; so can the period running out.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SubstitutesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PermissionService _permissionService;
        private readonly SubstitutionService _substitutions;

        public SubstitutesController(
            AppDbContext context,
            PermissionService permissionService,
            SubstitutionService substitutions)
        {
            _context = context;
            _permissionService = permissionService;
            _substitutions = substitutions;
        }

        // ============ QUERIES ============

        /// <summary>Active delegation of the given agent, if any.</summary>
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUserId(int userId)
        {
            await _substitutions.ExpireElapsedDelegationsAsync();
            var sub = await Project(_context.Substitutes.Where(s => s.UserId == userId && s.IsActive))
                .ToListAsync();
            return Ok(sub);
        }

        /// <summary>
        /// The user's delegation history, in both directions: the agents they were
        /// replaced by, and the agents they replaced. Both sides keep the record of
        /// who covered whom, for how long, and how it ended.
        /// </summary>
        [HttpGet("history/{userId}")]
        public async Task<IActionResult> GetHistory(int userId)
        {
            await _substitutions.ExpireElapsedDelegationsAsync();

            var rows = await Project(_context.Substitutes
                    .Where(s => s.UserId == userId || s.SubstituteUserId == userId))
                .ToListAsync();

            var withRole = rows.Select(r =>
            {
                var isAbsent = r.UserId == userId;
                return new
                {
                    r.Id,
                    r.UserId,
                    r.SubstituteUserId,
                    r.SubstituteUserName,
                    r.AbsentUserName,
                    r.DateAssignation,
                    r.DateDebut,
                    r.DateFin,
                    r.DateRevocation,
                    r.DateAcceptation,
                    r.Statut,
                    r.StatutLabel,
                    r.MotifRefus,
                    r.IsActive,
                    // Whose side of the delegation this row is, for the current user.
                    Role = isAbsent ? "absent" : "substitute"
                };
            })
            .OrderByDescending(r => r.DateAssignation)
            .ToList();

            return Ok(withRole);
        }

        /// <summary>
        /// Delegations the user covers — pending invitations as well as the ones
        /// already running, so the profile can show both.
        /// </summary>
        [HttpGet("covering/{userId}")]
        public async Task<IActionResult> GetCovering(int userId)
        {
            await _substitutions.ExpireElapsedDelegationsAsync();

            var covering = await _context.Substitutes
                .Where(s => s.SubstituteUserId == userId
                            && (s.IsActive || s.Statut == SubstitutionStatusConstants.EnAttente))
                .OrderByDescending(s => s.DateAssignation)
                .Select(s => new
                {
                    s.Id,
                    AbsentUserId = s.UserId,
                    AbsentUserName = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    AbsentUserService = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Service)
                        .FirstOrDefault(),
                    s.DateAssignation,
                    s.DateDebut,
                    s.DateFin,
                    s.Statut,
                    s.IsActive
                })
                .ToListAsync();
            return Ok(covering);
        }

        /// <summary>Invitations awaiting this user's answer — rendered as notifications.</summary>
        [HttpGet("invitations/{userId}")]
        public async Task<IActionResult> GetInvitations(int userId)
        {
            var invitations = await _context.Substitutes
                .Where(s => s.SubstituteUserId == userId
                            && s.Statut == SubstitutionStatusConstants.EnAttente)
                .OrderByDescending(s => s.DateAssignation)
                .Select(s => new
                {
                    s.Id,
                    AbsentUserId = s.UserId,
                    AbsentUserName = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    AbsentUserService = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Service)
                        .FirstOrDefault(),
                    s.DateAssignation,
                    s.DateDebut,
                    s.DateFin
                })
                .ToListAsync();
            return Ok(invitations);
        }

        /// <summary>Badge count for the sidebar (folder requests + delegation invitations).</summary>
        [HttpGet("invitation-count/{userId}")]
        public async Task<IActionResult> GetInvitationCount(int userId)
        {
            var count = await _context.Substitutes
                .CountAsync(s => s.SubstituteUserId == userId
                                 && s.Statut == SubstitutionStatusConstants.EnAttente);
            return Ok(new { count });
        }

        /// <summary>
        /// Replacement workspaces this user may open: accepted, running delegations.
        /// This is what puts the workspace tab in the sidebar.
        /// </summary>
        [HttpGet("workspaces/{userId}")]
        public async Task<IActionResult> GetWorkspaces(int userId)
        {
            await _substitutions.ExpireElapsedDelegationsAsync();

            var workspaces = await _context.Substitutes
                .Where(s => s.SubstituteUserId == userId && s.IsActive)
                .Where(s => s.DateFin == null || s.DateFin > DateTime.Now)
                .OrderByDescending(s => s.DateAssignation)
                .Select(s => new
                {
                    s.Id,
                    AbsentUserId = s.UserId,
                    AbsentUserName = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    AbsentUserLogin = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Login)
                        .FirstOrDefault(),
                    AbsentUserRole = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Role)
                        .FirstOrDefault(),
                    AbsentUserService = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => u.Service)
                        .FirstOrDefault(),
                    AbsentUserServiceId = _context.Utilisateurs
                        .Where(u => u.Id == s.UserId)
                        .Select(u => (int?)u.ServiceId)
                        .FirstOrDefault(),
                    s.DateDebut,
                    s.DateFin,
                    s.DateAcceptation
                })
                .ToListAsync();

            return Ok(workspaces);
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
        /// Name a substitute for a bounded period. The colleague must be a specific
        /// active account and the end of the period is mandatory; the delegation
        /// starts as an invitation the colleague has to accept.
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

            if (!dto.DateFin.HasValue)
                return BadRequest(new { error = "Veuillez indiquer la fin de la période de remplacement." });

            if (dto.SubstituteUserId == targetUserId)
                return BadRequest(new { error = "Un agent ne peut pas être son propre remplaçant." });

            var now = DateTime.Now;
            var debut = dto.DateDebut ?? now;

            if (dto.DateFin.Value <= debut)
                return BadRequest(new { error = "La fin de la période doit être postérieure à son début." });

            var substituteUser = await _context.Utilisateurs.FindAsync(dto.SubstituteUserId);
            if (substituteUser == null)
                return NotFound(new { error = "Remplaçant introuvable." });
            if (!substituteUser.IsActive)
                return BadRequest(new { error = "Le remplaçant choisi n'est pas un compte actif." });

            // Close whatever delegation was already running for this agent.
            var previous = await _context.Substitutes
                .Where(s => s.UserId == targetUserId
                            && (s.IsActive || s.Statut == SubstitutionStatusConstants.EnAttente))
                .ToListAsync();
            foreach (var p in previous)
            {
                p.IsActive = false;
                p.Statut = SubstitutionStatusConstants.Revoque;
                p.DateRevocation ??= now;
            }

            _context.Substitutes.Add(new Substitute
            {
                UserId = targetUserId,
                SubstituteUserId = dto.SubstituteUserId,
                DateAssignation = now,
                DateDebut = debut,
                DateFin = dto.DateFin.Value,
                Statut = SubstitutionStatusConstants.EnAttente,
                IsActive = false
            });

            await _context.SaveChangesAsync();
            return StatusCode(201, new
            {
                message = "Invitation envoyée au remplaçant. Le remplacement commencera dès qu'il l'aura acceptée."
            });
        }

        /// <summary>
        /// The named colleague accepts: the delegation starts, and the replacement
        /// workspace opens for them.
        /// </summary>
        [HttpPost("{id}/accepter")]
        public async Task<IActionResult> Accept(int id)
        {
            var callerIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(callerIdStr, out var callerId))
                return Unauthorized();

            var sub = await _context.Substitutes.FindAsync(id);
            if (sub == null)
                return NotFound(new { error = "Invitation introuvable." });

            // Only the invited colleague can accept, and only for themselves.
            if (sub.SubstituteUserId != callerId)
                return StatusCode(403, new { error = "Cette invitation ne vous est pas destinée." });

            if (sub.Statut != SubstitutionStatusConstants.EnAttente)
                return BadRequest(new { error = "Cette invitation a déjà été traitée." });

            var now = DateTime.Now;
            if (sub.DateFin.HasValue && sub.DateFin.Value < now)
            {
                sub.Statut = SubstitutionStatusConstants.Termine;
                await _context.SaveChangesAsync();
                return BadRequest(new { error = "La période de remplacement est déjà écoulée." });
            }

            sub.Statut = SubstitutionStatusConstants.Accepte;
            sub.DateAcceptation = now;
            // Start of the period was agreed when the invitation was sent; a
            // submission after that date simply starts now.
            if (sub.DateDebut < now) sub.DateDebut = now;
            sub.IsActive = true;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Remplacement accepté. Votre espace de remplacement est ouvert." });
        }

        /// <summary>The named colleague declines, with a reason for the absent agent.</summary>
        [HttpPost("{id}/refuser")]
        public async Task<IActionResult> Refuse(int id, [FromBody] SubstitutionDecisionDto? dto)
        {
            var callerIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(callerIdStr, out var callerId))
                return Unauthorized();

            var sub = await _context.Substitutes.FindAsync(id);
            if (sub == null)
                return NotFound(new { error = "Invitation introuvable." });

            if (sub.SubstituteUserId != callerId)
                return StatusCode(403, new { error = "Cette invitation ne vous est pas destinée." });

            if (sub.Statut != SubstitutionStatusConstants.EnAttente)
                return BadRequest(new { error = "Cette invitation a déjà été traitée." });

            sub.Statut = SubstitutionStatusConstants.Refuse;
            sub.IsActive = false;
            sub.DateRevocation = DateTime.Now;
            sub.MotifRefus = string.IsNullOrWhiteSpace(dto?.Motif) ? null : dto!.Motif!.Trim();

            await _context.SaveChangesAsync();
            return Ok(new { message = "Invitation refusée." });
        }

        /// <summary>
        /// The absent agent stops the replacement — before or after acceptance.
        /// The substitute immediately loses the workspace.
        /// </summary>
        [HttpPost("{id}/terminer")]
        public async Task<IActionResult> Terminate(int id)
        {
            var callerIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(callerIdStr, out var callerId))
                return Unauthorized();

            var sub = await _context.Substitutes.FindAsync(id);
            if (sub == null)
                return NotFound(new { message = "Substitution non trouvée" });

            // The agent concerned can stop their own delegation; an administrator can too.
            if (sub.UserId != callerId && !await HasPermissionAsync(callerId, "gerer_substituts"))
                return StatusCode(403, new { error = "Vous ne pouvez pas arrêter cette substitution." });

            if (!sub.IsActive && sub.Statut != SubstitutionStatusConstants.EnAttente)
                return BadRequest(new { message = "Cette substitution est déjà close" });

            sub.IsActive = false;
            sub.Statut = SubstitutionStatusConstants.Revoque;
            sub.DateRevocation = DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Remplacement arrêté. Le remplaçant n'a plus accès à votre espace." });
        }

        /// <summary>Legacy alias of <see cref="Terminate"/> — keeps older clients working.</summary>
        [HttpDelete("{id}")]
        public Task<IActionResult> Delete(int id) => Terminate(id);

        // ============ HELPERS ============

        /// <summary>
        /// One projection for every read, so the label shown in the history comes
        /// from one place and cannot drift between endpoints.
        /// </summary>
        private IQueryable<SubstituteView> Project(IQueryable<Substitute> query) =>
            query.Select(s => new SubstituteView
            {
                Id = s.Id,
                UserId = s.UserId,
                SubstituteUserId = s.SubstituteUserId,
                SubstituteUserName = _context.Utilisateurs
                    .Where(u => u.Id == s.SubstituteUserId)
                    .Select(u => u.Nom)
                    .FirstOrDefault(),
                AbsentUserName = _context.Utilisateurs
                    .Where(u => u.Id == s.UserId)
                    .Select(u => u.Nom)
                    .FirstOrDefault(),
                DateAssignation = s.DateAssignation,
                DateDebut = s.DateDebut,
                DateFin = s.DateFin,
                DateRevocation = s.DateRevocation,
                DateAcceptation = s.DateAcceptation,
                Statut = s.Statut,
                MotifRefus = s.MotifRefus,
                IsActive = s.IsActive
            });

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

    /// <summary>Row shape shared by the delegation listings.</summary>
    public class SubstituteView
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int SubstituteUserId { get; set; }
        public string? SubstituteUserName { get; set; }
        public string? AbsentUserName { get; set; }
        public DateTime DateAssignation { get; set; }
        public DateTime DateDebut { get; set; }
        public DateTime? DateFin { get; set; }
        public DateTime? DateRevocation { get; set; }
        public DateTime? DateAcceptation { get; set; }
        public string Statut { get; set; } = string.Empty;
        public string? MotifRefus { get; set; }
        public bool IsActive { get; set; }

        /// <summary>Label of <see cref="Statut"/>, so the UI shows the same text as the API.</summary>
        public string StatutLabel =>
            SubstitutionStatusConstants.LabelsFr.TryGetValue(Statut, out var label) ? label : Statut;
    }

    public class SubstituteDto
    {
        public int UserId { get; set; }
        public int SubstituteUserId { get; set; }
        /// <summary>Start of the period; now when omitted.</summary>
        public DateTime? DateDebut { get; set; }
        /// <summary>End of the period — mandatory.</summary>
        public DateTime? DateFin { get; set; }
    }

    public class SubstitutionDecisionDto
    {
        public string? Motif { get; set; }
    }
}
