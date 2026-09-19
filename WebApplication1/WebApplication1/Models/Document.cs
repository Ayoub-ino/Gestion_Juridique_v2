using System;
using System.Collections.Generic;

namespace WebApplication1.Models
{
    public class Document
    {
        public int Id { get; set; }

        // C'est d'ici que CourrierAdministratif tire ces informations :
        public string NumeroReference { get; set; } = string.Empty;
        public string Sujet { get; set; } = string.Empty;
        public DateTime DateCreation { get; set; } = DateTime.Now;

        public ServiceTribunal ServiceActuel { get; set; }

        /// <summary>
        /// RBAC service code of the service currently holding the document.
        /// Preferred over <see cref="ServiceActuel"/> because it can represent
        /// dynamically-created services (which have no enum equivalent).
        /// Null for legacy rows — callers fall back to the enum in that case.
        /// </summary>
        public string? ServiceActuelCode { get; set; }

        public StatutDossier StatutActuel { get; set; }

        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
        public string NumeroBureauOrdre { get; set; } = string.Empty;
        public string Objet { get; set; } = string.Empty;

        /// <summary>
        /// Notes libres saisies au formulaire.
        /// Déclaré sur la classe de base : en TPH, deux types frères ne peuvent
        /// pas déclarer la même propriété, et toutes les catégories de courrier
        /// doivent partager une seule colonne « Notes ».
        /// </summary>
        public string? Notes { get; set; }

        // Suppression logique
        public bool EstSupprime { get; set; } = false;

        // Fichier joint
        public string? FilePath { get; set; }
    }

}