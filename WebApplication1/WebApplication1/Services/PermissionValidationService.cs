using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    public class PermissionValidationService
    {
        private readonly AppDbContext _context;
        private readonly PermissionService _permissionService;

        public PermissionValidationService(AppDbContext context, PermissionService permissionService)
        {
            _context = context;
            _permissionService = permissionService;
        }

        /// <summary>
        /// Comprehensive permission validation for API endpoints
        /// </summary>
        public async Task<PermissionResult> ValidatePermissionAsync(int userId, string permissionKey, HttpContext httpContext)
        {
            var user = await _context.Utilisateurs.FindAsync(userId);
            if (user == null) 
                return PermissionResult.Denied("User not found");

            // Get user's permissions from the database (includes admin overrides)
            var userPermissions = await _permissionService.GetUserPermissionsAsync(userId);
            
            // Check if user has the specific permission
            if (!userPermissions.Contains(permissionKey))
                return PermissionResult.Denied($"Permission '{permissionKey}' not granted for user");

            // Additional security checks for sensitive operations
            if (IsSensitiveOperation(permissionKey, user))
            {
                var additionalCheck = await ValidateSensitiveOperationAsync(userId, permissionKey, user);
                if (!additionalCheck.IsAllowed)
                    return additionalCheck;
            }

            // Log permission validation for audit
            await LogPermissionValidation(userId, permissionKey, httpContext);

            return PermissionResult.Allowed();
        }

        /// <summary>
        /// Validate sensitive operations with additional checks
        /// </summary>
        private async Task<PermissionResult> ValidateSensitiveOperationAsync(int userId, string permissionKey, Utilisateur user)
        {
            // Admin-specific checks
            if (user.Role == "Admin")
            {
                // Check if this permission is overridden for admin
                // (NOTE: variable named 'permissionOverride' because 'override' is a C# keyword)
                var permissionOverride = await _context.AdminPermissionOverrides
                    .FirstOrDefaultAsync(ap => ap.PermissionKey == permissionKey);
                
                if (permissionOverride != null && !permissionOverride.Enabled)
                    return PermissionResult.Denied($"Admin override disabled permission '{permissionKey}'");
            }

            // Service-specific checks for non-admin users
            if (user.Role != "Admin" && user.ServiceId.HasValue)
            {
                var servicePermission = await _context.ServicePermissions
                    .FirstOrDefaultAsync(sp => sp.ServiceId == user.ServiceId.Value && sp.PermissionKey == permissionKey);
                
                if (servicePermission == null || !servicePermission.Enabled)
                    return PermissionResult.Denied($"Service does not have permission '{permissionKey}'");
            }

            return PermissionResult.Allowed();
        }

        /// <summary>
        /// Identify sensitive operations that require additional validation
        /// </summary>
        private bool IsSensitiveOperation(string permissionKey, Utilisateur user)
        {
            var sensitivePermissions = new[]
            {
                "creer_modifier", "transferer", "supprimer", "restaurer", "archiver",
                "creer_courrier_admin", "creer_courrier_juridique", "ouvrir_dossier",
                "cloturer", "transferer_juridique", "retrait_archive", "recherche_avancee",
                "export_excel", "export_word", "gerer_utilisateurs", "gerer_services",
                "gerer_permissions", "gerer_equipements", "gerer_listes", "gerer_substituts",
                "ajouter_notes"
            };

            return sensitivePermissions.Contains(permissionKey) || 
                   (user.Role == "Admin" && IsAdminRestrictedPermission(permissionKey));
        }

        /// <summary>
        /// Check if permission is restricted for admin users
        /// </summary>
        private bool IsAdminRestrictedPermission(string permissionKey)
        {
            var adminRestrictedPermissions = new[]
            {
                "creer_modifier", "transferer", "supprimer", "restaurer", "archiver",
                "creer_courrier_admin", "creer_courrier_juridique", "ouvrir_dossier",
                "cloturer", "transferer_juridique", "retrait_archive", "recherche_avancee",
                "export_excel", "export_word", "ajouter_notes"
            };

            return adminRestrictedPermissions.Contains(permissionKey);
        }

        /// <summary>
        /// Log permission validation for audit purposes
        /// </summary>
        private async Task LogPermissionValidation(int userId, string permissionKey, HttpContext httpContext)
        {
            // Implementation for logging permission validation
            // This could write to a database table or external logging system
            var logEntry = new PermissionValidationLog
            {
                UserId = userId,
                UtilisateurId = userId,
                PermissionKey = permissionKey,
                Endpoint = httpContext.Request.Path.Value ?? "",
                Method = httpContext.Request.Method,
                Timestamp = DateTime.UtcNow,
                IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = httpContext.Request.Headers["User-Agent"].ToString()
            };
            
            _context.PermissionValidationLogs.Add(logEntry);
            await _context.SaveChangesAsync();
        }
    }
}

namespace WebApplication1.Services
{
    public class PermissionResult
    {
        public bool IsAllowed { get; set; }
        public string Reason { get; set; } = string.Empty;

        public static PermissionResult Allowed() => new PermissionResult { IsAllowed = true, Reason = string.Empty };
        public static PermissionResult Denied(string reason) => new PermissionResult { IsAllowed = false, Reason = reason };
    }
}

namespace WebApplication1.Models
{
    public class PermissionValidationLog
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int UtilisateurId { get; set; }
        public string PermissionKey { get; set; } = string.Empty;
        public string Endpoint { get; set; } = string.Empty;
        public string Method { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public Utilisateur? Utilisateur { get; set; }
    }
}