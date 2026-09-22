using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.DTO;
using WebApplication1.Helpers;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CourrierSortantController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly WebApplication1.Services.DocumentAccessService _accessService;
        private readonly WebApplication1.Services.SubstitutionService _substitutions;

        public CourrierSortantController(AppDbContext context, WebApplication1.Services.DocumentAccessService accessService, WebApplication1.Services.SubstitutionService substitutions)
        {
            _context = context;
            _accessService = accessService;
            _substitutions = substitutions;
        }

        [HttpPost]
        [RequirePermission("creer_modifier")]
        public async Task<IActionResult> Create([FromBody] SortantDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            try
            {
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!ServiceMapper.TryParseUserId(userIdStr, out var userId))
                    return Unauthorized();

                var user = await _context.Utilisateurs.FindAsync(userId);
                var creatorService = user?.Service ?? "BureauOrdre";
                var creatorServiceEnum = ServiceMapper.MapToServiceEnum(creatorService);
                var creatorServiceCode = ServiceMapper.NormalizeServiceCode(creatorService) is { Length: > 0 } code
                    ? code
                    : DocumentAccessService.ServiceTribunalToRbacCode(creatorServiceEnum);

                // N° de bureau — creator user id + year (system-assigned)
                var numeroBureauOrdre = $"{userId}/{DateTime.Now.Year}";

                // Vérifier l'unicité du numéro de référence dans TOUS les types de documents.
                // Outgoing mail carries no "Numéro interne" field, so when the client
                // omits it we derive a unique one from the N° de bureau
                // (e.g. "2/2026/3").
                var numeroRef = dto.Reference;
                if (string.IsNullOrWhiteSpace(numeroRef))
                {
                    var prefix = $"{numeroBureauOrdre}/";
                    var existing = await _context.CourriersSortants
                        .CountAsync(c => c.NumeroReference.StartsWith(prefix));
                    numeroRef = $"{prefix}{existing + 1}";
                }
                else
                {
                    var refExists = await _context.Documents
                        .AnyAsync(d => d.NumeroReference == numeroRef);
                    if (refExists)
                        return Conflict(new { error = "Ce numéro de référence existe déjà" });
                }

                var sortant = new CourrierSortant
                {
                    NumeroReference = numeroRef,
                    Sujet = dto.Objet ?? "Sans objet",
                    Objet = dto.Objet ?? "Sans objet",
                    DateCreation = DateTime.Now,
                    ServiceActuel = creatorServiceEnum,
                    ServiceActuelCode = creatorServiceCode,
                    StatutActuel = StatutDossier.Nouveau,
                    // N° de bureau — creator user id + year (system-assigned)
                    NumeroBureauOrdre = numeroBureauOrdre,
                    // Entrusted to the agent who created it (see Document.GestionnaireUserId).
                    GestionnaireUserId = userId,
                    DestinataireExterne = dto.Destinataire,
                    TypeSortant = dto.TypeSortant ?? "normal",
                    DateEnvoi = dto.DateEnvoi ?? DateTime.Now,
                    NumeroEnvoi = dto.NumeroEnvoi ?? numeroRef,
                    TribunalOrigine = dto.TribunalOrigine ?? "",
                    TribunalDestination = dto.TribunalDestination ?? "",
                    Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes
                };

                _context.CourriersSortants.Add(sortant);
                await _context.SaveChangesAsync();

                // ── Auto-grant Owner access to creator's service ──
                await _accessService.GrantOwnerAsync(sortant.Id, creatorServiceCode, userId);

                return Ok(new
                {
                    message = "Courrier sortant enregistré avec succès !",
                    id = sortant.Id,
                    sortant
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Erreur interne", detail = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // STRICT SERVICE SCOPING: users only see docs in their current service.
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var query = _context.CourriersSortants.Where(c => !c.EstSupprime).AsQueryable();

            if (ServiceMapper.TryParseUserId(userIdStr, out var userId))
            {
                var user = await _context.Utilisateurs.FindAsync(userId);
                var role = user?.Role ?? "";
                var isAdminLike = role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant";
                if (!isAdminLike && !string.IsNullOrEmpty(user?.Service))
                {
                    // Scope by the dynamic RBAC service code so services created from the
                    // admin panel work without code changes. Legacy rows (no code stored)
                    // still match through their ServiceTribunal enum value.
                    // The caller's own service, plus the folders entrusted to any
                    // agent they are substituting for — never a whole covered service.
                    query = query.Where(SubstitutionService.BuildScopePredicate<CourrierSortant>(
                        _substitutions.GetOwnServiceCode(userId),
                        _substitutions.GetOwnServiceEnum(userId),
                        _substitutions.GetCoveredUserIds(userId)));
                }
            }

            var sortants = await query
                .Select(c => new {
                    c.Id,
                    c.NumeroReference,
                    c.NumeroEnvoi,
                    c.Objet,
                    c.Sujet,
                    c.DateCreation,
                    c.ServiceActuel,
                    c.ServiceActuelCode,
                    c.StatutActuel,
                    c.DestinataireExterne,
                    c.TypeSortant,
                    c.DateEnvoi,
                    c.TribunalOrigine,
                    c.TribunalDestination,
                    c.Notes,
                    c.FilePath,
                    DernierTransfert = c.Transactions
                        .OrderByDescending(t => t.DateTransaction)
                        .Select(t => (DateTime?)t.DateTransaction)
                        .FirstOrDefault() ?? c.DateCreation
                })
                .OrderByDescending(c => c.DateCreation)
                .ToListAsync();
            return Ok(sortants);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var sortant = await _context.CourriersSortants
                .FirstOrDefaultAsync(c => c.Id == id);
            if (sortant == null)
                return NotFound(new { error = "Courrier sortant non trouvé" });
            return Ok(sortant);
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateStatut(int id, [FromBody] UpdateStatutDto dto)
        {
            try
            {
                var sortant = await _context.CourriersSortants.FindAsync(id);
                if (sortant == null)
                    return NotFound(new { error = "Courrier sortant non trouvé" });

                // ── CUSTODY CHECK: only the current service holder can modify ──
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
                {
                    if (!_accessService.IsUserCustodian(sortant, userId))
                        return StatusCode(403, new { error = "Vous n'êtes pas le détenteur actuel de ce courrier. Seul le service en charge peut le modifier." });
                }

                // Mapper le statut reçu (string) vers l'enum StatutDossier
                switch (dto.Statut)
                {
                    case "Brouillon":
                        sortant.StatutActuel = StatutDossier.Nouveau;
                        break;
                    case "EnAttente":
                        sortant.StatutActuel = StatutDossier.EnCours;
                        break;
                    case "Envoye":
                        sortant.StatutActuel = StatutDossier.Cloture;
                        break;
                    case "Annule":
                        sortant.StatutActuel = StatutDossier.Archive;
                        break;
                    default:
                        return BadRequest(new { error = "Statut invalide" });
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = "Statut mis à jour avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Erreur interne", detail = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [RequirePermission("supprimer")]
        public async Task<IActionResult> Delete(int id)
        {
            var sortant = await _context.CourriersSortants.FindAsync(id);
            if (sortant == null)
                return NotFound(new { error = "Courrier sortant non trouvé" });

            // ── CUSTODY CHECK: only the current service holder can delete ──
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
            {
                if (!_accessService.IsUserCustodian(sortant, userId))
                    return StatusCode(403, new { error = "Vous n'êtes pas le détenteur actuel de ce courrier. Seul le service en charge peut le supprimer." });
            }

            sortant.EstSupprime = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Courrier sortant supprimé (suppression logique)" });
        }
        public class UpdateStatutDto
        {
            public string Statut { get; set; } = string.Empty;
        }



    }
}