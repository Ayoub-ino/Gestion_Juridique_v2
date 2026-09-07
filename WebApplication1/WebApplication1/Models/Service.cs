using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class Service
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Nom { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty; // e.g. "bureauordre"

        [MaxLength(200)]
        public string? Description { get; set; }

        public int? ParentId { get; set; }
        public Service? Parent { get; set; }
        public ICollection<Service> Children { get; set; } = new List<Service>();
        public ICollection<ServicePermission> ServicePermissions { get; set; } = new List<ServicePermission>();

        // Soft delete
        public bool IsActive { get; set; } = true;
        public DateTime? DeletedAt { get; set; }
    }
}
