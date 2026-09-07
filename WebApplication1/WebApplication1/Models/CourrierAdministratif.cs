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
    }
}