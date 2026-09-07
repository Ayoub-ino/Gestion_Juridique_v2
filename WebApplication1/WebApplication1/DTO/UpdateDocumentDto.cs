namespace WebApplication1.DTO
{
    public class UpdateDocumentDto
    {
        public string? NumeroOrdre { get; set; }
        public string? Expediteur { get; set; }
        public string? Objet { get; set; }
        public string? Sujet { get; set; }
        public string? TypeCircuit { get; set; }
        public string? Demandeur { get; set; }
        public string? EtatGlobal { get; set; }
        public string? EtapeJalsatActuelle { get; set; }
        public string? Circuit { get; set; }
        public string? MotifException { get; set; }
        public string? JalsatTransaction { get; set; }
        public string? TaslimTransaction { get; set; }
        public string? AutoriteRetrait { get; set; }
        public string? DestinataireExterne { get; set; }
        public string? TribunalOrigine { get; set; }
        public string? TribunalDestination { get; set; }
    }
}
