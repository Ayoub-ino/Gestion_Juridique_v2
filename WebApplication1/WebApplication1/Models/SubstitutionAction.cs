using System;
using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    /// <summary>
    /// Audit trail of every action a substitute performed while covering an absent
    /// agent. This is what makes a delegation traceable: it records who acted and
    /// on whose behalf, which the paper register could not do.
    /// </summary>
    public class SubstitutionAction
    {
        public int Id { get; set; }

        /// <summary>The user who actually performed the action (the substitute).</summary>
        [Required]
        public int EffectueParUserId { get; set; }

        /// <summary>The absent agent whose folders were being handled.</summary>
        [Required]
        public int PourUserId { get; set; }

        /// <summary>Short label of what was done (modification, transfert, archivage...).</summary>
        [Required]
        public string Action { get; set; } = string.Empty;

        public int? DocumentId { get; set; }

        public string Reference { get; set; } = string.Empty;

        public DateTime DateAction { get; set; } = DateTime.Now;
    }
}
