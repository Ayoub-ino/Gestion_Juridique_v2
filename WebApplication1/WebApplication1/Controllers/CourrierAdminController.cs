using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Helpers;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CourrierAdminController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly WebApplication1.Services.DocumentAccessService _accessService;

        public CourrierAdminController(AppDbContext context, WebApplication1.Services.DocumentAccessService accessService)
        {
            _context = context;
            _accessService = accessService;
        }

        // ========== 1. LISTER LES COURRIERS ADMIN ==========
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CourrierAdminListDto>>> GetAll()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(userIdStr, out var userId))
                return Unauthorized();

            var user = await _context.Utilisateurs.FindAsync(userId);
            var userService = user?.Service;

            var query = _context.CourriersAdministratifs.Where(c => !c.EstSupprime).AsQueryable();

            // If user has a specific service, show docs in their service OR docs they sent out
            // Admin, Greffier, Directeur, Consultant see everything
            var role = user?.Role ?? "";
            var isAdminLike = role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant";
            if (!string.IsNullOrEmpty(userService) && !isAdminLike)
            {
                var userServiceEnum = ServiceMapper.MapToServiceEnum(userService);
                var sentDocIds = await _context.Transactions
                    .Where(t => t.ServiceOrigine == userServiceEnum)
                    .Select(t => t.DocumentId)
                    .Distinct()
                    .ToListAsync();

                query = query.Where(c => c.ServiceActuel == userServiceEnum || sentDocIds.Contains(c.Id));
            }

            var courriers = await query
                .Include(c => c.Transactions)
                .OrderByDescending(c => c.DateCreation)
                .Select(c => new CourrierAdminListDto
                {
                    Id = c.Id,
                    NumeroOrdre = c.NumeroOrdre,
                    Expediteur = c.Expediteur,
                    Objet = c.Objet,
                    Sujet = c.Sujet,
                    DateCreation = c.DateCreation,
                    ServiceActuel = c.ServiceActuel.ToString(),
                    StatutActuel = c.StatutActuel.ToString(),
                    FilePath = c.FilePath,
                    Source = c.Expediteur,
                    NumeroReference = c.NumeroReference,
                    Transmissible = c.Transmissible,
                    DernierTransfert = c.Transactions
                        .OrderByDescending(t => t.DateTransaction)
                        .Select(t => (DateTime?)t.DateTransaction)
                        .FirstOrDefault() ?? c.DateCreation
                })
                .ToListAsync();

            return Ok(courriers);
        }

        // ========== 3. CRÉER UN COURRIER ==========
        [HttpPost]
        [RequirePermission("creer_courrier_admin")]
        public async Task<IActionResult> Create([FromBody] CourrierAdminDto dto)
        {
            try
            {
                if (dto == null)
                    return BadRequest(new { error = "Données invalides" });

                // Vérifier que le numéro d'ordre n'existe pas déjà
                var exists = await _context.CourriersAdministratifs
                    .AnyAsync(c => c.NumeroOrdre == dto.NumeroOrdre);

                if (exists)
                    return Conflict(new { error = "Ce numéro d'ordre existe déjà" });

                // ===== 1. CRÉATION DU COURRIER =====
                var courrier = new CourrierAdministratif
                {
                    NumeroOrdre = dto.NumeroOrdre,
                    Expediteur = dto.Expediteur,
                    Objet = dto.Objet,
                    DateReception = dto.DateReception ?? DateTime.Now,
                    TypeCircuit = dto.TypeCircuit ?? "standard",
                    FilePath = dto.FilePath,
                    NumeroReference = dto.NumeroReference ?? dto.NumeroOrdre,
                    Sujet = dto.Objet,
                    DateCreation = DateTime.Now,
                    ServiceActuel = ServiceTribunal.BureauOrdre,
                    StatutActuel = StatutDossier.Nouveau,
                    NumeroBureauOrdre = dto.NumeroOrdre,
                    Transmissible = dto.Transmissible
                };

                _context.CourriersAdministratifs.Add(courrier);
                await _context.SaveChangesAsync();

                // ===== 2. GESTION DU MODE DE TRAITEMENT =====
                if (dto.ModeTraitement == "archivage")
                {
                    courrier.ServiceActuel = ServiceTribunal.Archive;
                    courrier.StatutActuel = StatutDossier.Archive;

                    var transaction = new Transaction
                    {
                        DocumentId = courrier.Id,
                        ServiceOrigine = ServiceTribunal.BureauOrdre,
                        ServiceDestination = ServiceTribunal.Archive,
                        DateTransaction = DateTime.Now,
                        Remarques = "Archivage direct du courrier",
                        NomPersonneExterne = ""
                    };
                    _context.Transactions.Add(transaction);
                }
                else if (dto.ModeTraitement == "unique")
                {
                    if (string.IsNullOrEmpty(dto.ServiceDestinataire))
                        return BadRequest(new { error = "Le service destinataire est requis pour le mode 'unique'" });

                    if (!Enum.TryParse<ServiceTribunal>(dto.ServiceDestinataire, true, out var destService))
                        return BadRequest(new { error = $"Service '{dto.ServiceDestinataire}' invalide" });

                    courrier.ServiceActuel = destService;
                    courrier.StatutActuel = StatutDossier.EnCours;

                    var transaction = new Transaction
                    {
                        DocumentId = courrier.Id,
                        ServiceOrigine = ServiceTribunal.BureauOrdre,
                        ServiceDestination = destService,
                        DateTransaction = DateTime.Now,
                        Remarques = $"Transfert vers {destService}",
                        NomPersonneExterne = ""
                    };
                    _context.Transactions.Add(transaction);
                }
                else if (dto.ModeTraitement == "diffusion")
                {
                    if (dto.ServicesDiffusion == null || dto.ServicesDiffusion.Count == 0)
                        return BadRequest(new { error = "Au moins un service est requis pour la diffusion" });

                    courrier.ServiceActuel = ServiceTribunal.BureauOrdre;
                    courrier.StatutActuel = StatutDossier.EnCours;

                    foreach (var serviceName in dto.ServicesDiffusion)
                    {
                        if (!Enum.TryParse<ServiceTribunal>(serviceName, true, out var destService))
                            continue;

                        var transaction = new Transaction
                        {
                            DocumentId = courrier.Id,
                            ServiceOrigine = ServiceTribunal.BureauOrdre,
                            ServiceDestination = destService,
                            DateTransaction = DateTime.Now,
                            Remarques = $"Diffusion vers {destService}",
                            NomPersonneExterne = ""
                        };
                        _context.Transactions.Add(transaction);
                    }
                }

                await _context.SaveChangesAsync();

                // ── Auto-grant Owner access to creator's service ──
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (ServiceMapper.TryParseUserId(userIdStr, out var creatorUserId))
                {
                    var creatorUser = await _context.Utilisateurs.FindAsync(creatorUserId);
                    var creatorServiceCode = (creatorUser?.Service ?? "BureauOrdre").ToLowerInvariant();
                    await _accessService.GrantOwnerAsync(courrier.Id, creatorServiceCode, creatorUserId);
                }

                return CreatedAtAction(nameof(GetById), new { id = courrier.Id },
                    new { message = $"Courrier créé avec succès (Mode: {dto.ModeTraitement})", courrier });
            }
            catch (Exception ex)
            {
                // ⚠️ CAPTURER TOUTES LES ERREURS ET RENVOYER DU JSON
                return StatusCode(500, new { error = "Erreur interne du serveur", detail = ex.Message });
            }
        }
        // ========== 4. MODIFIER UN COURRIER ==========
        [HttpPut("{id}")]
        [RequirePermission("creer_courrier_admin")]
        public async Task<IActionResult> Update(int id, [FromBody] CourrierAdminDto dto)
        {
            var courrier = await _context.CourriersAdministratifs.FindAsync(id);
            if (courrier == null)
                return NotFound(new { message = "Courrier non trouvé" });

            // ── CUSTODY CHECK: only the current service holder can modify ──
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
            {
                if (!_accessService.IsUserCustodian(courrier, userId))
                    return StatusCode(403, new { error = "Vous n'êtes pas le détenteur actuel de ce courrier. Seul le service en charge peut le modifier." });
            }

            // Mise à jour des champs
            courrier.NumeroOrdre = dto.NumeroOrdre;
            courrier.Expediteur = dto.Expediteur;
            courrier.Objet = dto.Objet;
            courrier.DateReception = dto.DateReception ?? courrier.DateReception;
            courrier.TypeCircuit = dto.TypeCircuit ?? courrier.TypeCircuit;
            courrier.FilePath = dto.FilePath ?? courrier.FilePath;
            courrier.NumeroReference = dto.NumeroReference ?? courrier.NumeroReference;
            courrier.Sujet = dto.Objet;
            courrier.Transmissible = dto.Transmissible;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Courrier modifié avec succès", courrier });
        }

        // ========== 5. SUPPRIMER UN COURRIER (suppression logique) ==========
        [HttpDelete("{id}")]
        [RequirePermission("supprimer")]
        public async Task<IActionResult> Delete(int id)
        {
            var courrier = await _context.CourriersAdministratifs.FindAsync(id);
            if (courrier == null)
                return NotFound(new { message = "Courrier non trouvé" });

            // ── CUSTODY CHECK: only the current service holder can delete ──
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
            {
                if (!_accessService.IsUserCustodian(courrier, userId))
                    return StatusCode(403, new { error = "Vous n'êtes pas le détenteur actuel de ce courrier. Seul le service en charge peut le supprimer." });
            }

            courrier.EstSupprime = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Courrier supprimé avec succès" });
        }
        [HttpGet("{id}")]
        public async Task<ActionResult<CourrierAdminListDto>> GetById(int id)
        {
            var courrier = await _context.CourriersAdministratifs
                .Where(c => c.Id == id && !c.EstSupprime)
                .Select(c => new CourrierAdminListDto
                {
                    Id = c.Id,
                    NumeroOrdre = c.NumeroOrdre,
                    Expediteur = c.Expediteur,
                    Objet = c.Objet,
                    Sujet = c.Sujet,
                    DateCreation = c.DateCreation,
                    ServiceActuel = c.ServiceActuel.ToString(),
                    StatutActuel = c.StatutActuel.ToString(),
                    FilePath = c.FilePath,
                    Source = c.Expediteur,
                    NumeroReference = c.NumeroReference,
                    Transmissible = c.Transmissible,
                    DernierTransfert = c.Transactions
                        .OrderByDescending(t => t.DateTransaction)
                        .Select(t => (DateTime?)t.DateTransaction)
                        .FirstOrDefault() ?? c.DateCreation
                })
                .FirstOrDefaultAsync();

            if (courrier == null)
                return NotFound(new { message = "Courrier non trouvé" });

            return Ok(courrier);
        }
    }

    // ========== DTO ==========
    public class CourrierAdminListDto
    {
        public int Id { get; set; }
        public string NumeroOrdre { get; set; } = string.Empty;
        public string? Expediteur { get; set; }
        public string Objet { get; set; } = string.Empty;
        public string? Sujet { get; set; }
        public DateTime DateCreation { get; set; }
        public string? ServiceActuel { get; set; }
        public string? StatutActuel { get; set; }
        public string? FilePath { get; set; }
        public string? Source { get; set; }
        public string? NumeroReference { get; set; }
        public DateTime DernierTransfert { get; set; }
        public bool Transmissible { get; set; } = true;
    }
    public class CourrierAdminDto
    {
        [Required]
        public string NumeroOrdre { get; set; } = string.Empty;
        [Required]
        public string Expediteur { get; set; } = string.Empty;
        [Required]
        public string Objet { get; set; } = string.Empty;
        public DateTime? DateReception { get; set; }
        public string? TypeCircuit { get; set; }
        public string? FilePath { get; set; }
        public string? NumeroReference { get; set; }
        public bool Transmissible { get; set; } = true;

        // ===== NOUVEAUX CHAMPS POUR LES MODES =====
        public string? ModeTraitement { get; set; } // "archivage", "unique", "diffusion"
        public string? ServiceDestinataire { get; set; } // Pour "unique" (ex: "OuvertureDossier")
        public List<string>? ServicesDiffusion { get; set; } // Pour "diffusion" (ex: ["Service1", "Service2"])
    }
}