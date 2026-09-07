
using System.ComponentModel.DataAnnotations;

namespace WebApplication1.DTO
{
    public class SortantDto
    {
        public string Destinataire { get; set; } = string.Empty;      // Destinataire externe
        [Required]
        public string Reference { get; set; } = string.Empty;         // Numéro de référence
        [Required]
        public string Objet { get; set; } = string.Empty;             // Objet du courrier
        public string TypeSortant { get; set; } = string.Empty;       // "normal" ou "demande"
        public DateTime? DateEnvoi { get; set; }      // Optionnel
        public string? NumeroEnvoi { get; set; }      // Optionnel
        public string? TribunalOrigine { get; set; }   // Tribunal d'origine
        public string? TribunalDestination { get; set; } // Tribunal de destination
    }
}