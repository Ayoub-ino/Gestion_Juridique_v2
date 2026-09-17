using System;

namespace WebApplication1.Models
{
    public class DossierJuridique : Document
    {
        // Propriétés SPECIFIQUES (hérite tout le reste de Document)
        public string? NumeroDossierJuridique { get; set; }

        /// <summary>Numéro de première instance du dossier.</summary>
        public string? NumeroPremiereInstance { get; set; }

        /// <summary>Type de dossier ("Type" in the business model).</summary>
        public string? TypeDossier { get; set; }

        /// <summary>Type of the linked document, when this row is a "document lié".</summary>
        public string? LinkedDocumentType { get; set; }

        /// <summary>
        /// Dossier parent — set when this row is a "document lié" attached to an
        /// already-created folder. A linked document shares its parent's
        /// identification number (NumeroReference); this is the only case where
        /// two dossiers may carry the same reference.
        /// </summary>
        public int? DossierParentId { get; set; }
        public string? TypeCircuit { get; set; }        // "classique" ou "exception"
        public string? MotifException { get; set; }     // "islah", "mousaada", "ikhtissas"
        public string Demandeur { get; set; } = string.Empty;
        public DateTime DateEntree { get; set; } = DateTime.Now;
        public string EtapeJalsatActuelle { get; set; } = string.Empty;
        public string EtatGlobal { get; set; } = string.Empty;

        // NOUVEAUX CHAMPS pour le workflow (ceux que vous vouliez ajouter)
        public string? Circuit { get; set; }                // "maktab_dabt" ou "kitaba_khasa"
        public int EtapeService { get; set; }               // 1 à 4
        public string? JalsatTransaction { get; set; }      // "moufawad", "khibra", "moqarir"
        public string? TaslimTransaction { get; set; }      // "tabligh", "tasfiya", "archive"
        public string? AutoriteRetrait { get; set; }        // "ra2is_kitaba", etc.
    }
}