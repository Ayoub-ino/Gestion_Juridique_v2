using Microsoft.EntityFrameworkCore;
using WebApplication1.Core.Enums;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Domain logic for transactions (transfers between services): pending lists,
    /// accept / refuse / cancel transitions, stats and history.
    /// Controllers remain thin: parse the request, call a service method, map the result.
    /// </summary>
    public class TransactionService
    {
        private readonly AppDbContext _context;

        public TransactionService(AppDbContext context)
        {
            _context = context;
        }

        private static bool IsAdminLike(Utilisateur user)
        {
            var role = user.Role ?? "";
            return role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant";
        }

        private async Task<Utilisateur?> LoadUserOrNullAsync(int userId) =>
            await _context.Utilisateurs.FindAsync(userId);

        public async Task<ServiceResult> GetPendingAsync(int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            // Admin users do not receive operational notifications
            if (IsAdminLike(user))
                return ServiceResult.Ok(new List<object>());

            var userServiceEnum = ServiceMapper.MapToServiceEnum(user.Service ?? "");

            var query = _context.Transactions
                .Include(t => t.Document)
                .Where(t => t.Statut == StatutTransaction.EnAttente
                    && t.ServiceDestination == userServiceEnum
                    && (t.TargetUserId == null || t.TargetUserId == userId));

            var transactions = await query
                .OrderByDescending(t => t.DateTransaction)
                .Select(t => new
                {
                    id = t.Id,
                    documentId = t.DocumentId,
                    documentType = t.Document is CourrierAdministratif ? "entrant-admin"
                                 : t.Document is DossierJuridique ? "entrant-juridique"
                                 : t.Document is CourrierSortant ? ((CourrierSortant)t.Document).TypeSortant == "demande" ? "sortant-demande" : "sortant-normal"
                                 : "unknown",
                    documentSujet = t.Document.Objet ?? t.Document.Sujet ?? "",
                    sourceServiceId = t.ServiceOrigine.ToString(),
                    destinationServiceId = t.ServiceDestination.ToString(),
                    message = t.Remarques ?? "",
                    statut = t.Statut.ToString(),
                    dateEnvoi = t.DateTransaction,
                    doitRevenir = t.DoitRevenir,
                    sourceUserName = t.UtilisateurId
                })
                .ToListAsync();

            return ServiceResult.Ok(transactions);
        }

        public async Task<ServiceResult> GetAllAsync(int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Fail(401, "Utilisateur non trouvé");

            // Admin users do not participate in transfers — return empty list
            if (IsAdminLike(user))
                return ServiceResult.Ok(new List<object>());

            var userServiceEnum = ServiceMapper.MapToServiceEnum(user.Service ?? "");

            var transactions = await _context.Transactions
                .Include(t => t.Document)
                .Where(t => t.ServiceOrigine == userServiceEnum || t.ServiceDestination == userServiceEnum)
                .OrderByDescending(t => t.DateTransaction)
                .Select(t => new
                {
                    id = t.Id,
                    documentId = t.DocumentId,
                    documentSujet = t.Document.Objet ?? t.Document.Sujet ?? "",
                    sourceServiceId = t.ServiceOrigine.ToString(),
                    destinationServiceId = t.ServiceDestination.ToString(),
                    message = t.Remarques ?? "",
                    statut = t.Statut.ToString(),
                    dateEnvoi = t.DateTransaction,
                    doitRevenir = t.DoitRevenir,
                    commentaire = t.Commentaire,
                    motifRefus = t.MotifRefus,
                    // Role: "sender" if user's service sent it, "receiver" if destination
                    role = t.ServiceOrigine == userServiceEnum ? "sender" : "receiver"
                })
                .ToListAsync();

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

            // Permission 'accepter' is enforced by the middleware ([RequirePermission]);
            // here we only enforce the service-ownership check.
            var userEnum = ServiceMapper.MapToServiceEnum(user.Service ?? "");
            if (transaction.ServiceDestination != userEnum)
                return ServiceResult.Fail(403, "Accès refusé");

            transaction.Statut = StatutTransaction.Accepte;
            transaction.Commentaire = commentaire;

            if (transaction.DoitRevenir)
            {
                transaction.Document.ServiceActuel = transaction.ServiceOrigine;
                transaction.Document.StatutActuel = StatutDossier.EnInstance;

                var retourTransaction = new Transaction
                {
                    DocumentId = transaction.DocumentId,
                    ServiceOrigine = transaction.ServiceDestination,
                    ServiceDestination = transaction.ServiceOrigine,
                    DateTransaction = DateTime.Now,
                    Remarques = "Document retourné automatiquement (doitRevenir)",
                    UtilisateurId = userIdStr,
                    Statut = StatutTransaction.EnAttente,
                    DoitRevenir = false
                };
                _context.Transactions.Add(retourTransaction);
            }
            else
            {
                transaction.Document.ServiceActuel = transaction.ServiceDestination;
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

            // Permission 'refuser' is enforced by the middleware ([RequirePermission]);
            // here we only enforce the service-ownership check.
            var userEnum = ServiceMapper.MapToServiceEnum(user.Service ?? "");
            if (transaction.ServiceDestination != userEnum)
                return ServiceResult.Fail(403, "Accès refusé");

            transaction.Statut = StatutTransaction.Refuse;
            transaction.MotifRefus = commentaire;

            if (transaction.DoitRevenir || doitRevenir)
            {
                transaction.DoitRevenir = true;
                transaction.Document.ServiceActuel = transaction.ServiceOrigine;
                transaction.Document.StatutActuel = StatutDossier.EnCours;

                var retourTransaction = new Transaction
                {
                    DocumentId = transaction.DocumentId,
                    ServiceOrigine = transaction.ServiceDestination,
                    ServiceDestination = transaction.ServiceOrigine,
                    DateTransaction = DateTime.Now,
                    Remarques = $"Document retourné après refus (doitRevenir): {commentaire ?? ""}",
                    UtilisateurId = userIdStr,
                    Statut = StatutTransaction.EnAttente,
                    DoitRevenir = false
                };
                _context.Transactions.Add(retourTransaction);
            }

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
            var userEnum = ServiceMapper.MapToServiceEnum(user.Service ?? "");

            // Standard users: can only cancel 'EnAttente' transactions they sent
            // Admin users: can cancel any transaction at any stage
            if (!isAdmin)
            {
                if (transaction.Statut != StatutTransaction.EnAttente)
                    return ServiceResult.Fail(400, "Seules les transactions en attente peuvent être annulées par un utilisateur standard");
                if (transaction.ServiceOrigine != userEnum)
                    return ServiceResult.Fail(403, "Vous ne pouvez annuler que les transferts que vous avez envoyés");
            }

            // Find all transactions for the same document that happened at or after this one and are not already annulled
            var transactionsToAnnul = await _context.Transactions
                .Include(t => t.Document)
                .Where(t => t.DocumentId == transaction.DocumentId
                    && t.DateTransaction >= transaction.DateTransaction
                    && t.Statut != StatutTransaction.Annule)
                .ToListAsync();

            foreach (var tx in transactionsToAnnul)
            {
                tx.Statut = StatutTransaction.Annule;
            }

            // Restore the document to the original service
            var document = transaction.Document;
            document.ServiceActuel = transaction.ServiceOrigine;
            document.StatutActuel = transaction.StatutPrecedent ?? StatutDossier.EnCours;

            await _context.SaveChangesAsync();

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

            var userServiceEnum = ServiceMapper.MapToServiceEnum(user.Service ?? "");

            var query = _context.Transactions
                .Where(t => t.ServiceOrigine == userServiceEnum || t.ServiceDestination == userServiceEnum);

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
            var stats = await _context.Transactions
                .GroupBy(t => t.ServiceOrigine)
                .Select(g => new
                {
                    service = g.Key.ToString(),
                    total = g.Count(),
                    acceptes = g.Count(t => t.Statut == StatutTransaction.Accepte),
                    refuses = g.Count(t => t.Statut == StatutTransaction.Refuse),
                    enAttente = g.Count(t => t.Statut == StatutTransaction.EnAttente)
                })
                .ToListAsync();

            return ServiceResult.Ok(stats);
        }

        public async Task<ServiceResult> CountPendingAsync(int userId)
        {
            var user = await LoadUserOrNullAsync(userId);
            if (user == null) return ServiceResult.Ok(new { count = 0 });

            // Admin users do not receive operational notifications
            if (IsAdminLike(user))
                return ServiceResult.Ok(new { count = 0 });

            var userServiceEnum = ServiceMapper.MapToServiceEnum(user.Service ?? "");

            var count = await _context.Transactions
                .Where(t => t.Statut == StatutTransaction.EnAttente
                    && t.ServiceDestination == userServiceEnum)
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

            var userServiceEnum = ServiceMapper.MapToServiceEnum(user.Service ?? "");

            var query = _context.Transactions
                .Include(t => t.Document)
                .Where(t => t.DoitRevenir
                    && (t.Statut == StatutTransaction.Refuse || t.Statut == StatutTransaction.EnAttente)
                    && t.ServiceDestination == userServiceEnum);

            var transactions = await query
                .OrderByDescending(t => t.DateTransaction)
                .Select(t => new
                {
                    id = t.Id,
                    documentId = t.DocumentId,
                    documentSujet = t.Document.Objet ?? t.Document.Sujet ?? "",
                    sourceServiceId = t.ServiceOrigine.ToString(),
                    destinationServiceId = t.ServiceDestination.ToString(),
                    message = t.MotifRefus ?? "",
                    statut = t.Statut.ToString(),
                    dateEnvoi = t.DateTransaction,
                    doitRevenir = t.DoitRevenir
                })
                .ToListAsync();

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
                    serviceOrigine = t.ServiceOrigine.ToString(),
                    serviceDestination = t.ServiceDestination.ToString(),
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
