using System;

namespace WebApplication1.Models
{
    /// <summary>
    /// Per-document access control record. Tracks which service has what
    /// level of access to a specific document — enabling post-transfer
    /// modification rights for both sender and recipient services.
    /// </summary>
    public class DocumentAccess
    {
        public int Id { get; set; }

        public int DocumentId { get; set; }
        public Document Document { get; set; } = null!;

        /// <summary>
        /// Service code (e.g. "bureauordre", "archive") that has been granted access.
        /// </summary>
        public string ServiceCode { get; set; } = string.Empty;

        /// <summary>
        /// Access level: Owner (creator), Editor (can modify), Viewer (read-only).
        /// </summary>
        public DocumentAccessLevel AccessLevel { get; set; } = DocumentAccessLevel.Viewer;

        /// <summary>
        /// The user who granted this access (nullable for system-granted).
        /// </summary>
        public int? GrantedByUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public enum DocumentAccessLevel
    {
        Viewer = 0,
        Editor = 1,
        Owner = 2
    }
}
