using WebApplication1.Models;

namespace WebApplication1.Helpers
{
    public static class ServiceMapper
    {
        /// <summary>
        /// Canonical form used to compare service codes coming from different
        /// sources (RBAC Service.Code, Utilisateur.Service, Document.ServiceActuelCode).
        /// Lowercases, trims, and drops spaces/dashes/underscores.
        /// Keeps '&amp;' so codes such as "seances&amp;procedures" survive intact.
        /// </summary>
        public static string NormalizeServiceCode(string? code)
        {
            if (string.IsNullOrWhiteSpace(code)) return string.Empty;
            return code.Trim().ToLowerInvariant().Replace(" ", "").Replace("-", "").Replace("_", "");
        }

        /// <summary>
        /// Resolve the RBAC service code that currently holds a document.
        /// Prefers the explicit code (works for dynamic services) and falls back
        /// to mapping the legacy enum value for rows created before that column existed.
        /// </summary>
        public static string ResolveDocumentServiceCode(Document document)
        {
            if (!string.IsNullOrWhiteSpace(document.ServiceActuelCode))
                return NormalizeServiceCode(document.ServiceActuelCode);
            return Services.DocumentAccessService.ServiceTribunalToRbacCode(document.ServiceActuel);
        }

        /// <summary>
        /// Try to map a service name/code to a ServiceTribunal enum value.
        /// Returns true if a mapping exists; false means the service is unknown
        /// and should NOT fall back to BureauOrdre (which would leak data).
        /// </summary>
        public static bool TryMapToServiceEnum(string serviceName, out ServiceTribunal result)
        {
            if (Enum.TryParse<ServiceTribunal>(serviceName, true, out result))
                return true;

            // Use nullable to detect unmatched cases (BureauOrdre == 0 == default)
            ServiceTribunal? mapped = serviceName switch
            {
                // --- RBAC service codes (seeded in RbacServices, stored in Utilisateur.Service) ---
                "bureauordre" => ServiceTribunal.BureauOrdre,
                "fathmilafat" => ServiceTribunal.OuvertureDossier,
                "secretarait" => ServiceTribunal.KitabaKhasa,
                "seances&procedures" => ServiceTribunal.JalsatWaIjra2at,
                "khibra" => ServiceTribunal.Khibra,
                "taslimnosakh" => ServiceTribunal.TaslimNusakh,
                "tasfiatSawa2irTakmilia" => ServiceTribunal.TasfiyatSawa2ir,
                "archive" => ServiceTribunal.Archive,
                "atabligh" => ServiceTribunal.Tabligh,

                // --- Legacy French service names (pre-RBAC) ---
                "Bureau d'ordre et bureau administratif" => ServiceTribunal.BureauOrdre,
                "Bureau de Gestion des Dossiers Judiciaires" => ServiceTribunal.OuvertureDossier,
                "KitabaKhasa" => ServiceTribunal.KitabaKhasa,
                "JalsatWaIjra2at" => ServiceTribunal.JalsatWaIjra2at,
                "TaslimNusakh" => ServiceTribunal.TaslimNusakh,
                "Bureau de Notification" => ServiceTribunal.BureauNotification,
                "Archive" => ServiceTribunal.Archive,
                "Bureau d'expertise" => ServiceTribunal.BureauExpertise,
                "Bureau des procédures du commissaire royal" => ServiceTribunal.ProcduresCommissaireRoyal,
                "Bureau de Gestion des Pourvois en Cassation" => ServiceTribunal.GestionPourvoisCassation,
                "Remise de copie de jugement" => ServiceTribunal.RemiseCopieJugement,
                "Bureau de Recouvrement" => ServiceTribunal.BureauRecouvrement,
                "Caisse du Tribunal" => ServiceTribunal.CaisseTribunal,
                "Service de Gestion Financière" => ServiceTribunal.GestionFinanciere,
                "Bureau de l'efficacité judiciaire et des statistiques" => ServiceTribunal.EfficaciteJudiciaire,
                "Cellule informatique" => ServiceTribunal.CelluleInformatique,
                "Direction" => ServiceTribunal.Direction,
                "Greffe" => ServiceTribunal.Greffe,
                _ => (ServiceTribunal?)null
            };

            if (mapped.HasValue)
            {
                result = mapped.Value;
                return true;
            }

            result = default;
            return false;
        }

        /// <summary>
        /// Map a service name to its enum value. For truly unknown codes,
        /// returns default via TryMapToServiceEnum so callers can handle the
        /// "no matching service" case gracefully (return empty results)
        /// instead of leaking BureauOrdre data.
        /// </summary>
        public static ServiceTribunal MapToServiceEnum(string serviceName)
        {
            if (TryMapToServiceEnum(serviceName, out var result))
                return result;

            // Unknown code: still return a value for backward compat,
            // but callers should prefer TryMapToServiceEnum for proper scoping.
            return result;
        }

        public static bool TryParseUserId(string? userIdStr, out int userId)
        {
            userId = 0;
            return userIdStr != null && int.TryParse(userIdStr, out userId);
        }
    }
}
