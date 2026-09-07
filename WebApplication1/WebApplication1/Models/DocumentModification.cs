using System;

namespace WebApplication1.Models
{
    public class DocumentModification
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public Document Document { get; set; } = null!;
        public string Champ { get; set; } = string.Empty;
        public string? AncienneValeur { get; set; }
        public string? NouvelleValeur { get; set; }
        public string? Utilisateur { get; set; }
        public string? Service { get; set; }
        public DateTime DateModification { get; set; } = DateTime.Now;
    }
}
