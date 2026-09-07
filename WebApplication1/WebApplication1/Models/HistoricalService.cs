using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class HistoricalService
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Nom { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Description { get; set; }

        public int? ParentId { get; set; }
        public HistoricalService? Parent { get; set; }
        public ICollection<HistoricalService> Children { get; set; } = new List<HistoricalService>();

        public int SortOrder { get; set; } = 0;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}