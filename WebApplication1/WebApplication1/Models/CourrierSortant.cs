using System;

namespace WebApplication1.Models
{
    public class CourrierSortant : Document
    {
        // Destinataire externe (personne ou institution)
        public string DestinataireExterne { get; set; } = string.Empty;

        // Type de sortant : "normal" ou "demande"
        public string TypeSortant { get; set; } = string.Empty;  // "normal" ou "demande"

        // Date d'envoi (peut être différente de DateCreation)
        public DateTime DateEnvoi { get; set; } = DateTime.Now;

        // Référence de l'envoi (ex: numéro d'ordre)
        public string NumeroEnvoi { get; set; } = string.Empty;

        // Tribunal d'origine (mahkama d'émission)
        public string TribunalOrigine { get; set; } = string.Empty;

        // Tribunal de destination (mahkama destinataire)
        public string TribunalDestination { get; set; } = string.Empty;
    }
}