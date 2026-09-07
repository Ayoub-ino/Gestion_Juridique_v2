using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class AdminPermissionOverride
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string PermissionKey { get; set; } = string.Empty;
        
        public bool Enabled { get; set; }
    }
}
