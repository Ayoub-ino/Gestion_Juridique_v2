using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/rbac/services")]
    [Authorize]
    public class RbacServicesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RbacServicesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
        {
            var query = _context.RbacServices
                .Include(s => s.Parent)
                .AsQueryable();

            // Only return active services by default (for dispatch forms, dropdowns, etc.)
            if (!includeInactive)
                query = query.Where(s => s.IsActive);

            var services = await query
                .OrderBy(s => s.Nom)
                .Select(s => new
                {
                    s.Id,
                    s.Nom,
                    s.Code,
                    s.Description,
                    s.ParentId,
                    s.IsActive,
                    s.DeletedAt,
                    ParentNom = s.Parent != null ? s.Parent.Nom : null,
                    UserCount = _context.Utilisateurs.Count(u => u.ServiceId == s.Id)
                })
                .ToListAsync();

            return Ok(services);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var service = await _context.RbacServices.FindAsync(id);
            if (service == null)
                return NotFound(new { error = "Service non trouvé" });

            return Ok(new
            {
                service.Id,
                service.Nom,
                service.Code,
                service.Description,
                service.ParentId
            });
        }

        [HttpPost]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Create([FromBody] CreateServiceDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var exists = await _context.RbacServices.AnyAsync(s => s.Code == dto.Code);
            if (exists)
                return Conflict(new { error = "Ce code existe déjà" });

            var service = new Service
            {
                Nom = dto.Nom,
                Code = dto.Code,
                Description = dto.Description,
                ParentId = dto.ParentId
            };

            _context.RbacServices.Add(service);
            await _context.SaveChangesAsync();

            // Auto-initialize default permissions for the new service
            // Uses the same defaults as bureauordre (most common set)
            var defaultPermissions = new[]
            {
                "creer_modifier", "transferer", "consulter", "accepter", "refuser",
                "annuler_transfert", "dashboard", "mes_entites", "transactions",
                "recherche_avancee", "export_excel", "export_word", "voir_historique",
                "telecharger_fichiers", "ajouter_notes", "profil"
            };
            foreach (var key in defaultPermissions)
            {
                _context.ServicePermissions.Add(new ServicePermission
                {
                    ServiceId = service.Id,
                    PermissionKey = key,
                    Enabled = true
                });
            }
            await _context.SaveChangesAsync();

            return Ok(new { message = "Service créé avec succès", id = service.Id });
        }

        [HttpPut("{id}")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateServiceDto dto)
        {
            var service = await _context.RbacServices.FindAsync(id);
            if (service == null)
                return NotFound(new { error = "Service non trouvé" });

            if (dto.Nom != null) service.Nom = dto.Nom;
            if (dto.Code != null) service.Code = dto.Code;
            if (dto.Description != null) service.Description = dto.Description;
            if (dto.ParentId.HasValue) service.ParentId = dto.ParentId;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Service modifié avec succès" });
        }

        [HttpDelete("{id}")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Delete(int id)
        {
            var service = await _context.RbacServices.FindAsync(id);
            if (service == null)
                return NotFound(new { error = "Service non trouvé" });

            if (!service.IsActive)
                return BadRequest(new { error = "Ce service est déjà archivé" });

            // Soft-delete: mark as archived instead of removing
            service.IsActive = false;
            service.DeletedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Service archivé avec succès" });
        }

        [HttpPost("{id}/restore")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Restore(int id)
        {
            var service = await _context.RbacServices.FindAsync(id);
            if (service == null)
                return NotFound(new { error = "Service non trouvé" });

            service.IsActive = true;
            service.DeletedAt = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Service restauré avec succès" });
        }

        [HttpDelete("{id}/permanent")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> PermanentDelete(int id)
        {
            var service = await _context.RbacServices.FindAsync(id);
            if (service == null)
                return NotFound(new { error = "Service non trouvé" });

            // Check if users are assigned — cannot permanently delete if users exist
            var userCount = await _context.Utilisateurs.CountAsync(u => u.ServiceId == id);
            if (userCount > 0)
                return BadRequest(new { error = $"Impossible de supprimer définitivement: {userCount} utilisateur(s) assigné(s) à ce service" });

            // Remove service permissions
            var perms = await _context.ServicePermissions.Where(sp => sp.ServiceId == id).ToListAsync();
            _context.ServicePermissions.RemoveRange(perms);

            // Remove children references
            var children = await _context.RbacServices.Where(s => s.ParentId == id).ToListAsync();
            foreach (var child in children)
                child.ParentId = null;

            _context.RbacServices.Remove(service);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Service supprimé définitivement" });
        }
    }

    public class CreateServiceDto
    {
        [Required]
        public string Nom { get; set; } = string.Empty;
        [Required]
        public string Code { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? ParentId { get; set; }
    }

    public class UpdateServiceDto
    {
        public string? Nom { get; set; }
        public string? Code { get; set; }
        public string? Description { get; set; }
        public int? ParentId { get; set; }
    }
}
