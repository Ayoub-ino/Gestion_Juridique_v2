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
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CourrierAdminController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly DocumentAccessService _accessService;
        private readonly ServiceCatalog _serviceCatalog;

        public CourrierAdminController(AppDbContext context, DocumentAccessService accessService, ServiceCatalog serviceCatalog)
        {
            _context = context;
            _accessService = accessService;
            _serviceCatalog = serviceCatalog;
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

            // STRICT SERVICE SCOPING: users only see docs in their current service.
            // Admin, Greffier, Directeur, Consultant see everything.
            var role = user?.Role ?? "";
            var isAdminLike = role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant";
            if (!string.IsNullOrEmpty(userService) && !isAdminLike)
            {
                // Scope by the dynamic RBAC service code so services created from the
                // admin panel work without code changes. Legacy rows (no code stored)
                // still match through their ServiceTribunal enum value.
                var userServiceCode = ServiceMapper.NormalizeServiceCode(userService);
                var hasLegacyEnum = ServiceMapper.TryMapToServiceEnum(userService, out var userServiceEnum);
                query = hasLegacyEnum
                    ? query.Where(c => c.ServiceActuelCode == userServiceCode
                        || (c.ServiceActuelCode == null && c.ServiceActuel == userServiceEnum))
                    : query.Where(c => c.ServiceActuelCode == userServiceCode);
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
                    ServiceActuelCode = c.ServiceActuelCode,
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

                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!ServiceMapper.TryParseUserId(userIdStr, out var creatorUserId))
                    return Unauthorized();

                // ── System-assigned N° de bureau: creator user id + year ──
                // Enables several distinct users inside the same service.
                var numeroBureauOrdre = $"{creatorUserId}/{DateTime.Now.Year}";

                // "Numéro interne" = the unique identification number of the folder.
                // `NumeroOrdre` is accepted as a legacy alias for older payloads.
                var numeroRef = !string.IsNullOrWhiteSpace(dto.NumeroReference)
                    ? dto.NumeroReference
                    : dto.NumeroOrdre;
                if (string.IsNullOrWhiteSpace(numeroRef))
                    return BadRequest(new { error = "Le numéro de référence est requis" });

                // Vérifier l'unicité du numéro de référence dans TOUS les types de documents
                var refExists = await _context.Documents
                    .AnyAsync(d => d.NumeroReference == numeroRef);
                if (refExists)
                    return Conflict(new { error = "Ce numéro de référence existe déjà" });

                // ── The folder belongs to its CREATOR's service ──
                // Resolved from the live user row so services created from the admin
                // panel work too. This is what makes the folder appear in the SENDER's
                // Mes dossiers / Courriers Entrants first.
                var creatorUser = await _context.Utilisateurs.FindAsync(creatorUserId);
                var creatorServiceCode = ServiceMapper.NormalizeServiceCode(creatorUser?.Service) is { Length: > 0 } creatorCode
                    ? creatorCode
                    : "bureauordre";
                var creatorServiceEnum = ServiceMapper.MapToServiceEnum(creatorServiceCode);

                // ===== 1. CRÉATION DU COURRIER =====
                var courrier = new CourrierAdministratif
                {
                    NumeroOrdre = numeroBureauOrdre,
                    // Provenance is no longer captured: the Source dropdown is the
                    // originating entity of the courrier.
                    Expediteur = dto.Expediteur ?? dto.Source ?? string.Empty,
                    Objet = dto.Objet,
                    DateReception = dto.DateArrivee ?? dto.DateReception ?? DateTime.Now,
                    TypeCircuit = dto.TypeCircuit ?? "standard",
                    FilePath = dto.FilePath,
                    NumeroReference = numeroRef,
                    Sujet = dto.Objet,
                    DateCreation = DateTime.Now,
                    ServiceActuel = creatorServiceEnum,
                    ServiceActuelCode = creatorServiceCode,
                    StatutActuel = StatutDossier.Nouveau,
                    NumeroBureauOrdre = numeroBureauOrdre,
                    Transmissible = dto.Transmissible,
                    Source = dto.Source,
                    DateMessage = dto.DateMessage,
                    Etat = dto.Etat,
                    Notes = dto.Notes
                };

                _context.CourriersAdministratifs.Add(courrier);
                await _context.SaveChangesAsync();

                // ===== 2. GESTION DU MODE DE TRAITEMENT =====
                if (dto.ModeTraitement == "archivage")
                {
                    // "Archivage Direct" is a deliberate, immediate filing — there is no
                    // recipient to answer it — so the folder really does move here and
                    // the movement is recorded as completed (never as a pending request,
                    // which would otherwise show up in the archive service's inbox).
                    courrier.ServiceActuel = ServiceTribunal.Archive;
                    courrier.ServiceActuelCode = DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.Archive);
                    courrier.StatutActuel = StatutDossier.Archive;

                    var transaction = new Transaction
                    {
                        DocumentId = courrier.Id,
                        ServiceOrigine = creatorServiceEnum,
                        ServiceOrigineCode = creatorServiceCode,
                        ServiceDestination = ServiceTribunal.Archive,
                        ServiceDestinationCode = DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.Archive),
                        DateTransaction = DateTime.Now,
                        Remarques = "Archivage direct du courrier",
                        NomPersonneExterne = "",
                        Statut = StatutTransaction.Accepte
                    };
                    _context.Transactions.Add(transaction);
                }
                else if (dto.ModeTraitement == "unique")
                {
                    if (string.IsNullOrEmpty(dto.ServiceDestinataire))
                        return BadRequest(new { error = "Le service destinataire est requis pour le mode 'unique'" });

                    // Resolve against the live service catalog so services created from
                    // the admin panel are valid destinations (RBAC code or legacy enum name).
                    var destCode = await _serviceCatalog.ResolveCodeAsync(dto.ServiceDestinataire);
                    if (destCode == null)
                        return BadRequest(new { error = $"Service '{dto.ServiceDestinataire}' invalide" });

                    var destService = ServiceMapper.MapToServiceEnum(destCode);

                    // "Transaction Unique" is a REQUEST, not a move: the folder stays
                    // with the sender's service until the destination accepts it
                    // (TransactionService.AccepterAsync performs the move). Otherwise
                    // it would land in the receiver's lists before they ever answer.
                    courrier.StatutActuel = StatutDossier.EnInstance;

                    var transaction = new Transaction
                    {
                        DocumentId = courrier.Id,
                        ServiceOrigine = creatorServiceEnum,
                        ServiceOrigineCode = creatorServiceCode,
                        ServiceDestination = destService,
                        ServiceDestinationCode = destCode,
                        DateTransaction = DateTime.Now,
                        Remarques = $"Transfert vers {destService}",
                        NomPersonneExterne = "",
                        Statut = StatutTransaction.EnAttente
                    };
                    _context.Transactions.Add(transaction);
                }
                else if (dto.ModeTraitement == "diffusion")
                {
                    if (dto.ServicesDiffusion == null || dto.ServicesDiffusion.Count == 0)
                        return BadRequest(new { error = "Au moins un service est requis pour la diffusion" });

                    // Diffusion broadcasts REQUESTS: the folder stays with the sender
                    // and each destination answers on its own.
                    courrier.StatutActuel = StatutDossier.EnInstance;

                    foreach (var serviceName in dto.ServicesDiffusion)
                    {
                        // Resolve against the live service catalog (dynamic services included)
                        var diffCode = await _serviceCatalog.ResolveCodeAsync(serviceName);
                        if (diffCode == null)
                            continue;

                        var destService = ServiceMapper.MapToServiceEnum(diffCode);

                        var transaction = new Transaction
                        {
                            DocumentId = courrier.Id,
                            ServiceOrigine = creatorServiceEnum,
                            ServiceOrigineCode = creatorServiceCode,
                            ServiceDestination = destService,
                            ServiceDestinationCode = diffCode,
                            DateTransaction = DateTime.Now,
                            Remarques = $"Diffusion vers {destService}",
                            NomPersonneExterne = "",
                            Statut = StatutTransaction.EnAttente
                        };
                        _context.Transactions.Add(transaction);
                    }
                }

                await _context.SaveChangesAsync();

                // ── Auto-grant Owner access to creator's service ──
                await _accessService.GrantOwnerAsync(courrier.Id, creatorServiceCode, creatorUserId);

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
            // Vérifier l'unicité du numéro de référence (exclure le document courant)
            var numeroRef = dto.NumeroReference;
            if (!string.IsNullOrWhiteSpace(numeroRef) && numeroRef != courrier.NumeroReference)
            {
                var refExists = await _context.Documents
                    .AnyAsync(d => d.NumeroReference == numeroRef && d.Id != id);
                if (refExists)
                    return Conflict(new { error = "Ce numéro de référence existe déjà" });
            }

            courrier.Expediteur = dto.Expediteur ?? dto.Source ?? courrier.Expediteur;
            courrier.Objet = dto.Objet;
            courrier.DateReception = dto.DateArrivee ?? dto.DateReception ?? courrier.DateReception;
            courrier.TypeCircuit = dto.TypeCircuit ?? courrier.TypeCircuit;
            courrier.FilePath = dto.FilePath ?? courrier.FilePath;
            courrier.NumeroReference = dto.NumeroReference ?? courrier.NumeroReference;
            courrier.Sujet = dto.Objet;
            courrier.Transmissible = dto.Transmissible;
            courrier.Source = dto.Source ?? courrier.Source;
            courrier.DateMessage = dto.DateMessage ?? courrier.DateMessage;
            courrier.Etat = dto.Etat ?? courrier.Etat;
            courrier.Notes = dto.Notes ?? courrier.Notes;

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
                    ServiceActuelCode = c.ServiceActuelCode,
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
        public string? ServiceActuelCode { get; set; }
        public string? StatutActuel { get; set; }
        public string? FilePath { get; set; }
        public string? Source { get; set; }
        public string? NumeroReference { get; set; }
        public DateTime DernierTransfert { get; set; }
        public bool Transmissible { get; set; } = true;
    }
    public class CourrierAdminDto
    {
        // "Numéro interne" — the unique identification number of the folder.
        // Validated manually so the legacy `NumeroOrdre` alias below still works.
        public string? NumeroReference { get; set; }
        /// <summary>Legacy alias for <see cref="NumeroReference"/> — pre-"Gérer les courriers" payloads.</summary>
        public string? NumeroOrdre { get; set; }
        [Required]
        public string Objet { get; set; } = string.Empty;

        // ── Assigned by the system on creation ──
        /// <summary>N° de bureau — creator user id + year. Ignored if supplied.</summary>
        public string? NumeroBureauOrdre { get; set; }
        /// <summary>Kept for backward compatibility; derived from <see cref="Source"/>.</summary>
        public string? Expediteur { get; set; }

        // ── Shared common fields ──
        public string? Source { get; set; }
        public DateTime? DateArrivee { get; set; }
        public DateTime? DateMessage { get; set; }
        public string? Etat { get; set; }
        public string? Notes { get; set; }

        public DateTime? DateReception { get; set; }
        public string? TypeCircuit { get; set; }
        public string? FilePath { get; set; }
        public bool Transmissible { get; set; } = true;

        // ===== MODES DE TRAITEMENT =====
        public string? ModeTraitement { get; set; } // "archivage", "unique", "diffusion"
        public string? ServiceDestinataire { get; set; } // Pour "unique" (ex: "OuvertureDossier")
        public List<string>? ServicesDiffusion { get; set; } // Pour "diffusion" (ex: ["Service1", "Service2"])
    }
}