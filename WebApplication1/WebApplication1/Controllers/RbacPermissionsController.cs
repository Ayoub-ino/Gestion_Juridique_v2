using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/rbac/permissions")]
    [Authorize]
    public class RbacPermissionsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PermissionService _permissionService;

        public RbacPermissionsController(AppDbContext context, PermissionService permissionService)
        {
            _context = context;
            _permissionService = permissionService;
        }

        /// <summary>
        /// Get all available permissions (the master list).
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var permissions = await _context.Permissions
                .OrderBy(p => p.Category)
                .ThenBy(p => p.Key)
                .Select(p => new
                {
                    p.Id,
                    p.Key,
                    p.LabelFr,
                    p.LabelAr,
                    p.Description,
                    p.Category,
                    p.DefaultEnabled
                })
                .ToListAsync();

            return Ok(permissions);
        }

        /// <summary>
        /// Get permissions for a specific service (with enabled status).
        /// </summary>
        [HttpGet("service/{serviceId}")]
        public async Task<IActionResult> GetByService(int serviceId)
        {
            var service = await _context.RbacServices.FindAsync(serviceId);
            if (service == null)
                return NotFound(new { error = "Service non trouvé" });

            var permissions = await _permissionService.GetServicePermissionsAsync(serviceId);
            return Ok(new
            {
                serviceId,
                serviceNom = service.Nom,
                serviceCode = service.Code,
                permissions
            });
        }

        /// <summary>
        /// Get permissions for the current user.
        /// </summary>
        [HttpGet("mine")]
        public async Task<IActionResult> GetMine()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId))
                return Unauthorized();

            var keys = await _permissionService.GetUserPermissionsAsync(userId);
            return Ok(new { permissions = keys });
        }

        /// <summary>
        /// Update permissions for a service (admin only).
        /// </summary>
        [HttpPut("service/{serviceId}")]
        [RequirePermission("gerer_permissions")]
        public async Task<IActionResult> UpdateForService(int serviceId, [FromBody] UpdateServicePermissionsDto dto)
        {
            var service = await _context.RbacServices.FindAsync(serviceId);
            if (service == null)
                return NotFound(new { error = "Service non trouvé" });

            // Convert to Service DTO
            var perms = dto.Permissions.Select(p => new WebApplication1.Services.ServicePermissionUpdateDto
            {
                PermissionKey = p.PermissionKey,
                Enabled = p.Enabled
            }).ToList();

            await _permissionService.UpdateServicePermissionsAsync(serviceId, perms);
            return Ok(new { message = "Permissions mises à jour avec succès" });
        }

        /// <summary>
        /// Get all services with their permission summary.
        /// </summary>
        [HttpGet("matrix")]
        [RequirePermission("gerer_permissions")]
        public async Task<IActionResult> GetMatrix()
        {
            var services = await _context.RbacServices.OrderBy(s => s.Nom).ToListAsync();
            var allPermissions = await _context.Permissions.OrderBy(p => p.Key).ToListAsync();
            var allServicePerms = await _context.ServicePermissions.ToListAsync();

            var spDict = allServicePerms
                .GroupBy(sp => sp.ServiceId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Where(sp => sp.Enabled).Select(sp => sp.PermissionKey).ToHashSet()
                );

            return Ok(new
            {
                services = services.Select(s => new
                {
                    s.Id,
                    s.Nom,
                    s.Code,
                    permissions = spDict.TryGetValue(s.Id, out var perms) ? perms.ToList() : new List<string>()
                }),
                allPermissions = allPermissions.Select(p => new
                {
                    p.Key,
                    p.LabelFr,
                    p.LabelAr,
                    p.Category
                })
            });
        }

        /// <summary>
        /// GET api/rbac/permissions/admin — get admin permission overrides.
        /// </summary>
        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAdminOverrides()
        {
            // Get all permissions
            var allPermissions = await _context.Permissions.ToListAsync();

            // Get admin overrides
            var overrides = await _context.AdminPermissionOverrides.ToListAsync();
            var overrideDict = overrides.ToDictionary(o => o.PermissionKey, o => o.Enabled);

            // For admin: all permissions are allowed by default, overrides can disable them
            var result = allPermissions.Select(p => new
            {
                PermissionKey = p.Key,
                p.LabelFr,
                p.LabelAr,
                p.Category,
                Enabled = overrideDict.TryGetValue(p.Key, out var enabled) ? enabled : true
            }).OrderBy(p => p.Category).ThenBy(p => p.PermissionKey);

            return Ok(new { permissions = result });
        }

        /// <summary>
        /// PUT api/rbac/permissions/admin — update admin permission overrides.
        /// </summary>
        [HttpPut("admin")]
        [RequirePermission("gerer_permissions")]
        public async Task<IActionResult> UpdateAdminOverrides([FromBody] AdminPermissionUpdateRequest request)
        {
            if (request?.Permissions == null)
                return BadRequest(new { error = "Données invalides" });

            // Remove all existing overrides
            var existing = await _context.AdminPermissionOverrides.ToListAsync();
            _context.AdminPermissionOverrides.RemoveRange(existing);

            // Only store overrides for permissions that are explicitly disabled
            // (Enabled permissions don't need an override since admin gets all by default)
            foreach (var update in request.Permissions.Where(u => !u.Enabled))
            {
                // Validate that the permission key exists
                var permExists = await _context.Permissions.AnyAsync(p => p.Key == update.PermissionKey);
                if (!permExists)
                    continue; // Skip invalid permission keys

                _context.AdminPermissionOverrides.Add(new AdminPermissionOverride
                {
                    PermissionKey = update.PermissionKey,
                    Enabled = false
                });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Permissions administrateur mises à jour avec succès" });
        }
    }

    public class AdminPermissionUpdateRequest
    {
        public List<AdminPermissionUpdateDto> Permissions { get; set; } = new();
    }

    public class UpdateServicePermissionsDto
    {
        public List<ServicePermissionUpdateDto> Permissions { get; set; } = new();
    }

    public class ServicePermissionUpdateDto
    {
        [JsonPropertyName("permissionKey")]
        public string PermissionKey { get; set; } = string.Empty;

        [JsonPropertyName("enabled")]
        public bool Enabled { get; set; }
    }

    public class AdminPermissionUpdateDto
    {
        [JsonPropertyName("permissionKey")]
        public string PermissionKey { get; set; } = string.Empty;

        [JsonPropertyName("enabled")]
        public bool Enabled { get; set; }
    }
}