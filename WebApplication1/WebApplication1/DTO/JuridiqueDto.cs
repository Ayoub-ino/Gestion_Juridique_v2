using System.Text.Json.Serialization;

namespace WebApplication1.DTO
{
    public class JuridiqueDto
    {
        // Ces propriétés correspondent au JSON envoyé par le frontend

        public string Provenance { get; set; } = string.Empty;
        public string Reference { get; set; } = string.Empty;
        public string Objet { get; set; } = string.Empty;
        public string? FichierUrl { get; set; }
        public string Circuit { get; set; } = string.Empty;              // "maktab_dabt" ou "kitaba_khasa"
        public string? ExceptionType { get; set; }       // pour kitaba_khasa
        public string? JalsatTransaction { get; set; }   // "ijra2_baht", "moufawad", "khibra", "moqarir"
        public string? TaslimTransaction { get; set; }   // "tabligh", "tasfiya", "archive"
        public string? RetraitArchive { get; set; }      // "ra2is_kitaba", "mustachar_moqarir", "ra2is_awal"
        public int EtapeService { get; set; }            // 1 à 4 (non-nullable)
    }
}
