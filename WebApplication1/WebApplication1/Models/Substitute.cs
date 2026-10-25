using System;
using System.Collections.Generic;

namespace WebApplication1.Models
{
    /// <summary>
    /// An absence delegation: <see cref="UserId"/> designates
    /// <see cref="SubstituteUserId"/> to handle their work for a bounded period.
    ///
    /// Lifecycle (see <see cref="SubstitutionStatusConstants"/>):
    ///   EnAttente → Accepte → Termine
    ///             ↘ Refuse
    ///   Accepte   → Revoque (the absent agent stops it early)
    /// A delegation only grants anything once the substitute has accepted it *and*
    /// the current time is inside [DateDebut, DateFin].
    /// </summary>
    public class Substitute
    {
        public int Id { get; set; }

        /// <summary>The absent agent whose work is delegated.</summary>
        public int UserId { get; set; }

        /// <summary>The agent who covers that work.</summary>
        public int SubstituteUserId { get; set; }

        public DateTime DateAssignation { get; set; } = DateTime.Now;

        /// <summary>Start of the delegation period.</summary>
        public DateTime DateDebut { get; set; } = DateTime.Now;

        /// <summary>
        /// End of the delegation period. Past it the delegation no longer grants
        /// anything and the substitute loses the workspace tab.
        /// </summary>
        public DateTime? DateFin { get; set; }

        public DateTime? DateRevocation { get; set; }

        /// <summary>When the substitute accepted the invitation.</summary>
        public DateTime? DateAcceptation { get; set; }

        /// <summary>Reason given by the substitute when they decline.</summary>
        public string? MotifRefus { get; set; }

        /// <summary>One of <see cref="SubstitutionStatusConstants"/>.</summary>
        public string Statut { get; set; } = SubstitutionStatusConstants.EnAttente;

        /// <summary>
        /// True while the delegation actually grants the substitute access — i.e.
        /// accepted, not closed, and inside the period. Kept as the single flag the
        /// access checks read so they cannot drift from the status machine.
        /// </summary>
        public bool IsActive { get; set; }
    }

    public static class SubstitutionStatusConstants
    {
        public const string EnAttente = "EnAttente";
        public const string Accepte = "Accepte";
        public const string Refuse = "Refuse";
        public const string Revoque = "Revoque";
        public const string Termine = "Termine";

        /// <summary>Labels shown in the profile history, French first.</summary>
        public static IReadOnlyDictionary<string, string> LabelsFr { get; } = new Dictionary<string, string>
        {
            [EnAttente] = "En attente d'acceptation",
            [Accepte] = "Acceptée",
            [Refuse] = "Refusée",
            [Revoque] = "Arrêtée par l'agent",
            [Termine] = "Terminée (période écoulée)"
        };
    }
}
