using System;

namespace WebApplication1.Models
{
    public class Transaction
    {
        public int Id { get; set; }

        public int DocumentId { get; set; }
        public Document Document { get; set; } = null!;

        public ServiceTribunal ServiceOrigine { get; set; }
        public ServiceTribunal ServiceDestination { get; set; }

        public DateTime DateTransaction { get; set; } = DateTime.Now;
        public string? Remarques { get; set; }
        public string? UtilisateurId { get; set; }
        public int? CourrierAdminId { get; set; }
        public string? StatutEtape { get; set; }
        public int? ServiceDestinataireId { get; set; }
        public int? AgentDestinataireId { get; set; }
        public string? NomPersonneExterne { get; set; }

        public StatutTransaction Statut { get; set; } = StatutTransaction.EnAttente;
        public string? Commentaire { get; set; }
        public string? MotifRefus { get; set; }
        public bool DoitRevenir { get; set; }

        // Target user for transfer (optional)
        public int? TargetUserId { get; set; }
        public Utilisateur? TargetUser { get; set; }

        // Previous document status before transfer (for rollback)
        public StatutDossier? StatutPrecedent { get; set; }

        // Historique service support: stores the code of a historical service
        // When set, this transaction was routed to a historical (record-only) entity
        // that does not have login credentials — the transfer is auto-accepted.
        public string? HistoricalServiceCode { get; set; }

        // ── Dynamic service routing codes ──
        // RBAC service codes (Service.Code) for origin and destination.
        // These supersede ServiceOrigine/ServiceDestination, which are backed by
        // the fixed ServiceTribunal enum and cannot represent services created
        // dynamically from the admin panel. Null for legacy rows — callers fall
        // back to the enum in that case.
        public string? ServiceOrigineCode { get; set; }
        public string? ServiceDestinationCode { get; set; }
    }
}
