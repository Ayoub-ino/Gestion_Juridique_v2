using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    public class PermissionService
    {
        private readonly AppDbContext _context;

        public PermissionService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Check if a user has a specific permission.
        /// Admin gets all permissions EXCEPT creer_modifier, transferer, and notification actions.
        /// </summary>
        public async Task<bool> HasPermissionAsync(int userId, string permissionKey)
        {
            var user = await _context.Utilisateurs.FindAsync(userId);
            if (user == null) return false;

            // Admin bypass — check dynamic overrides
            if (user.Role == "Admin")
            {
                var override_ = await _context.AdminPermissionOverrides
                    .FirstOrDefaultAsync(ap => ap.PermissionKey == permissionKey);
                if (override_ != null)
                    return override_.Enabled;

                // Default: admin gets all permissions
                return true;
            }

            // User must have a service
            if (user.ServiceId == null) return false;

            return await _context.ServicePermissions
                .AnyAsync(sp => sp.ServiceId == user.ServiceId.Value
                             && sp.PermissionKey == permissionKey
                             && sp.Enabled);
        }

        /// <summary>
        /// Get all enabled permission keys for a user.
        /// </summary>
        public async Task<List<string>> GetUserPermissionsAsync(int userId)
        {
            var user = await _context.Utilisateurs.FindAsync(userId);
            if (user == null) return new List<string>();

            // Admin gets all permissions, with dynamic overrides
            if (user.Role == "Admin")
            {
                var allPerms = await _context.Permissions.Select(p => p.Key).ToListAsync();
                var overrides = await _context.AdminPermissionOverrides.ToListAsync();
                var overrideDict = overrides.ToDictionary(o => o.PermissionKey, o => o.Enabled);

                return allPerms.Where(p =>
                {
                    if (overrideDict.TryGetValue(p, out var enabled))
                        return enabled;
                    return true; // Default: allowed
                }).ToList();
            }

            if (user.ServiceId == null) return new List<string>();

            return await _context.ServicePermissions
                .Where(sp => sp.ServiceId == user.ServiceId.Value && sp.Enabled)
                .Select(sp => sp.PermissionKey)
                .ToListAsync();
        }

        /// <summary>
        /// Get all permissions with their enabled status for a service.
        /// </summary>
        public async Task<List<PermissionDto>> GetServicePermissionsAsync(int serviceId)
        {
            var allPermissions = await _context.Permissions.ToListAsync();
            var servicePerms = await _context.ServicePermissions
                .Where(sp => sp.ServiceId == serviceId)
                .ToListAsync();

            var spDict = servicePerms.ToDictionary(sp => sp.PermissionKey, sp => sp.Enabled);

            return allPermissions.Select(p => new PermissionDto
            {
                Key = p.Key,
                LabelFr = p.LabelFr,
                LabelAr = p.LabelAr,
                Description = p.Description,
                Category = p.Category,
                Enabled = spDict.TryGetValue(p.Key, out var enabled) ? enabled : false
            }).ToList();
        }

        /// <summary>
        /// Update permissions for a service. Replaces all permissions.
        /// </summary>
        public async Task UpdateServicePermissionsAsync(int serviceId, List<ServicePermissionUpdateDto> updates)
        {
            var existing = await _context.ServicePermissions
                .Where(sp => sp.ServiceId == serviceId)
                .ToListAsync();

            _context.ServicePermissions.RemoveRange(existing);

            // Only insert permissions with non-empty keys to avoid unique constraint violations
            var enabledUpdates = updates
                .Where(u => u.Enabled && !string.IsNullOrWhiteSpace(u.PermissionKey))
                .GroupBy(u => u.PermissionKey)  // deduplicate by key
                .Select(g => g.First())
                .ToList();

            foreach (var update in enabledUpdates)
            {
                _context.ServicePermissions.Add(new ServicePermission
                {
                    ServiceId = serviceId,
                    PermissionKey = update.PermissionKey,
                    Enabled = true
                });
            }

            await _context.SaveChangesAsync();
        }
    }
}

namespace WebApplication1.Services
{
    public class PermissionDto
    {
        public string Key { get; set; } = string.Empty;
        public string LabelFr { get; set; } = string.Empty;
        public string LabelAr { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Category { get; set; } = string.Empty;
        public bool Enabled { get; set; }
    }

    public class ServicePermissionUpdateDto
    {
        public string PermissionKey { get; set; } = string.Empty;
        public bool Enabled { get; set; }
    }
}
