namespace WebApplication1.Models
{
    public class Utilisateur
    {
        public int Id { get; set; }
        public string Login { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Nom { get; set; } = string.Empty;

        // Legacy fields (kept for backward compat during migration)
        public string? Role { get; set; }
        public string? Service { get; set; }

        // New RBAC: user belongs to a service, inherits its permissions
        public int? ServiceId { get; set; }
        public Service? ServiceEntity { get; set; }

        // Soft delete
        public bool IsActive { get; set; } = true;
        public DateTime? DeletedAt { get; set; }
    }
}