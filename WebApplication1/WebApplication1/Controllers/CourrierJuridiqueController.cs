using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Helpers;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CourrierJuridiqueController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly WebApplication1.Services.DocumentAccessService _accessService;

        public CourrierJuridiqueController(AppDbContext context, WebApplication1.Services.DocumentAccessService accessService)
        {
            _context = context;
            _accessService = accessService;
        }

        // GET: api/CourrierJuridique
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(userIdStr, out var userId))
                return Unauthorized();

            var user = await _context.Utilisateurs.FindAsync(userId);
            var userService = user?.Service;

            var query = _context.DossiersJuridiques.Where(d => !d.EstSupprime).AsQueryable();

            // STRICT SERVICE SCOPING: users only see docs in their current service.
            var role = user?.Role ?? "";
            var isAdminLike = role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant";
            if (!string.IsNullOrEmpty(userService) && !isAdminLike)
            {
                var userServiceEnum = ServiceMapper.MapToServiceEnum(userService);
                query = query.Where(c => c.ServiceActuel == userServiceEnum);
            }

            var juridiques = await query
                .Select(c => new {
                    c.Id,
                    c.NumeroReference,
                    c.Demandeur,
                    c.Objet,
                    c.Sujet,
                    c.DateCreation,
                    c.ServiceActuel,
                    c.StatutActuel,
                    c.FilePath,
                    DernierTransfert = c.Transactions
                        .OrderByDescending(t => t.DateTransaction)
                        .Select(t => (System.DateTime?)t.DateTransaction)
                        .FirstOrDefault() ?? c.DateCreation
                })
                .OrderByDescending(c => c.DateCreation)
                .ToListAsync();
            return Ok(juridiques);
        }

        // GET: api/CourrierJuridique/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var juridique = await _context.DossiersJuridiques.FindAsync(id);
            if (juridique == null)
                return NotFound(new { message = "Courrier non trouvé" });
            return Ok(juridique);
        }

        // POST: api/CourrierJuridique
        [HttpPost]
        [RequirePermission("creer_courrier_juridique")]
        public async Task<IActionResult> Post([FromBody] CreateDossierJuridiqueDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(userIdStr, out var userId))
                return Unauthorized();

            var user = await _context.Utilisateurs.FindAsync(userId);
            var creatorServiceEnum = ServiceMapper.MapToServiceEnum(user?.Service ?? "BureauOrdre");

            var juridique = new DossierJuridique
            {
                NumeroReference = dto.Reference ?? "",
                Sujet = dto.Objet ?? "",
                Objet = dto.Objet ?? "",
                NumeroBureauOrdre = dto.NumeroBureauOrdre ?? "",
                NumeroDossierJuridique = dto.NumeroDossierAppel,
                TypeCircuit = dto.TypeCircuit,
                MotifException = dto.MotifException,
                Demandeur = dto.Demandeur ?? "",
                DateEntree = DateTime.Now,
                EtapeJalsatActuelle = dto.EtapeJalsatActuelle ?? "ijra2_baht",
                EtatGlobal = dto.EtatGlobal ?? "En cours",
                Circuit = dto.Circuit,
                EtapeService = dto.EtapeService,
                JalsatTransaction = dto.JalsatTransaction,
                TaslimTransaction = dto.TaslimTransaction,
                AutoriteRetrait = dto.AutoriteRetrait,
                ServiceActuel = creatorServiceEnum,
                StatutActuel = StatutDossier.Nouveau,
                DateCreation = DateTime.Now
            };

            _context.DossiersJuridiques.Add(juridique);
            await _context.SaveChangesAsync();

            if (creatorServiceEnum != ServiceTribunal.OuvertureDossier)
            {
                var transaction = new Transaction
                {
                    DocumentId = juridique.Id,
                    ServiceOrigine = creatorServiceEnum,
                    ServiceDestination = ServiceTribunal.OuvertureDossier,
                    Statut = StatutTransaction.Accepte,
                    Remarques = "Créé et transféré",
                    DateTransaction = DateTime.Now
                };
                _context.Transactions.Add(transaction);
                await _context.SaveChangesAsync();
            }

            // ── Auto-grant Owner access to creator's service ──
            var creatorServiceCode = DocumentAccessService.ServiceTribunalToRbacCode(creatorServiceEnum);
            await _accessService.GrantOwnerAsync(juridique.Id, creatorServiceCode, userId);

            return CreatedAtAction(nameof(Get), new { id = juridique.Id }, new { message = "Dossier juridique créé avec succès", id = juridique.Id });
        }

        // PUT: api/CourrierJuridique/{id}
        [HttpPut("{id}")]
        [RequirePermission("creer_courrier_juridique")]
        public async Task<IActionResult> Put(int id, [FromBody] CreateDossierJuridiqueDto dto)
        {
            var juridique = await _context.DossiersJuridiques.FindAsync(id);
            if (juridique == null)
                return NotFound(new { message = "Courrier non trouvé" });

            // ── CUSTODY CHECK: only the current service holder can modify ──
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
            {
                if (!_accessService.IsUserCustodian(juridique, userId))
                    return StatusCode(403, new { error = "Vous n'êtes pas le détenteur actuel de ce dossier. Seul le service en charge peut le modifier." });
            }

            juridique.NumeroReference = dto.Reference ?? juridique.NumeroReference;
            juridique.Sujet = dto.Objet ?? juridique.Sujet;
            juridique.Objet = dto.Objet ?? juridique.Objet;
            juridique.NumeroBureauOrdre = dto.NumeroBureauOrdre ?? juridique.NumeroBureauOrdre;
            juridique.NumeroDossierJuridique = dto.NumeroDossierAppel ?? juridique.NumeroDossierJuridique;
            juridique.TypeCircuit = dto.TypeCircuit ?? juridique.TypeCircuit;
            juridique.MotifException = dto.MotifException ?? juridique.MotifException;
            juridique.Demandeur = dto.Demandeur ?? juridique.Demandeur;
            juridique.EtapeJalsatActuelle = dto.EtapeJalsatActuelle ?? juridique.EtapeJalsatActuelle;
            juridique.EtatGlobal = dto.EtatGlobal ?? juridique.EtatGlobal;
            juridique.Circuit = dto.Circuit ?? juridique.Circuit;
            juridique.EtapeService = dto.EtapeService;
            juridique.JalsatTransaction = dto.JalsatTransaction ?? juridique.JalsatTransaction;
            juridique.TaslimTransaction = dto.TaslimTransaction ?? juridique.TaslimTransaction;
            juridique.AutoriteRetrait = dto.AutoriteRetrait ?? juridique.AutoriteRetrait;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Dossier juridique mis à jour" });
        }

        // DELETE: api/CourrierJuridique/{id} (suppression logique)
        [HttpDelete("{id}")]
        [RequirePermission("supprimer")]
        public async Task<IActionResult> Delete(int id)
        {
            var juridique = await _context.DossiersJuridiques.FindAsync(id);
            if (juridique == null)
                return NotFound(new { message = "Courrier non trouvé" });

            // ── CUSTODY CHECK: only the current service holder can delete ──
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
            {
                if (!_accessService.IsUserCustodian(juridique, userId))
                    return StatusCode(403, new { error = "Vous n'êtes pas le détenteur actuel de ce dossier. Seul le service en charge peut le supprimer." });
            }

            juridique.EstSupprime = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Courrier supprimé avec succès" });
        }
    }

    public class CreateDossierJuridiqueDto
    {
        [Required]
        public string? Reference { get; set; }
        [Required]
        public string? Objet { get; set; }
        public string? Provenance { get; set; }
        public string? Circuit { get; set; }
        public string? TypeCircuit { get; set; }
        public string? MotifException { get; set; }
        public string? JalsatTransaction { get; set; }
        public string? TaslimTransaction { get; set; }
        public string? AutoriteRetrait { get; set; }
        public int EtapeService { get; set; }
        public string? NumeroDossierAppel { get; set; }
        public string? NumeroBureauOrdre { get; set; }
        public string? Demandeur { get; set; }
        public string? EtatGlobal { get; set; }
        public string? EtapeJalsatActuelle { get; set; }
        public string? TypeProcedure { get; set; }
        public string? NumCourAppel { get; set; }
        public string? ConseillerRapporteur { get; set; }
        public string? DateAudience { get; set; }
    }
}