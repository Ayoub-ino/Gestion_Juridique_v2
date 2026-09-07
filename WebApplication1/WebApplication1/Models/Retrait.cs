using System;
using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class Retrait
    {
        public int Id { get; set; }

        [Required]
        public int DocumentId { get; set; }
        public Document Document { get; set; } = null!;

        [Required]
        public string Reference { get; set; } = string.Empty;

        public string EffectuePar { get; set; } = string.Empty;

        [Required]
        public string MotifRetrait { get; set; } = string.Empty;

        public string Notes { get; set; } = string.Empty;

        public DateTime DateRetrait { get; set; } = DateTime.Now;

        public DateTime? DateRetour { get; set; }

        public bool EstAnnule { get; set; } = false;

        public string ServiceArchives { get; set; } = string.Empty;
    }
}
