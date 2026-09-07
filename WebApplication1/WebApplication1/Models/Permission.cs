using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class Permission
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Key { get; set; } = string.Empty; // e.g. "transferer"

        [Required]
        [MaxLength(100)]
        public string LabelFr { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string LabelAr { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Description { get; set; }

        [MaxLength(50)]
        public string Category { get; set; } = string.Empty; // e.g. "documents", "admin"

        public bool DefaultEnabled { get; set; } = false;
    }
}
