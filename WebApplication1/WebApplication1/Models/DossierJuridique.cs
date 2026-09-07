using System;

namespace WebApplication1.Models
{
    public class DossierJuridique : Document
    {
        // Propriétés SPECIFIQUES (hérite tout le reste de Document)
        public string? NumeroDossierJuridique { get; set; }
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