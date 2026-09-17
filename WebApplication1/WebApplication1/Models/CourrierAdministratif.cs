using System;

namespace WebApplication1.Models
{
    public class CourrierAdministratif : Document
    {
        public string NumeroOrdre { get; set; } = string.Empty;
        public string Expediteur { get; set; } = string.Empty;
        public DateTime DateReception { get; set; } = DateTime.Now;
        public string TypeCircuit { get; set; } = string.Empty;
        public bool Transmissible { get; set; } = true;

        // ── Champs "Gérer les courriers" ──
        /// <summary>Source (émetteur/origine) du courrier.</summary>
        public string? Source { get; set; }
        /// <summary>Date du message (distincte de la date d'arrivée).</summary>
        public DateTime? DateMessage { get; set; }
        /// <summary>État du courrier tel que saisi dans le formulaire.</summary>
        public string? Etat { get; set; }
        public string? Notes { get; set; }
    }
}