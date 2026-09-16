using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Domain logic for transactions (transfers between services): pending lists,
    /// accept / refuse / cancel transitions, stats and history.
    /// Controllers remain thin: parse the request, call a service method, map the result.
    ///
    /// Routing is keyed on RBAC service codes (dynamic — supports services created
    /// from the admin panel). The ServiceTribunal enum columns are kept as a legacy
    /// mirror and are only consulted for rows created before the code columns existed.
    /// </summary>
    public class TransactionService
    {
        private readonly AppDbContext _context;
        private readonly DocumentAccessService _accessService;

        public TransactionService(AppDbContext context, DocumentAccessService accessService)
        {
            _context = context;
            _accessService = accessService;
        }

        private static bool IsAdminLike(Utilisateur user)
        {
            var role = user.Role ?? "";
            return role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant";
        }

        /// <summary>
        /// Canonical RBAC code of the service the user belongs to.
        /// Works for any service, including dynamically-created ones.
        /// </summary>
        private static string ResolveUserServiceCode(Utilisateur user) =>
            ServiceMapper.NormalizeServiceCode(user.Service);

        /// <summary>
        /// Legacy enum equivalent of the user's service, used only to match rows
        /// written before the code columns existed.
        /// </summary>
        private static bool TryResolveUserService(Utilisateur user, out ServiceTribunal serviceEnum) =>
            ServiceMapper.TryMapToServiceEnum(user.Service ?? "", out serviceEnum);

        /// <summary>
        /// A refusal notice is a pending transaction sent back to the original sender
        /// so they learn why their transfer was refused. It is flagged in Commentaire
        /// and only needs an acknowledgement — never a state transition.
        /// </summary>
        private static bool IsRefusalNotice(Transaction t) => t.Commentaire == "[REFUS]";

        private static string TransactionOriginCode(Transaction t) =>
            string.IsNullOrWhiteSpace(t.ServiceOrigineCode)
                ? DocumentAccessService.ServiceTribunalToRbacCode(t.ServiceOrigine)
                : ServiceMapper.NormalizeServiceCode(t.ServiceOrigineCode);

        private static string TransactionDestinationCode(Transaction t) =>
            string.IsNullOrWhiteSpace(t.ServiceDestinationCode)
                ? DocumentAccessService.ServiceTribunalToRbacCode(t.ServiceDestination)
                : ServiceMapper.NormalizeServiceCode(t.ServiceDestinationCode);

        private async Task<Utilisateur?> LoadUserOrNullAsync(int userId) =>
            await _context.Utilisateurs.FindAsync(userId);

        public async Task<ServiceResult> GetPendingAsync(int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            // Admin users do not receive operational notifications
            if (IsAdminLike(user))
                return ServiceResult.Ok(new List<object>());

            var userCode = ResolveUserServiceCode(user);
            if (string.IsNullOrEmpty(userCode))
                return ServiceResult.Ok(new List<object>());

            var hasLegacy = TryResolveUserService(user, out var legacyEnum);

            var query = _context.Transactions
                .Include(t => t.Document)
                .Where(t => t.Statut == StatutTransaction.EnAttente);

            query = hasLegacy
                ? query.Where(t => t.ServiceDestinationCode == userCode
                    || (t.ServiceDestinationCode == null && t.ServiceDestination == legacyEnum))
                : query.Where(t => t.ServiceDestinationCode == userCode);

            var raw = await query
                .OrderByDescending(t => t.DateTransaction)
                .ToListAsync();

            var transactions = raw
                .Where(t => t.TargetUserId == null || t.TargetUserId == userId)
                .Select(t => new
                {
                    id = t.Id,
                    documentId = t.DocumentId,
                    documentType = t.Document is CourrierAdministratif ? "entrant-admin"
                                 : t.Document is DossierJuridique ? "entrant-juridique"
                                 : t.Document is CourrierSortant ? (((CourrierSortant)t.Document).TypeSortant == "demande" ? "sortant-demande" : "sortant-normal")
                                 : "unknown",
                    documentSujet = t.Document.Objet ?? t.Document.Sujet ?? "",
                    sourceServiceId = t.ServiceOrigineCode ?? t.ServiceOrigine.ToString(),
                    destinationServiceId = t.ServiceDestinationCode ?? t.ServiceDestination.ToString(),
                    message = t.Remarques ?? "",
                    // "[REFUS]" flags a refusal notice sent back to the original sender
                    commentaire = t.Commentaire ?? "",
                    statut = t.Statut.ToString(),
                    dateEnvoi = t.DateTransaction,
                    doitRevenir = t.DoitRevenir,
                    sourceUserName = t.UtilisateurId
                })
                .ToList();

            return ServiceResult.Ok(transactions);
        }

        public async Task<ServiceResult> GetAllAsync(int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            // Admin users do not participate in transfers — return empty list
            if (IsAdminLike(user))
                return ServiceResult.Ok(new List<object>());

            var userCode = ResolveUserServiceCode(user);
            if (string.IsNullOrEmpty(userCode))
                return ServiceResult.Ok(new List<object>());

            var hasLegacy = TryResolveUserService(user, out var legacyEnum);

            var query = _context.Transactions.Include(t => t.Document).AsQueryable();

            query = hasLegacy
                ? query.Where(t => t.ServiceOrigineCode == userCode
                    || t.ServiceDestinationCode == userCode
                    || (t.ServiceOrigineCode == null && t.ServiceOrigine == legacyEnum)
                    || (t.ServiceDestinationCode == null && t.ServiceDestination == legacyEnum))
                : query.Where(t => t.ServiceOrigineCode == userCode
                    || t.ServiceDestinationCode == userCode);

            var raw = await query
                .OrderByDescending(t => t.DateTransaction)
                .ToListAsync();

            var transactions = raw
                .Select(t =>
                {
                    var originCode = TransactionOriginCode(t);
                    return new
                    {
                        id = t.Id,
                        documentId = t.DocumentId,
                        documentSujet = t.Document.Objet ?? t.Document.Sujet ?? "",
                        sourceServiceId = t.ServiceOrigineCode ?? t.ServiceOrigine.ToString(),
                        destinationServiceId = t.ServiceDestinationCode ?? t.ServiceDestination.ToString(),
                        message = t.Remarques ?? "",
                        statut = t.Statut.ToString(),
                        dateEnvoi = t.DateTransaction,
                        doitRevenir = t.DoitRevenir,
                        commentaire = t.Commentaire,
                        motifRefus = t.MotifRefus,
                        // Role: "sender" if the user's service sent it, "receiver" if destination
                        role = originCode == userCode ? "sender" : "receiver"
                    };
                })
                .ToList();

            return ServiceResult.Ok(transactions);
        }

        public async Task<ServiceResult> AccepterAsync(int id, string? commentaire, int userId, string userIdStr)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            var transaction = await _context.Transactions
                .Include(t => t.Document)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transaction == null) return ServiceResult.Fail(404, "Transaction non trouvée");
            if (transaction.Statut != StatutTransaction.EnAttente)
                return ServiceResult.Fail(400, "Cette transaction n'est plus en attente");

            var userCode = ResolveUserServiceCode(user);
            if (string.IsNullOrEmpty(userCode))
                return ServiceResult.Fail(403, "Service utilisateur inconnu");

            var destCode = TransactionDestinationCode(transaction);
            if (destCode != userCode)
                return ServiceResult.Fail(403, "Accès refusé");

            var originCode = TransactionOriginCode(transaction);

            transaction.Statut = StatutTransaction.Accepte;
            // Keep the original marker so the sender's notification stays identifiable
            if (!IsRefusalNotice(transaction)) transaction.Commentaire = commentaire;

            // A refusal notice is only an acknowledgement by the original sender —
            // it must never re-route the document.
            if (transaction.DoitRevenir && !IsRefusalNotice(transaction))
            {
                transaction.Document.ServiceActuel = transaction.ServiceOrigine;
                transaction.Document.ServiceActuelCode = originCode;
                transaction.Document.StatutActuel = StatutDossier.EnInstance;

                var retourTransaction = new Transaction
                {
                    DocumentId = transaction.DocumentId,
                    ServiceOrigine = transaction.ServiceDestination,
                    ServiceOrigineCode = destCode,
                    ServiceDestination = transaction.ServiceOrigine,
                    ServiceDestinationCode = originCode,
                    DateTransaction = DateTime.Now,
                    Remarques = "Document retourné automatiquement (doitRevenir)",
                    UtilisateurId = userIdStr,
                    Statut = StatutTransaction.EnAttente,
                    DoitRevenir = false
                };
                _context.Transactions.Add(retourTransaction);

                // Revoke receiver's access — document is returning to sender
                await _accessService.RevokeAccessAsync(transaction.DocumentId, destCode);
            }
            else
            {
                transaction.Document.ServiceActuel = transaction.ServiceDestination;
                transaction.Document.ServiceActuelCode = destCode;
                transaction.Document.StatutActuel = StatutDossier.EnCours;
            }

            await _context.SaveChangesAsync();

            return ServiceResult.Ok(new { message = "Transaction acceptée avec succès" });
        }

        public async Task<ServiceResult> RefuserAsync(int id, string? commentaire, bool doitRevenir, int userId, string userIdStr)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            var transaction = await _context.Transactions
                .Include(t => t.Document)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transaction == null) return ServiceResult.Fail(404, "Transaction non trouvée");
            if (transaction.Statut != StatutTransaction.EnAttente)
                return ServiceResult.Fail(400, "Cette transaction n'est plus en attente");

            var userCode = ResolveUserServiceCode(user);
            if (string.IsNullOrEmpty(userCode))
                return ServiceResult.Fail(403, "Service utilisateur inconnu");

            var destCode = TransactionDestinationCode(transaction);
            if (destCode != userCode)
                return ServiceResult.Fail(403, "Accès refusé");

            var originCode = TransactionOriginCode(transaction);

            transaction.Statut = StatutTransaction.Refuse;
            transaction.MotifRefus = commentaire;

            if (transaction.DoitRevenir || doitRevenir)
            {
                transaction.DoitRevenir = true;
                transaction.Document.ServiceActuel = transaction.ServiceOrigine;
                transaction.Document.ServiceActuelCode = originCode;
                transaction.Document.StatutActuel = StatutDossier.EnCours;

                var retourTransaction = new Transaction
                {
                    DocumentId = transaction.DocumentId,
                    ServiceOrigine = transaction.ServiceDestination,
                    ServiceOrigineCode = destCode,
                    ServiceDestination = transaction.ServiceOrigine,
                    ServiceDestinationCode = originCode,
                    DateTransaction = DateTime.Now,
                    Remarques = $"Document retourné après refus (doitRevenir): {commentaire ?? ""}",
                    UtilisateurId = userIdStr,
                    Statut = StatutTransaction.EnAttente,
                    DoitRevenir = false
                };

                _context.Transactions.Add(retourTransaction);

                // Revoke receiver's access — document is returning to sender
                await _accessService.RevokeAccessAsync(transaction.DocumentId, destCode);
            }

            // ── SENDER NOTIFICATION: create a notification for the sender's service ──
            // so the sender sees "Your transfer was refused" with the receiver's message
            // in their Notifications tab. This transaction is directed TO the sender's service.
            var senderNotificationTx = new Transaction
            {
                DocumentId = transaction.DocumentId,
                ServiceOrigine = transaction.ServiceDestination,   // receiver's service
                ServiceOrigineCode = destCode,                     // receiver's code
                ServiceDestination = transaction.ServiceOrigine,   // sender's service
                ServiceDestinationCode = originCode,               // sender's code
                DateTransaction = DateTime.Now,
                Remarques = commentaire,
                UtilisateurId = userIdStr,
                Statut = StatutTransaction.EnAttente,
                // The document was already returned (if requested) by the refusal above;
                // this row is a notice, not a transfer, so it must not carry DoitRevenir.
                DoitRevenir = false,
                Commentaire = "[REFUS]"
            };
            _context.Transactions.Add(senderNotificationTx);

            await _context.SaveChangesAsync();

            return ServiceResult.Ok(new { message = "Transaction refusée" });
        }

        public async Task<ServiceResult> AnnulerTransitionAsync(int id, int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            var transaction = await _context.Transactions
                .Include(t => t.Document)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transaction == null)
                return ServiceResult.Fail(404, "Transaction non trouvée");

            var isAdmin = IsAdminLike(user);
            var userCode = ResolveUserServiceCode(user);
            if (string.IsNullOrEmpty(userCode) && !isAdmin)
                return ServiceResult.Fail(403, "Service utilisateur inconnu");

            var originCode = TransactionOriginCode(transaction);

            // Standard users: can only cancel 'EnAttente' transactions they sent
            // Admin users: can cancel 'EnAttente' transactions (any sender)
            // No one can cancel already-accepted or refused transactions — that would corrupt document state
            if (transaction.Statut != StatutTransaction.EnAttente)
                return ServiceResult.Fail(400, "Seules les transactions en attente peuvent être annulées");
            if (!isAdmin && originCode != userCode)
                return ServiceResult.Fail(403, "Vous ne pouvez annuler que les transferts que vous avez envoyés");

            // Cancel this transaction itself
            transaction.Statut = StatutTransaction.Annule;

            // Find all transactions for the same document that happened strictly after this one
            // (or at the same time with a higher ID) and are not already annulled
            var transactionsToAnnul = await _context.Transactions
                .Include(t => t.Document)
                .Where(t => t.DocumentId == transaction.DocumentId
                    && (t.DateTransaction > transaction.DateTransaction
                        || (t.DateTransaction == transaction.DateTransaction && t.Id > transaction.Id))
                    && t.Statut != StatutTransaction.Annule)
                .ToListAsync();

            foreach (var tx in transactionsToAnnul)
            {
                tx.Statut = StatutTransaction.Annule;
            }

            // Restore the document to the original service
            var document = transaction.Document;
            document.ServiceActuel = transaction.ServiceOrigine;
            document.ServiceActuelCode = originCode;
            document.StatutActuel = transaction.StatutPrecedent ?? StatutDossier.EnCours;

            await _context.SaveChangesAsync();

            // Revoke DocumentAccess for the destination service (they can no longer modify)
            var destCode = TransactionDestinationCode(transaction);
            await _accessService.RevokeAccessAsync(transaction.DocumentId, destCode);

            return ServiceResult.Ok(new
            {
                message = "Transition annulée avec succès",
                annulledTransactionIds = transactionsToAnnul.Select(t => t.Id).ToList()
            });
        }

        public async Task<ServiceResult> GetStatsAsync(int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            // Admin users do not participate in transfers — return zero stats
            if (IsAdminLike(user))
                return ServiceResult.Ok(new { total = 0, acceptes = 0, refuses = 0, enAttente = 0, pourcentage = 0 });

            var userCode = ResolveUserServiceCode(user);
            if (string.IsNullOrEmpty(userCode))
                return ServiceResult.Ok(new { total = 0, acceptes = 0, refuses = 0, enAttente = 0, pourcentage = 0 });

            var hasLegacy = TryResolveUserService(user, out var legacyEnum);

            var query = hasLegacy
                ? _context.Transactions.Where(t => t.ServiceOrigineCode == userCode
                    || t.ServiceDestinationCode == userCode
                    || (t.ServiceOrigineCode == null && t.ServiceOrigine == legacyEnum)
                    || (t.ServiceDestinationCode == null && t.ServiceDestination == legacyEnum))
                : _context.Transactions.Where(t => t.ServiceOrigineCode == userCode
                    || t.ServiceDestinationCode == userCode);

            var total = await query.CountAsync();
            var acceptes = await query.CountAsync(t => t.Statut == StatutTransaction.Accepte);
            var refuses = await query.CountAsync(t => t.Statut == StatutTransaction.Refuse);
            var enAttente = await query.CountAsync(t => t.Statut == StatutTransaction.EnAttente);

            var pourcentage = total > 0 ? Math.Round((double)acceptes / total * 100, 1) : 0;

            return ServiceResult.Ok(new
            {
                total,
                acceptes,
                refuses,
                enAttente,
                pourcentage
            });
        }

        public async Task<ServiceResult> GetStatsByServiceAsync()
        {
            // Group by the dynamic code when available, else fall back to the enum name.
            var rows = await _context.Transactions
                .Select(t => new
                {
                    Service = t.ServiceOrigineCode != null ? t.ServiceOrigineCode : t.ServiceOrigine.ToString(),
                    t.Statut
                })
                .ToListAsync();

            var stats = rows
                .GroupBy(t => t.Service)
                .Select(g => new
                {
                    service = g.Key,
                    total = g.Count(),
                    acceptes = g.Count(t => t.Statut == StatutTransaction.Accepte),
                    refuses = g.Count(t => t.Statut == StatutTransaction.Refuse),
                    enAttente = g.Count(t => t.Statut == StatutTransaction.EnAttente)
                })
                .ToList();

            return ServiceResult.Ok(stats);
        }

        public async Task<ServiceResult> CountPendingAsync(int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Ok(new { count = 0 });

            // Admin users do not receive operational notifications
            if (IsAdminLike(user))
                return ServiceResult.Ok(new { count = 0 });

            var userCode = ResolveUserServiceCode(user);
            if (string.IsNullOrEmpty(userCode))
                return ServiceResult.Ok(new { count = 0 });

            var hasLegacy = TryResolveUserService(user, out var legacyEnum);

            var query = hasLegacy
                ? _context.Transactions.Where(t => t.ServiceDestinationCode == userCode
                    || (t.ServiceDestinationCode == null && t.ServiceDestination == legacyEnum))
                : _context.Transactions.Where(t => t.ServiceDestinationCode == userCode);

            var count = await query
                .Where(t => t.Statut == StatutTransaction.EnAttente)
                .CountAsync();

            return ServiceResult.Ok(new { count });
        }

        public async Task<ServiceResult> GetDoitRevenirAsync(int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            // Admin users do not receive operational notifications
            if (IsAdminLike(user))
                return ServiceResult.Ok(new List<object>());

            var userCode = ResolveUserServiceCode(user);
            if (string.IsNullOrEmpty(userCode))
                return ServiceResult.Ok(new List<object>());

            var hasLegacy = TryResolveUserService(user, out var legacyEnum);

            var query = _context.Transactions
                .Include(t => t.Document)
                .Where(t => t.DoitRevenir
                    && (t.Statut == StatutTransaction.Refuse || t.Statut == StatutTransaction.EnAttente));

            query = hasLegacy
                ? query.Where(t => t.ServiceDestinationCode == userCode
                    || (t.ServiceDestinationCode == null && t.ServiceDestination == legacyEnum))
                : query.Where(t => t.ServiceDestinationCode == userCode);

            var raw = await query
                .OrderByDescending(t => t.DateTransaction)
                .ToListAsync();

            var transactions = raw
                .Select(t => new
                {
                    id = t.Id,
                    documentId = t.DocumentId,
                    documentSujet = t.Document.Objet ?? t.Document.Sujet ?? "",
                    sourceServiceId = t.ServiceOrigineCode ?? t.ServiceOrigine.ToString(),
                    destinationServiceId = t.ServiceDestinationCode ?? t.ServiceDestination.ToString(),
                    message = t.MotifRefus ?? "",
                    statut = t.Statut.ToString(),
                    dateEnvoi = t.DateTransaction,
                    doitRevenir = t.DoitRevenir
                })
                .ToList();

            return ServiceResult.Ok(transactions);
        }

        public async Task<ServiceResult> GetHistoryAsync(int documentId)
        {
            var transactions = await _context.Transactions
                .Where(t => t.DocumentId == documentId)
                .OrderBy(t => t.DateTransaction)
                .Select(t => new
                {
                    id = t.Id,
                    serviceOrigine = t.ServiceOrigineCode != null ? t.ServiceOrigineCode : t.ServiceOrigine.ToString(),
                    serviceDestination = t.ServiceDestinationCode != null ? t.ServiceDestinationCode : t.ServiceDestination.ToString(),
                    date = t.DateTransaction,
                    remarques = t.Remarques ?? "",
                    statut = t.Statut.ToString(),
                    commentaire = t.Commentaire ?? "",
                    motifRefus = t.MotifRefus ?? "",
                    doitRevenir = t.DoitRevenir
                })
                .ToListAsync();

            return ServiceResult.Ok(transactions);
        }
    }
}
