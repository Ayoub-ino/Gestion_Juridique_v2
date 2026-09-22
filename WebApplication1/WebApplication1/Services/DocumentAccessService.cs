using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Centralized service for document access control (ACL).
    /// Manages who has what level of access to each document,
    /// enabling post-transfer modification rights.
    /// </summary>
    public class DocumentAccessService
    {
        private readonly AppDbContext _context;
        private readonly SubstitutionService _substitutions;

        public DocumentAccessService(AppDbContext context, SubstitutionService substitutions)
        {
            _context = context;
            _substitutions = substitutions;
        }

        /// <summary>
        /// Grant Owner access to a service when a document is first created.
        /// Idempotent: if the row already exists, it updates the access level.
        /// </summary>
        public async Task GrantOwnerAsync(int documentId, string serviceCode, int? grantedByUserId = null)
        {
            await UpsertAccessAsync(documentId, serviceCode, DocumentAccessLevel.Owner, grantedByUserId);
        }

        /// <summary>
        /// Grant Editor access to a service when a document is transferred.
        /// The source service retains Editor access; the destination gets Editor access.
        /// </summary>
        public async Task GrantEditorAsync(int documentId, string serviceCode, int? grantedByUserId = null)
        {
            await UpsertAccessAsync(documentId, serviceCode, DocumentAccessLevel.Editor, grantedByUserId);
        }

        /// <summary>
        /// Revoke all access for a service on a document.
        /// </summary>
        public async Task RevokeAccessAsync(int documentId, string serviceCode)
        {
            var existing = await _context.DocumentAccesses
                .FirstOrDefaultAsync(da => da.DocumentId == documentId && da.ServiceCode == serviceCode);

            if (existing != null)
            {
                _context.DocumentAccesses.Remove(existing);
                await _context.SaveChangesAsync();
            }
        }

        /// <summary>
        /// Check if a user's service has at least the required access level on a document.
        /// Owner always has Editor and Viewer access. Editor always has Viewer access.
        /// Admin/Greffier/Directeur/Consultant roles bypass ACL checks.
        /// </summary>
        public async Task<bool> HasAccessAsync(int documentId, string serviceCode, DocumentAccessLevel requiredLevel)
        {
            var access = await _context.DocumentAccesses
                .FirstOrDefaultAsync(da => da.DocumentId == documentId && da.ServiceCode == serviceCode);

            if (access == null) return false;

            // Owner >= Editor >= Viewer
            return access.AccessLevel >= requiredLevel;
        }

        /// <summary>
        /// Check if a user (by userId) has at least the required access level on a document.
        /// Resolves the user's service code automatically.
        /// Admin/Greffier/Directeur/Consultant roles bypass ACL checks.
        /// </summary>
        public async Task<bool> UserHasAccessAsync(int documentId, int userId, DocumentAccessLevel requiredLevel)
        {
            var user = await _context.Utilisateurs.FindAsync(userId);
            if (user == null) return false;

            // Admin-like roles bypass ACL (they can modify any document)
            if (IsAdminLike(user)) return true;

            var ownCode = NormalizeServiceCode(user.Service ?? "");
            if (!string.IsNullOrEmpty(ownCode)
                && await HasAccessAsync(documentId, ownCode, requiredLevel))
            {
                return true;
            }

            // A substitute is checked against the absent agent's service — but only
            // for the folder that agent is actually entrusted with, so a delegation
            // never widens into "everything my colleague's service holds".
            var custodianCode = await ResolveCoveredAgentServiceCodeAsync(documentId, userId);
            if (custodianCode != null
                && await HasAccessAsync(documentId, custodianCode, requiredLevel))
            {
                return true;
            }

            return false;
        }

        /// <summary>
        /// When the given user is substituting for the agent entrusted with
        /// <paramref name="documentId"/>, returns that agent's service code.
        /// Null when no delegation gives the caller a claim on this document.
        /// </summary>
        private async Task<string?> ResolveCoveredAgentServiceCodeAsync(int documentId, int userId)
        {
            var custodianUserId = await _context.Documents
                .Where(d => d.Id == documentId)
                .Select(d => d.GestionnaireUserId)
                .FirstOrDefaultAsync();

            if (custodianUserId is not int custodian) return null;
            if (!_substitutions.IsSubstitutingFor(userId, custodian)) return null;

            var covered = await _context.Utilisateurs.FindAsync(custodian);
            var code = NormalizeServiceCode(covered?.Service ?? "");
            return string.IsNullOrEmpty(code) ? null : code;
        }

        /// <summary>
        /// Public upsert method for admin-managed access grants.
        /// </summary>
        public async Task UpsertAccessForUserAsync(int documentId, string serviceCode, DocumentAccessLevel level, int? grantedByUserId)
        {
            await UpsertAccessAsync(documentId, serviceCode, level, grantedByUserId);
        }

        /// <summary>
        /// Get all access records for a document.
        /// </summary>
        public async Task<List<DocumentAccessDto>> GetDocumentAccessListAsync(int documentId)
        {
            return await _context.DocumentAccesses
                .Where(da => da.DocumentId == documentId)
                .OrderBy(da => da.AccessLevel)
                .Select(da => new DocumentAccessDto
                {
                    Id = da.Id,
                    DocumentId = da.DocumentId,
                    ServiceCode = da.ServiceCode,
                    AccessLevel = da.AccessLevel.ToString(),
                    CreatedAt = da.CreatedAt
                })
                .ToListAsync();
        }

        /// <summary>
        /// Ensure backward compatibility: if no DocumentAccess rows exist for a document,
        /// create them based on the document's current ServiceActuel (Owner) and
        /// transaction history (Editor for all previous holders).
        /// This is a one-time migration helper.
        /// </summary>
        public async Task EnsureAccessInitializedAsync(int documentId, string currentServiceCode)
        {
            var hasAccess = await _context.DocumentAccesses
                .AnyAsync(da => da.DocumentId == documentId);

            if (hasAccess) return; // Already initialized

            // Normalize the current service code (might be enum name or RBAC code)
            var normalizedCurrent = NormalizeServiceCode(currentServiceCode);

            // Check if this looks like an enum name and map to RBAC code
            var rbacCurrent = MapEnumNameToRbacCode(normalizedCurrent);

            // Grant Owner to the current service
            await GrantOwnerAsync(documentId, rbacCurrent);

            // Grant Editor to all services that previously held the document
            var previousServices = await _context.Transactions
                .Where(t => t.DocumentId == documentId)
                .Select(t => t.ServiceOrigine)
                .Distinct()
                .ToListAsync();

            foreach (var svc in previousServices)
            {
                var code = svc.ToString().ToLowerInvariant();
                var rbacCode = MapEnumNameToRbacCode(code);
                if (rbacCode != rbacCurrent)
                {
                    await GrantEditorAsync(documentId, rbacCode);
                }
            }
        }

        /// <summary>
        /// Backfill ACL for ALL existing documents that have no access rows.
        /// Admin can trigger this once after migration to ensure all documents are covered.
        /// </summary>
        public async Task<int> BackfillAllDocumentAccessAsync()
        {
            // Step 1: backfill the dynamic service code on legacy documents so that
            // all scoping/routing can read the code instead of the fixed enum.
            var legacyDocs = await _context.Documents
                .Where(d => d.ServiceActuelCode == null)
                .ToListAsync();

            foreach (var doc in legacyDocs)
            {
                doc.ServiceActuelCode = ServiceTribunalToRbacCode(doc.ServiceActuel);
            }
            if (legacyDocs.Count > 0)
                await _context.SaveChangesAsync();

            // Step 2: backfill ACL rows for documents that have none.
            var docIdsWithoutAccess = await _context.Documents
                .Where(d => !_context.DocumentAccesses.Any(da => da.DocumentId == d.Id))
                .Select(d => d.Id)
                .ToListAsync();

            foreach (var docId in docIdsWithoutAccess)
            {
                var doc = await _context.Documents.FindAsync(docId);
                if (doc != null)
                {
                    var rbacCode = ServiceMapper.ResolveDocumentServiceCode(doc);
                    await EnsureAccessInitializedAsync(docId, rbacCode);
                }
            }

            return docIdsWithoutAccess.Count;
        }

        /// <summary>
        /// Put folders handed over by an unanswered request back with the service
        /// that sent them.
        /// </summary>
        /// <remarks>
        /// A folder must stay with its sender until the destination accepts the
        /// transfer — <c>TransactionService.AccepterAsync</c> is the only thing that
        /// is supposed to move it. An older build of the "Transaction Unique"
        /// creation mode moved the folder straight away while still recording a
        /// <see cref="StatutTransaction.EnAttente"/> request, so the receiver saw it
        /// in Mes dossiers / Courriers Entrants / Courrier Juridique before ever
        /// answering. The source is fixed; this restores the rows that build left
        /// behind and is a no-op (0 rows) once they are repaired.
        /// </remarks>
        /// <returns>How many folders were moved back.</returns>
        public async Task<int> RepairUnansweredHandoversAsync()
        {
            // Only an unanswered handover can contradict a folder's location, and
            // only when the folder already sits at the requested destination.
            // Refusal notices carry a Commentaire, hence the null check.
            var stranded = await _context.Transactions
                .Where(t => t.Statut == StatutTransaction.EnAttente
                    && t.Commentaire == null
                    && t.ServiceOrigineCode != null
                    && t.ServiceDestinationCode != null
                    && t.ServiceOrigineCode != t.ServiceDestinationCode
                    && t.Document != null
                    && !t.Document.EstSupprime
                    && t.Document.ServiceActuelCode == t.ServiceDestinationCode)
                .Include(t => t.Document)
                .OrderBy(t => t.DateTransaction)
                .ToListAsync();

            if (stranded.Count == 0) return 0;

            var repaired = 0;
            foreach (var handover in stranded.GroupBy(t => t.DocumentId))
            {
                // The earliest unanswered handover is the one that moved the folder.
                var document = handover.First().Document!;
                var originCode = handover.First().ServiceOrigineCode!;

                document.ServiceActuelCode = originCode;
                // Legacy mirror of the code. Dynamic services have no enum value, so
                // this falls back exactly like creation and transfer already do.
                document.ServiceActuel = ServiceMapper.MapToServiceEnum(originCode);
                document.StatutActuel = StatutDossier.EnInstance;
                repaired++;
            }

            await _context.SaveChangesAsync();
            return repaired;
        }

        // ── Private helpers ──

        private async Task UpsertAccessAsync(int documentId, string serviceCode, DocumentAccessLevel level, int? grantedByUserId)
        {
            var existing = await _context.DocumentAccesses
                .FirstOrDefaultAsync(da => da.DocumentId == documentId && da.ServiceCode == serviceCode);

            if (existing != null)
            {
                // Only upgrade, never downgrade (Owner > Editor > Viewer)
                if (level > existing.AccessLevel)
                {
                    existing.AccessLevel = level;
                    if (grantedByUserId.HasValue)
                        existing.GrantedByUserId = grantedByUserId;
                    await _context.SaveChangesAsync();
                }
            }
            else
            {
                _context.DocumentAccesses.Add(new DocumentAccess
                {
                    DocumentId = documentId,
                    ServiceCode = serviceCode,
                    AccessLevel = level,
                    GrantedByUserId = grantedByUserId,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }
        }

        private static bool IsAdminLike(Utilisateur user)
        {
            var role = user.Role ?? "";
            return role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant";
        }

        /// <summary>
        /// Normalize a service code to lowercase with no spaces, matching
        /// the RBAC service codes stored in the Service table.
        /// </summary>
        private static string NormalizeServiceCode(string service) =>
            ServiceMapper.NormalizeServiceCode(service);

        /// <summary>
        /// If a code looks like a ServiceTribunal enum name (lowercase), map it to
        /// the corresponding RBAC Service.Code. If it's already an RBAC code, return as-is.
        /// </summary>
        private static string MapEnumNameToRbacCode(string code)
        {
            if (string.IsNullOrEmpty(code)) return code;
            // If the code contains '&' or matches known RBAC codes, it's already an RBAC code
            if (code.Contains('&') || code == "fathmilafat" || code == "secretarait" ||
                code == "khibra" || code == "taslimnosakh" || code == "atabligh" ||
                code == "tasfiatsawa2irtakmilia" || code == "bureauordre" || code == "archive")
                return code;

            // Otherwise, it's likely an enum name — map it
            return code switch
            {
                "bureauordre" => "bureauordre",
                "ouverturedossier" => "fathmilafat",
                "kitabakhasa" => "secretarait",
                "jalsatiwija2at" => "seances&procedures",
                "ijra2baht" => "seances&procedures",
                "mofawidmalaki" => "seances&procedures",
                "khibra" => "khibra",
                "mustacharmoqarir" => "khibra",
                "taslimnusakh" => "taslimnosakh",
                "tabligh" => "atabligh",
                "tasfiyatsawa2ir" => "tasfiatSawa2irTakmilia",
                "archive" => "archive",
                _ => code
            };
        }

        /// <summary>
        /// Map a ServiceTribunal enum value to its corresponding RBAC Service.Code.
        /// The enum names and RBAC codes differ for 6 of 9 services, so we must use
        /// this mapping whenever granting DocumentAccess rows.
        /// </summary>
        public static string ServiceTribunalToRbacCode(ServiceTribunal service)
        {
            return service switch
            {
                ServiceTribunal.BureauOrdre => "bureauordre",
                ServiceTribunal.OuvertureDossier => "fathmilafat",
                ServiceTribunal.KitabaKhasa => "secretarait",
                ServiceTribunal.JalsatWaIjra2at => "seances&procedures",
                ServiceTribunal.Ijra2Baht => "seances&procedures",
                ServiceTribunal.MofawidMalaki => "seances&procedures",
                ServiceTribunal.Khibra => "khibra",
                ServiceTribunal.MustacharMoqarir => "khibra",
                ServiceTribunal.TaslimNusakh => "taslimnosakh",
                ServiceTribunal.Tabligh => "atabligh",
                ServiceTribunal.TasfiyatSawa2ir => "tasfiatSawa2irTakmilia",
                ServiceTribunal.Archive => "archive",
                ServiceTribunal.CelluleInformatique => "bureauordre",
                ServiceTribunal.EfficaciteJudiciaire => "bureauordre",
                ServiceTribunal.GestionFinanciere => "bureauordre",
                ServiceTribunal.CaisseTribunal => "bureauordre",
                ServiceTribunal.BureauRecouvrement => "bureauordre",
                ServiceTribunal.BureauNotification => "atabligh",
                ServiceTribunal.BureauExpertise => "khibra",
                ServiceTribunal.ProcduresCommissaireRoyal => "seances&procedures",
                ServiceTribunal.GestionPourvoisCassation => "seances&procedures",
                ServiceTribunal.RemiseCopieJugement => "taslimnosakh",
                ServiceTribunal.Greffe => "bureauordre",
                ServiceTribunal.Direction => "bureauordre",
                _ => "bureauordre"
            };
        }

        // ── CUSTODY CHECK (Active Custody Constraint) ──

        /// <summary>
        /// Check if a user is the current custodian of a document (sync).
        /// Used in controllers where the document entity is already loaded.
        /// Admin/Greffier/Directeur roles bypass custody checks.
        /// </summary>
        public bool IsUserCustodian(Document document, int userId)
        {
            var user = _context.Utilisateurs.Find(userId);
            if (user == null) return false;

            // Admin-like roles bypass custody (system managers)
            if (IsAdminLike(user)) return true;

            var custodyServiceCode = ServiceMapper.ResolveDocumentServiceCode(document);
            if (string.IsNullOrEmpty(custodyServiceCode)) return false;

            // The caller's own service holds the folder.
            if (NormalizeServiceCode(user.Service ?? "") == custodyServiceCode) return true;

            // A substitute may act only on the folders entrusted to the agent they
            // replace, and only while those folders still sit in that agent's service.
            if (document.GestionnaireUserId is not int custodian) return false;
            if (!_substitutions.IsSubstitutingFor(userId, custodian)) return false;

            var covered = _context.Utilisateurs.Find(custodian);
            return NormalizeServiceCode(covered?.Service ?? "") == custodyServiceCode;
        }

        /// <summary>
        /// Check if a user's service is the current custodian by comparing service codes directly.
        /// </summary>
        public bool IsServiceCustodian(Document document, string serviceCode)
        {
            if (string.IsNullOrEmpty(serviceCode)) return false;
            var normalized = ServiceMapper.NormalizeServiceCode(serviceCode);
            var custodyServiceCode = ServiceMapper.ResolveDocumentServiceCode(document);
            return normalized == custodyServiceCode;
        }
    }

    public class DocumentAccessDto
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public string ServiceCode { get; set; } = string.Empty;
        public string AccessLevel { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
