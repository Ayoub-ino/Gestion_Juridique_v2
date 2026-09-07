using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PermissionService _permissionService;

        public UsersController(AppDbContext context, PermissionService permissionService)
        {
            _context = context;
            _permissionService = permissionService;
        }

        [HttpGet]
        [RequirePermission("gerer_utilisateurs")]
        public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
        {
            var query = _context.Utilisateurs
                .Include(u => u.ServiceEntity)
                .AsQueryable();

            if (!includeInactive)
                query = query.Where(u => u.IsActive);

            var users = await query
                .Select(u => new {
                    u.Id,
                    u.Login,
                    u.Nom,
                    u.Role,
                    u.Service,
                    u.ServiceId,
                    ServiceNom = u.ServiceEntity != null ? u.ServiceEntity.Nom : null,
                    ServiceCode = u.ServiceEntity != null ? u.ServiceEntity.Code : null,
                    u.IsActive,
                    u.DeletedAt
                })
                .ToListAsync();
            return Ok(users);
        }

        [HttpGet("by-service/{serviceCode}")]
        [Authorize]
        public async Task<IActionResult> GetByService(string serviceCode)
        {
            var users = await _context.Utilisateurs
                .Include(u => u.ServiceEntity)
                .Where(u => u.IsActive && (
                    u.Service == serviceCode ||
                    (u.ServiceEntity != null && u.ServiceEntity.Code == serviceCode)
                ))
                .Select(u => new {
                    u.Id,
                    u.Nom,
                    u.Login,
                    u.Service,
                    ServiceNom = u.ServiceEntity != null ? u.ServiceEntity.Nom : null,
                    ServiceCode = u.ServiceEntity != null ? u.ServiceEntity.Code : null
                })
                .ToListAsync();

            return Ok(users);
        }

        // Lightweight active-user list used by non-admin pages (e.g. the
        // substitute picker on the profile page).
        [HttpGet("actifs")]
        [Authorize]
        public async Task<IActionResult> GetActive()
        {
            var users = await _context.Utilisateurs
                .Where(u => u.IsActive)
                .Select(u => new { u.Id, u.Nom, u.Service })
                .ToListAsync();
            return Ok(users);
        }

        [HttpGet("{id}")]
        [RequirePermission("gerer_utilisateurs")]
        public async Task<IActionResult> GetById(int id)
        {
            var user = await _context.Utilisateurs
                .Include(u => u.ServiceEntity)
                .FirstOrDefaultAsync(u => u.Id == id);
            if (user == null)
                return NotFound(new { message = "Utilisateur non trouvé" });

            return Ok(new {
                user.Id,
                user.Login,
                user.Nom,
                user.Role,
                user.Service,
                user.ServiceId,
                ServiceNom = user.ServiceEntity?.Nom,
                ServiceCode = user.ServiceEntity?.Code,
                user.IsActive,
                user.DeletedAt
            });
        }

        [HttpPost]
        [RequirePermission("gerer_utilisateurs")]
        public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var exists = await _context.Utilisateurs.AnyAsync(u => u.Login == dto.Login);
            if (exists)
                return Conflict(new { error = "Ce login existe déjà" });

            // Resolve service code from ServiceId if not provided
            string serviceCode = dto.Service ?? "";
            if (dto.ServiceId.HasValue && string.IsNullOrEmpty(serviceCode))
            {
                var svc = await _context.RbacServices.FindAsync(dto.ServiceId.Value);
                serviceCode = svc?.Code ?? "";
            }

            var user = new Utilisateur
            {
                Login = dto.Login,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Nom = dto.Nom,
                Role = dto.Role ?? "User",
                Service = serviceCode,
                ServiceId = dto.ServiceId
            };

            _context.Utilisateurs.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Utilisateur créé avec succès", id = user.Id });
        }

        [HttpPut("{id}")]
        [RequirePermission("gerer_utilisateurs")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateUserDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var user = await _context.Utilisateurs.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "Utilisateur non trouvé" });

            if (dto.Nom != null) user.Nom = dto.Nom;
            if (dto.Login != null) user.Login = dto.Login;
            if (dto.Role != null) user.Role = dto.Role;
            if (dto.ServiceId.HasValue)
            {
                user.ServiceId = dto.ServiceId;
                // Auto-sync the Service string field from ServiceId
                var svc = await _context.RbacServices.FindAsync(dto.ServiceId.Value);
                if (svc != null) user.Service = svc.Code;
            }
            if (dto.Service != null) user.Service = dto.Service;
            if (!string.IsNullOrEmpty(dto.Password))
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            await _context.SaveChangesAsync();
            return Ok(new { message = "Utilisateur modifié avec succès" });
        }

        [HttpDelete("{id}")]
        [RequirePermission("gerer_utilisateurs")]
        public async Task<IActionResult> Delete(int id)
        {
            var user = await _context.Utilisateurs.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "Utilisateur non trouvé" });

            // Don't allow deleting the admin
            if (user.Role == "Admin")
                return BadRequest(new { error = "Impossible de supprimer l'administrateur" });

            user.IsActive = false;
            user.DeletedAt = DateTime.Now;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Utilisateur désactivé avec succès" });
        }

        [HttpPost("{id}/restore")]
        [RequirePermission("gerer_utilisateurs")]
        public async Task<IActionResult> Restore(int id)
        {
            var user = await _context.Utilisateurs.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "Utilisateur non trouvé" });

            user.IsActive = true;
            user.DeletedAt = null;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Utilisateur restauré avec succès" });
        }
    }

    public class CreateUserDto
    {
        [Required]
        public string Login { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        [Required]
        public string Nom { get; set; } = string.Empty;
        public string? Role { get; set; }
        public string? Service { get; set; }
        public int? ServiceId { get; set; }
    }

    public class UpdateUserDto
    {
        public string? Login { get; set; }
        public string? Password { get; set; }
        public string? Nom { get; set; }
        public string? Role { get; set; }
        public string? Service { get; set; }
        public int? ServiceId { get; set; }
    }
}
