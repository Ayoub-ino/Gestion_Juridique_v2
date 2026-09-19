using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
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
    public class TransferController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly DocumentAccessService _accessService;
        private readonly ServiceCatalog _serviceCatalog;

        private static readonly Dictionary<ServiceTribunal, List<ServiceTribunal>> ParentChildren = new()
        {
            { ServiceTribunal.JalsatWaIjra2at, new() { ServiceTribunal.Ijra2Baht, ServiceTribunal.MofawidMalaki, ServiceTribunal.Khibra, ServiceTribunal.MustacharMoqarir } },
            { ServiceTribunal.TaslimNusakh, new() { ServiceTribunal.Tabligh, ServiceTribunal.TasfiyatSawa2ir, ServiceTribunal.Archive } },
        };

        public TransferController(AppDbContext context, DocumentAccessService accessService, ServiceCatalog serviceCatalog)
        {
            _context = context;
            _accessService = accessService;
            _serviceCatalog = serviceCatalog;
        }

        [HttpPost]
        [RequirePermission("transferer")]
        public async Task<IActionResult> Transfer([FromBody] TransferDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var user = await _context.Utilisateurs.FindAsync(userId);
            if (user == null) return Unauthorized();

            Document? document;
            switch (dto.DocumentType)
            {
                case "entrant-admin":
                    document = await _context.CourriersAdministratifs.FindAsync(dto.DocumentId);
                    break;
                case "entrant-juridique":
                    document = await _context.DossiersJuridiques.FindAsync(dto.DocumentId);
                    break;
                case "sortant-normal":
                case "sortant-demande":
                    document = await _context.CourriersSortants.FindAsync(dto.DocumentId);
                    break;
                default:
                    return BadRequest(new { error = "Type de document invalide" });
            }

            if (document == null)
                return NotFound(new { error = "Document non trouvé" });

            // ── CUSTODY CHECK: only the current service holder can transfer ──
            if (!_accessService.IsUserCustodian(document, userId))
                return StatusCode(403, new { error = "Vous n'êtes pas le détenteur actuel de ce document. Seul le service en charge peut le transférer." });

            // ── TRANSMISSIBILITY CHECK ──
            // A courrier flagged "Non" may leave the originating service only once;
            // every subsequent transfer is refused.
            if (document is CourrierAdministratif nonTransmissible && !nonTransmissible.Transmissible)
            {
                var dejaTransfere = await _context.Transactions
                    .AnyAsync(t => t.DocumentId == document.Id);
                if (dejaTransfere)
                    return StatusCode(403, new { error = "Ce courrier n'est pas transmissible : il ne peut plus être transféré après sa première transmission." });
            }

            var serviceOrigine = document.ServiceActuel;

            // RBAC code of the service that currently holds the document.
            // Works for dynamically-created services too (enum cannot represent them).
            var sourceCode = ServiceMapper.ResolveDocumentServiceCode(document);

            // Check if the destination is a Historique (record-only) service
            var isHistorical = dto.IsHistoricalService == true;

            // Resolve the destination to a real RBAC service code, reading the live
            // database so services created/removed in the admin panel work instantly.
            var destCode = await _serviceCatalog.ResolveCodeAsync(dto.ServiceDestination);
            if (string.IsNullOrEmpty(destCode))
                return BadRequest(new { error = $"Service '{dto.ServiceDestination}' invalide" });

            string? historicalServiceCode = isHistorical ? destCode : null;

            // Enum counterpart — a best-effort legacy mirror. Dynamic services fall
            // back to the enum default, which is harmless: all real routing reads the code.
            var serviceDestination = ServiceMapper.MapToServiceEnum(destCode);

            var destinationCodes = new List<string> { destCode! };
            if (!isHistorical && !dto.TargetUserId.HasValue && !(dto.TargetUserIds?.Count > 0))
            {
                foreach (var childCode in ExpandChildServiceCodes(destCode!))
                {
                    if (!destinationCodes.Contains(childCode)) destinationCodes.Add(childCode);
                }
            }

            var transactionIds = new List<int>();

            // Resolve target user IDs: prefer TargetUserIds (multi-user), fall back to TargetUserId (single)
            var targetUserIds = dto.TargetUserIds?.Count > 0
                ? dto.TargetUserIds
                : dto.TargetUserId.HasValue
                    ? new List<int> { dto.TargetUserId.Value }
                    : new List<int>();

            foreach (var targetCode in destinationCodes)
            {
                // Historique services are record-only entities with no login —
                // auto-accept the transfer immediately since no one can accept/refuse.
                var statut = isHistorical ? StatutTransaction.Accepte : StatutTransaction.EnAttente;
                var destEnum = ServiceMapper.MapToServiceEnum(targetCode);

                if (targetUserIds.Count > 0)
                {
                    // Multi-user routing: create a separate transaction for each selected user
                    foreach (var uid in targetUserIds)
                    {
                        var transaction = new Transaction
                        {
                            DocumentId = document.Id,
                            ServiceOrigine = serviceOrigine,
                            ServiceOrigineCode = sourceCode,
                            ServiceDestination = destEnum,
                            ServiceDestinationCode = targetCode,
                            DateTransaction = DateTime.Now,
                            Remarques = dto.Message,
                            UtilisateurId = userId.ToString(),
                            Statut = statut,
                            DoitRevenir = dto.DoitRevenir,
                            TargetUserId = uid,
                            StatutPrecedent = document.StatutActuel,
                            HistoricalServiceCode = historicalServiceCode
                        };
                        _context.Transactions.Add(transaction);
                        await _context.SaveChangesAsync();
                        transactionIds.Add(transaction.Id);
                    }
                }
                else
                {
                    // Single/any-user routing: create one transaction for the service
                    var transaction = new Transaction
                    {
                        DocumentId = document.Id,
                        ServiceOrigine = serviceOrigine,
                        ServiceOrigineCode = sourceCode,
                        ServiceDestination = destEnum,
                        ServiceDestinationCode = targetCode,
                        DateTransaction = DateTime.Now,
                        Remarques = dto.Message,
                        UtilisateurId = userId.ToString(),
                        Statut = statut,
                        DoitRevenir = dto.DoitRevenir,
                        TargetUserId = null,
                        StatutPrecedent = document.StatutActuel,
                        HistoricalServiceCode = historicalServiceCode
                    };
                    _context.Transactions.Add(transaction);
                    await _context.SaveChangesAsync();
                    transactionIds.Add(transaction.Id);
                }
            }

            // ── PENDING TRANSFER: the folder STAYS with the sender until accepted ──
            // Historical services are record-only (no accounts, no login, no actions).
            // The transaction is auto-accepted as a historical note, but the folder
            // stays exactly where it is — no move, no access grant.
            document.StatutActuel = StatutDossier.EnInstance;

            await _context.SaveChangesAsync();

            // The sending service keeps Editor access.
            await _accessService.GrantEditorAsync(document.Id, sourceCode, userId);

            // Historical services receive no access (they have no accounts to use it).

            return Ok(new
            {
                message = "Transfert effectué avec succès",
                transactionIds,
                destinations = destinationCodes
            });
        }

        /// <summary>
        /// Legacy behaviour: transferring to a parent service without naming a specific
        /// user also records the transfer for that service's sub-units.
        /// </summary>
        private static IEnumerable<string> ExpandChildServiceCodes(string destCode)
        {
            if (!ServiceMapper.TryMapToServiceEnum(destCode, out var destEnum)) yield break;
            if (!ParentChildren.TryGetValue(destEnum, out var children)) yield break;

            foreach (var child in children)
                yield return DocumentAccessService.ServiceTribunalToRbacCode(child);
        }
    }

    public class TransferDto
    {
        [Range(1, int.MaxValue)]
        public int DocumentId { get; set; }
        [Required]
        public string DocumentType { get; set; } = string.Empty;
        [Required]
        public string ServiceDestination { get; set; } = string.Empty;
        public string? Message { get; set; }
        public bool DoitRevenir { get; set; }
        public int? TargetUserId { get; set; }
        /// <summary>
        /// Multiple target user IDs for multi-user routing.
        /// When provided, creates a separate transaction for each user.
        /// Falls back to TargetUserId if null.
        /// </summary>
        public List<int>? TargetUserIds { get; set; }
        /// <summary>
        /// When true, the destination is a Historical (record-only) service.
        /// The transfer is auto-accepted since historical entities cannot log in.
        /// </summary>
        public bool? IsHistoricalService { get; set; }
    }
}
