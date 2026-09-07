using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ActionsJuridiquesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ActionsJuridiquesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        [RequirePermission("transferer_juridique")]
        public async Task<IActionResult> EnregistrerAction([FromBody] ActionJuridiqueDto dto)
        {
            try
            {
                // Récupérer l'utilisateur connecté
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (userId == null) return Unauthorized();
                var user = await _context.Utilisateurs.FindAsync(int.Parse(userId));
                var nomUtilisateur = user?.Nom ?? "Système";

                // Vérifier que le dossier existe
                var dossier = await _context.DossiersJuridiques.FindAsync(dto.DossierId);
                if (dossier == null)
                    return NotFound(new { error = "Dossier non trouvé" });

                // Créer l'action
                var action = new ActionJuridique
                {
                    DossierId = dto.DossierId,
                    Service = dto.Service,
                    Action = dto.Action,
                    Commentaire = dto.Commentaire,
                    Statut = dto.Statut,
                    Utilisateur = nomUtilisateur,
                    DateAction = DateTime.Now,
                    Donnees = dto.DonneesJson
                };

                _context.ActionsJuridiques.Add(action);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Action enregistrée avec succès", action });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Erreur interne", detail = ex.Message });
            }
        }

        [HttpGet("{dossierId}")]
        public async Task<IActionResult> GetActionsByDossier(int dossierId)
        {
            var actions = await _context.ActionsJuridiques
                .Where(a => a.DossierId == dossierId)
                .OrderByDescending(a => a.DateAction)
                .ToListAsync();

            return Ok(actions);
        }
    }

    public class ActionJuridiqueDto
    {
        public int DossierId { get; set; }
        public string Service { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? Commentaire { get; set; }
        public string? Statut { get; set; }
        public string? DonneesJson { get; set; }
    }
}