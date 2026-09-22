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
        private readonly DocumentCloneService _cloneService;

        public TransactionService(
            AppDbContext context,
            DocumentAccessService accessService,
            DocumentCloneService cloneService)
        {
            _context = context;
            _accessService = accessService;
            _cloneService = cloneService;
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

        /// <summary>
        /// True when this request names a recipient AND another pending request for
        /// the same folder names a DIFFERENT recipient.
        ///
        /// That is the one case where a single folder cannot serve everybody: each
        /// named recipient must receive their own copy, otherwise the first one to
        /// answer would move the folder out from under the others. Service-wide
        /// requests are excluded on purpose — the folder simply lands in the service
        /// where every member can work on it.
        /// </summary>
        private async Task<bool> HasOtherTargetedRecipientAsync(Transaction transaction)
        {
            if (!transaction.TargetUserId.HasValue) return false;

            var targetUserId = transaction.TargetUserId.Value;

            return await _context.Transactions
                .AnyAsync(t => t.DocumentId == transaction.DocumentId
                    && t.Statut == StatutTransaction.EnAttente
                    && t.Id != transaction.Id
                    && t.TargetUserId.HasValue
                    && t.TargetUserId.Value != targetUserId);
        }

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

            // A refusal notice only needs an acknowledgement: it is a message to the
            // sender, not a handoff, so it never moves the folder.
            var isRefusalNotice = IsRefusalNotice(transaction);

            // Set when the folder was handed to the receiver as a COPY of the one
            // the sender holds, rather than by moving the folder itself.
            var copyHandedOver = false;

            // The folder stayed with the sender until this point (pending transfer).
            // doitRevenir: the receiver processed it but it must go back to the sender.
            if (transaction.DoitRevenir && !isRefusalNotice)
            {
                transaction.Document.StatutActuel = StatutDossier.EnInstance;
            }
            else
            {
                var document = transaction.Document;

                // ── ONE FOLDER PER NAMED RECIPIENT ──
                // A send can name several users, each with their own request. Rather
                // than let them race for a single row — the first acceptance would
                // move the folder out from under the others — the first acceptance
                // spins off a copy for THAT user, while the folder itself stays put
                // and is taken by the LAST recipient to answer. N recipients end up
                // with N independent folders and the sender is left with nothing
                // extra to clean up.
                if (await HasOtherTargetedRecipientAsync(transaction))
                {
                    var copy = _cloneService.BuildCopy(document);
                    _context.Documents.Add(copy);
                    await _context.SaveChangesAsync();

                    // The copy inherits the journey of the folder it came from.
                    await _cloneService.CopyCommittedHistoryAsync(document.Id, copy.Id);

                    // Re-point this request at the copy: it becomes the copy's own
                    // acceptance hop, and the original keeps its untouched journey.
                    transaction.DocumentId = copy.Id;
                    transaction.Document = copy;
                    document = copy;

                    copyHandedOver = true;
                }

                // Move the folder to the receiver's service, and entrust it to the
                // agent who accepted it: the sender's substitute must not keep reaching
                // it once it has left the sender's hands.
                document.ServiceActuel = transaction.ServiceDestination;
                document.ServiceActuelCode = destCode;
                document.StatutActuel = StatutDossier.EnCours;
                document.GestionnaireUserId = userId;

                // Grant the receiver's service edit access (was withheld during the pending phase).
                await _accessService.GrantEditorAsync(document.Id, destCode, userId);
            }

            // ── RECORD THE DECISION ──
            // Written last on purpose: the copy step above reads the folder's
            // committed history, and this request must not land in it twice.
            transaction.Statut = StatutTransaction.Accepte;
            // Keep the original marker so the sender's notification stays identifiable
            if (!isRefusalNotice) transaction.Commentaire = commentaire;

            // ── CLOSE THE COMPETING REQUESTS ──
            // One send can target several users, so this document may still be
            // sitting in other inboxes. Accepting it MOVES the folder, which makes
            // every other pending handoff of it stale — leaving them open would ask
            // a second user to accept a folder already in their own service, and a
            // later refusal there would contradict the completed transfer.
            //
            // A "doit revenir" acceptance only answers that one handoff, so it is
            // scoped to the same origin → destination pair. "[REFUS]" notices are
            // messages to the sender and are never cancelled here.
            //
            // This is skipped when the folder was handed over as a copy: the
            // original did not move, so every other pending request is still valid.
            if (!isRefusalNotice && !copyHandedOver)
            {
                var competing = _context.Transactions
                    .Where(t => t.DocumentId == transaction.DocumentId
                        && t.Statut == StatutTransaction.EnAttente
                        && t.Id != transaction.Id
                        && (t.Commentaire == null || t.Commentaire != "[REFUS]"));

                if (transaction.DoitRevenir)
                {
                    // Rows written before the code columns existed only carry the enum.
                    competing = competing.Where(t =>
                        (t.ServiceDestinationCode == destCode
                            || (t.ServiceDestinationCode == null && t.ServiceDestination == transaction.ServiceDestination))
                        && (t.ServiceOrigineCode == originCode
                            || (t.ServiceOrigineCode == null && t.ServiceOrigine == transaction.ServiceOrigine)));
                }

                foreach (var other in await competing.ToListAsync())
                    other.Statut = StatutTransaction.Annule;
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

            // The folder never moved from the sender (pending transfer), so no return is needed.
            // ── SENDER NOTIFICATION: create a notification for the sender's service ──
            // so the sender sees "Your transfer was refused" with the receiver's message
            // in their Notifications tab.
            var senderNotificationTx = new Transaction
            {
                DocumentId = transaction.DocumentId,
                ServiceOrigine = transaction.ServiceDestination,   // receiver's service
                ServiceOrigineCode = destCode,                     // receiver's code
                ServiceDestination = transaction.ServiceOrigine,   // sender's service
                ServiceDestinationCode = originCode,               // sender's code
                DateTransaction = DateTime.Now,
                Remarques = commentaire,
                MotifRefus = commentaire,
                UtilisateurId = userIdStr,
                Statut = StatutTransaction.EnAttente,
                DoitRevenir = false,
                Commentaire = "[REFUS]"
            };
            _context.Transactions.Add(senderNotificationTx);

            // ── CLOSE THE SIBLING REQUESTS OF THE SAME SEND ──
            // Refusing answers THIS handoff, so no other user targeted by the same
            // send may accept it afterwards — otherwise the sender would end up
            // with both a refusal notice and a completed transfer for one folder.
            // Handoffs to other services are left untouched: the folder did not
            // move, so they remain legitimately actionable.
            //
            // Requests naming a DIFFERENT recipient are also left open: each named
            // recipient receives their own copy of the folder, so one of them
            // refusing says nothing about the others' requests.
            var siblings = await _context.Transactions
                .Where(t => t.DocumentId == transaction.DocumentId
                    && t.Statut == StatutTransaction.EnAttente
                    && t.Id != transaction.Id
                    // Rows written before the code columns existed only carry the enum.
                    && (t.ServiceDestinationCode == destCode
                        || (t.ServiceDestinationCode == null && t.ServiceDestination == transaction.ServiceDestination))
                    && (t.ServiceOrigineCode == originCode
                        || (t.ServiceOrigineCode == null && t.ServiceOrigine == transaction.ServiceOrigine))
                    && (t.TargetUserId == null || t.TargetUserId == transaction.TargetUserId)
                    && (t.Commentaire == null || t.Commentaire != "[REFUS]"))
                .ToListAsync();

            foreach (var sibling in siblings)
                sibling.Statut = StatutTransaction.Annule;

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

            // The folder stayed with the sender (pending transfer), so no restore is needed.
            await _context.SaveChangesAsync();

            // Revoke any access that may have been granted to the destination
            // (no-op when access was never granted, but safe to keep for idempotency)
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

        /// <summary>
        /// The folder's real journey. A transfer only becomes part of the history
        /// once it has actually moved the folder:
        ///   - <c>Accepte</c>  : a completed movement. This includes historique
        ///                       (record-only) services, which are auto-accepted
        ///                       because they have no accounts and cannot act.
        ///   - <c>Refuse</c>   : the folder did NOT move, but the denied attempt is
        ///                       kept so the UI can mark that hop with ❌.
        /// Excluded: <c>EnAttente</c> (the folder is still with the sender, so the
        /// transfer must not appear as if it had happened), <c>Annule</c> (never
        /// happened), and "[REFUS]" notices (messages addressed to the sender,
        /// not movements of the folder).
        /// </summary>
        public async Task<ServiceResult> GetHistoryAsync(int documentId)
        {
            var transactions = await _context.Transactions
                .Where(t => t.DocumentId == documentId
                    && (t.Statut == StatutTransaction.Accepte
                        || t.Statut == StatutTransaction.Refuse)
                    // SQL three-valued logic: `Commentaire <> '[REFUS]'` would also
                    // drop rows where the column is NULL, hence the explicit check.
                    && (t.Commentaire == null || t.Commentaire != "[REFUS]"))
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
