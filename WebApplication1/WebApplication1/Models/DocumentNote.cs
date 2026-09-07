using System;

namespace WebApplication1.Models
{
    public class DocumentNote
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public Document Document { get; set; } = null!;
        public string Contenu { get; set; } = string.Empty;
        public string? Auteur { get; set; }
        public string? Service { get; set; }
        public DateTime DateCreation { get; set; } = DateTime.Now;
        public DateTime? DateModification { get; set; }
    }
}
