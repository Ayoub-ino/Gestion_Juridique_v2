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

        private static readonly Dictionary<ServiceTribunal, List<ServiceTribunal>> ParentChildren = new()
        {
            { ServiceTribunal.JalsatWaIjra2at, new() { ServiceTribunal.Ijra2Baht, ServiceTribunal.MofawidMalaki, ServiceTribunal.Khibra, ServiceTribunal.MustacharMoqarir } },
            { ServiceTribunal.TaslimNusakh, new() { ServiceTribunal.Tabligh, ServiceTribunal.TasfiyatSawa2ir, ServiceTribunal.Archive } },
        };

        public TransferController(AppDbContext context, DocumentAccessService accessService)
        {
            _context = context;
            _accessService = accessService;
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

            var serviceOrigine = document.ServiceActuel;

            // Check if the destination is a Historique (record-only) service
            var isHistorical = dto.IsHistoricalService == true;
            string? historicalServiceCode = isHistorical ? dto.ServiceDestination : null;

            ServiceTribunal serviceDestination;
            if (isHistorical)
            {
                // For historical services, use a placeholder destination
                // The actual routing is tracked via HistoricalServiceCode
                serviceDestination = ServiceTribunal.Archive;
            }
            else
            {
                serviceDestination = GetServiceEnum(dto.ServiceDestination);
            }

            var destinations = new List<ServiceTribunal> { serviceDestination };
            if (!isHistorical && !dto.TargetUserId.HasValue && ParentChildren.TryGetValue(serviceDestination, out var children))
            {
                destinations.AddRange(children);
            }

            var transactionIds = new List<int>();

            // Resolve target user IDs: prefer TargetUserIds (multi-user), fall back to TargetUserId (single)
            var targetUserIds = dto.TargetUserIds?.Count > 0
                ? dto.TargetUserIds
                : dto.TargetUserId.HasValue
                    ? new List<int> { dto.TargetUserId.Value }
                    : new List<int>();

            foreach (var dest in destinations)
            {
                // Historique services are record-only entities with no login —
                // auto-accept the transfer immediately since no one can accept/refuse.
                var statut = isHistorical ? StatutTransaction.Accepte : StatutTransaction.EnAttente;

                if (targetUserIds.Count > 0)
                {
                    // Multi-user routing: create a separate transaction for each selected user
                    foreach (var uid in targetUserIds)
                    {
                        var transaction = new Transaction
                        {
                            DocumentId = document.Id,
                            ServiceOrigine = serviceOrigine,
                            ServiceDestination = dest,
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
                        ServiceDestination = dest,
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

            // For historical services, keep document.ServiceActuel as-is (or set to Archive)
            // since the document is not actually routed to a live service
            if (!isHistorical)
            {
                document.ServiceActuel = serviceDestination;
                document.StatutActuel = StatutDossier.EnInstance;
            }
            else
            {
                document.StatutActuel = StatutDossier.EnInstance;
            }

            await _context.SaveChangesAsync();

            // ── Auto-grant document access ──
            // Map ServiceTribunal enum values to RBAC Service.Code values
            // (enum names differ from RBAC codes for 6 of 9 services)
            var senderRbacCode = DocumentAccessService.ServiceTribunalToRbacCode(serviceOrigine);
            await _accessService.GrantEditorAsync(document.Id, senderRbacCode, userId);

            // Destination service gets Editor access
            if (!isHistorical)
            {
                var destRbacCode = DocumentAccessService.ServiceTribunalToRbacCode(serviceDestination);
                await _accessService.GrantEditorAsync(document.Id, destRbacCode, userId);
            }

            return Ok(new
            {
                message = "Transfert effectué avec succès",
                transactionIds,
                destinations = destinations.Select(d => d.ToString()).ToList()
            });
        }

        private static ServiceTribunal GetServiceEnum(string serviceName)
        {
            if (Enum.TryParse<ServiceTribunal>(serviceName, true, out var result))
                return result;

            return serviceName switch
            {
                "Bureau d'ordre et bureau administratif" => ServiceTribunal.BureauOrdre,
                "Bureau de Gestion des Dossiers Judiciaires" => ServiceTribunal.OuvertureDossier,
                "JalsatWaIjra2at" => ServiceTribunal.JalsatWaIjra2at,
                "TaslimNusakh" => ServiceTribunal.TaslimNusakh,
                "Bureau de Notification" => ServiceTribunal.BureauNotification,
                "Archive" => ServiceTribunal.Archive,
                "Bureau d'expertise" => ServiceTribunal.BureauExpertise,
                "Bureau des procédures du commissaire royal" => ServiceTribunal.ProcduresCommissaireRoyal,
                "Bureau de Gestion des Pourvois en Cassation" => ServiceTribunal.GestionPourvoisCassation,
                "Remise de copie de jugement" => ServiceTribunal.RemiseCopieJugement,
                "Bureau de Recouvrement" => ServiceTribunal.BureauRecouvrement,
                "Caisse du Tribunal" => ServiceTribunal.CaisseTribunal,
                "Service de Gestion Financière" => ServiceTribunal.GestionFinanciere,
                "Bureau de l'efficacité judiciaire et des statistiques" => ServiceTribunal.EfficaciteJudiciaire,
                "Cellule informatique" => ServiceTribunal.CelluleInformatique,
                "Direction" => ServiceTribunal.Direction,
                "Greffe" => ServiceTribunal.Greffe,
                _ => ServiceTribunal.BureauOrdre
            };
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
