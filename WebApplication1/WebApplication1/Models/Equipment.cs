namespace WebApplication1.Models
{
    public class Equipment
    {
        public int Id { get; set; }
        public string Serial { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Etat { get; set; } = string.Empty;
        public string Service { get; set; } = string.Empty;
        public bool EstCharge { get; set; } = true;
        public DateTime? DateDechargement { get; set; }
        public DateTime DateCreation { get; set; } = DateTime.Now;

        // New fields
        public string? NumeroInventaire { get; set; }
        public string? Bureau { get; set; }
    }
}
