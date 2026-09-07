using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System;
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
    [Route("api/juridique/{dossierId}/[controller]")]
    [Authorize]
    public class TransactionJuridiqueController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PermissionService _permissionService;

        public TransactionJuridiqueController(AppDbContext context, PermissionService permissionService)
        {
            _context = context;
            _permissionService = permissionService;
        }

        [HttpPost]
        [RequirePermission("transferer_juridique")]
        public async Task<IActionResult> MoveDossier(int dossierId, [FromBody] MoveDto dto)
        {
            // 1. Récupérer l'utilisateur connecté (via JWT)
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(userIdStr, out var userId))
                return Unauthorized();

            var user = await _context.Utilisateurs.FindAsync(userId);
            if (user == null) return Unauthorized();

            var role = user?.Role ?? "";
            var isAdminLike = role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant";

            // 2. Récupérer le dossier
            var dossier = await _context.DossiersJuridiques
                .Include(d => d.Transactions)
                .FirstOrDefaultAsync(d => d.Id == dossierId);

            if (dossier == null)
                return NotFound(new { error = "Dossier non trouvé" });

            // 3. Vérification des droits : seul le service propriétaire ou l'admin peut le déplacer
            //    Compare the mapped service enums — the raw user.Service string is an RBAC code
            //    (e.g. "fathmilafat") that never matches ServiceTribunal.ToString() (e.g. "BureauOrdre").
            var currentService = dossier.ServiceActuel;
            var userService = ServiceMapper.MapToServiceEnum(user?.Service ?? "");
            if (!isAdminLike && userService != currentService)
                return Unauthorized(new { error = "Vous n'avez pas le droit de déplacer ce dossier" });

            // 4. Logique de mouvement
            ServiceTribunal destination;
            bool isReturn = dto.Action == "return";

            // Déterminer la destination selon l'action
            switch (dto.Action)
            {
                // --- DEPUIS JALSAT ---
                case "to_ijra2":
                    destination = ServiceTribunal.Ijra2Baht;
                    dossier.StatutActuel = StatutDossier.EnCours;
                    break;
                case "to_mofawid":
                    destination = ServiceTribunal.MofawidMalaki;
                    dossier.StatutActuel = StatutDossier.EnInstance;
                    break;
                case "to_khibra":
                    destination = ServiceTribunal.Khibra;
                    dossier.StatutActuel = StatutDossier.EnCours;
                    break;
                case "to_moqarir":
                    destination = ServiceTribunal.MustacharMoqarir;
                    dossier.StatutActuel = StatutDossier.EnInstance;
                    break;
                // --- RETOUR VERS JALSAT (depuis un sous-service) ---
                case "return_to_jalsat":
                    destination = ServiceTribunal.JalsatWaIjra2at;
                    dossier.StatutActuel = StatutDossier.EnCours;
                    break;

                // --- DEPUIS TASLIM ---
                case "to_tabligh":
                    destination = ServiceTribunal.Tabligh;
                    dossier.StatutActuel = StatutDossier.EnCours;
                    break;
                case "to_tasfiya":
                    destination = ServiceTribunal.TasfiyatSawa2ir;
                    dossier.StatutActuel = StatutDossier.EnCours;
                    break;
                case "to_archive_final":
                    destination = ServiceTribunal.Archive;
                    dossier.StatutActuel = StatutDossier.Archive;
                    dossier.EtatGlobal = "Archivé";
                    break;
                // --- RETOUR VERS TASLIM (depuis Tabligh ou Tasfiya) ---
                case "return_to_taslim":
                    destination = ServiceTribunal.TaslimNusakh;
                    dossier.StatutActuel = StatutDossier.EnCours;
                    break;

                // --- RETRAIT DEPUIS L'ARCHIVE ---
                case "retrait_archive":
                    // Check cloturer permission for archive retraction
                    if (!await _permissionService.HasPermissionAsync(userId, "cloturer"))
                        return StatusCode(403, new { error = "Permission 'cloturer' requise pour le retrait d'archive" });
                    if (dossier.ServiceActuel != ServiceTribunal.Archive)
                        return BadRequest(new { error = "Le dossier n'est pas archivé" });
                    // On reste à Archive mais on enregistre l'autorité qui a retiré
                    dossier.AutoriteRetrait = dto.AutoriteRetrait;
                    dossier.StatutActuel = StatutDossier.Cloture; // ou un statut spécifique
                    await _context.SaveChangesAsync();
                    return Ok(new { message = $"Retrait effectué par {dto.AutoriteRetrait}" });

                default:
                    return BadRequest(new { error = "Action invalide" });
            }

            // 5. Vérification des transitions autorisées (sécurité)
            if (!isAdminLike)
            {
                bool canMove = false;
                // Si on est à Jalsat, on peut aller vers les 4 sous-services ou vers Taslim
                if (currentService == ServiceTribunal.JalsatWaIjra2at)
                {
                    if (dto.Action.StartsWith("to_") && dto.Action != "to_archive_final" && dto.Action != "to_tabligh" && dto.Action != "to_tasfiya")
                        canMove = true;
                    if (dto.Action == "to_tabligh" || dto.Action == "to_tasfiya" || dto.Action == "to_archive_final")
                        canMove = true; // Passage vers Taslim
                }
                // Si on est dans un sous-service de Jalsat, on ne peut que retourner
                else if (currentService == ServiceTribunal.Ijra2Baht || currentService == ServiceTribunal.MofawidMalaki ||
                         currentService == ServiceTribunal.Khibra || currentService == ServiceTribunal.MustacharMoqarir)
                {
                    if (dto.Action == "return_to_jalsat") canMove = true;
                }
                // Si on est à Taslim, on peut aller vers Tabligh, Tasfiya ou Archive
                else if (currentService == ServiceTribunal.TaslimNusakh)
                {
                    if (dto.Action == "to_tabligh" || dto.Action == "to_tasfiya" || dto.Action == "to_archive_final")
                        canMove = true;
                }
                // Si on est dans Tabligh ou Tasfiya, on ne peut que retourner à Taslim
                else if (currentService == ServiceTribunal.Tabligh || currentService == ServiceTribunal.TasfiyatSawa2ir)
                {
                    if (dto.Action == "return_to_taslim") canMove = true;
                }
                // Si on est à Archive, on ne peut que faire un retrait
                else if (currentService == ServiceTribunal.Archive)
                {
                    if (dto.Action == "retrait_archive") canMove = true;
                }

                if (!canMove)
                    return BadRequest(new { error = "Transition non autorisée depuis ce service" });
            }

            // 6. Appliquer le mouvement
            dossier.ServiceActuel = destination;
            dossier.EtapeJalsatActuelle = dto.Action;

            var transaction = new Transaction
            {
                DocumentId = dossier.Id,
                ServiceOrigine = currentService,
                ServiceDestination = destination,
                DateTransaction = DateTime.Now,
                Remarques = $"Action: {dto.Action}",
                NomPersonneExterne = dto.AutoriteRetrait ?? ""
            };
            _context.Transactions.Add(transaction);

            await _context.SaveChangesAsync();

            return Ok(new { message = "Dossier déplacé avec succès", dossier });
        }

        public class MoveDto
        {
            public string Action { get; set; } = string.Empty; // to_ijra2, to_mofawid, return_to_jalsat, etc.
            public string? AutoriteRetrait { get; set; } // Pour le retrait d'archive
        }
    }
}
