using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Authorize(Roles = "Admin")]
    [Route("api/[controller]")]
    public class SeedController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SeederService _seederService;

        public SeedController(AppDbContext context, SeederService seederService)
        {
            _context = context;
            _seederService = seederService;
        }

        /// <summary>
        /// Réexécute l'ensemble du seed RBAC (admin, services, permissions, overrides,
        /// services historiques, utilisateurs démo) sur la base — y compris une base
        /// déjà peuplée : mode force = insertion idempotente des lignes manquantes
        /// (les lignes existantes, y compris celles désactivées manuellement, sont
        /// conservées). Réservé au rôle Admin.
        /// </summary>
        [HttpPost("run")]
        public async Task<IActionResult> RunSeed()
        {
            var ok = await _seederService.SeedAsync(force: true);
            if (!ok)
                return StatusCode(500, new { error = "Le seed a échoué — consultez les logs serveur." });
            return Ok(new { message = "Seed exécuté avec succès (idempotent, mode force)." });
        }

        /// <summary>
        /// Dev-only endpoint to create an admin user. Restricted to Admin role only.
        /// The SeederService (called on startup) already auto-creates the admin user.
        /// </summary>
        [HttpPost("user")]
        public async Task<IActionResult> CreateTestUser()
        {
            // Vérifier si l'utilisateur "admin" existe déjà
            var existing = await _context.Utilisateurs.FirstOrDefaultAsync(u => u.Login == "admin");
            if (existing != null)
                return Ok(new { message = "L'utilisateur admin existe déjà. Essayez de vous connecter avec admin/admin123" });

            // Créer un nouvel utilisateur
            var user = new Utilisateur
            {
                Login = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                Nom = "Administrateur",
                Role = "Admin",
                Service = "Direction"
            };

            _context.Utilisateurs.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Utilisateur admin créé avec succès ! Login: admin, Mot de passe: admin123" });
        }
    }
}
