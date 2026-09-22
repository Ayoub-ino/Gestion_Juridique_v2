using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Resolves absence delegations ("remplaçant"). A user designates a substitute
    /// from Mon profil; while the delegation is active the substitute covers that
    /// agent's folders. Every action they take while covering is written to
    /// <see cref="SubstitutionAction"/> so the system always knows who acted in
    /// place of whom.
    /// </summary>
    /// <remarks>
    /// The scope is deliberately <b>narrow</b>: a substitute reaches only the
    /// folders entrusted to the agent they replace
    /// (<see cref="Document.GestionnaireUserId"/>), never that agent's whole
    /// service. Colleagues in the same service remain out of reach.
    /// </remarks>
    public class SubstitutionService
    {
        private readonly AppDbContext _context;

        public SubstitutionService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>Active delegation where <paramref name="userId"/> is the absent agent.</summary>
        public Substitute? GetActiveForAbsentUser(int userId) =>
            _context.Substitutes
                .Where(s => s.UserId == userId && s.IsActive)
                .OrderByDescending(s => s.DateAssignation)
                .FirstOrDefault();

        /// <summary>Active delegations where <paramref name="userId"/> is the substitute.</summary>
        public List<Substitute> GetActiveForSubstitute(int userId) =>
            _context.Substitutes
                .Where(s => s.SubstituteUserId == userId && s.IsActive)
                .OrderByDescending(s => s.DateAssignation)
                .ToList();

        /// <summary>Agents this substitute is currently covering.</summary>
        public List<int> GetCoveredUserIds(int substituteUserId) =>
            _context.Substitutes
                .Where(s => s.SubstituteUserId == substituteUserId && s.IsActive)
                .Select(s => s.UserId)
                .Distinct()
                .ToList();

        /// <summary>
        /// Is <paramref name="substituteUserId"/> an active substitute for
        /// <paramref name="absentUserId"/>?
        /// </summary>
        public bool IsSubstitutingFor(int substituteUserId, int absentUserId) =>
            _context.Substitutes.Any(s =>
                s.SubstituteUserId == substituteUserId && s.UserId == absentUserId && s.IsActive);

        /// <summary>The user's own service code, normalized to the RBAC form.</summary>
        public string? GetOwnServiceCode(int userId)
        {
            var user = _context.Utilisateurs.Find(userId);
            var code = ServiceMapper.NormalizeServiceCode(user?.Service);
            return string.IsNullOrEmpty(code) ? null : code;
        }

        /// <summary>
        /// The user's own service as a <see cref="ServiceTribunal"/> value, for rows
        /// written before the dynamic service codes existed. Null when their service
        /// was created from the admin panel and therefore has no enum counterpart.
        /// </summary>
        public ServiceTribunal? GetOwnServiceEnum(int userId)
        {
            var user = _context.Utilisateurs.Find(userId);
            return user?.Service is { Length: > 0 } service
                && ServiceMapper.TryMapToServiceEnum(service, out var mapped)
                ? mapped
                : null;
        }

        /// <summary>
        /// Visibility scope of a caller who is not an administrator: the folders their
        /// own service holds, plus the folders entrusted to any agent they are
        /// substituting for. Shared by every listing so they cannot drift apart.
        /// </summary>
        public static Expression<Func<T, bool>> BuildScopePredicate<T>(
            string? ownServiceCode,
            ServiceTribunal? ownServiceEnum,
            List<int> coveredUserIds) where T : Document
        {
            return d =>
                // Held by the caller's own service.
                (ownServiceCode != null && d.ServiceActuelCode == ownServiceCode)
                // Legacy rows written before the dynamic service codes existed.
                || (ownServiceCode == null
                    && ownServiceEnum != null
                    && d.ServiceActuelCode == null
                    && d.ServiceActuel == ownServiceEnum.Value)
                // Folders entrusted to an agent the caller is substituting for.
                || (coveredUserIds.Count > 0
                    && coveredUserIds.Contains(d.GestionnaireUserId ?? 0));
        }

        /// <summary>
        /// Record that <paramref name="actingUserId"/> acted on behalf of someone.
        /// No-op when the user is not currently substituting for anyone, so this can
        /// be called unconditionally from the mutation endpoints.
        /// </summary>
        public async Task LogDelegatedActionAsync(int actingUserId, string action, int? documentId = null, string? reference = null)
        {
            var coveredIds = GetCoveredUserIds(actingUserId);
            if (coveredIds.Count == 0) return;

            // Resolve the folder reference when the caller did not supply it, so the
            // trace is readable without every endpoint having to look it up.
            if (string.IsNullOrEmpty(reference) && documentId.HasValue)
            {
                reference = _context.Documents
                    .Where(d => d.Id == documentId.Value)
                    .Select(d => d.NumeroReference)
                    .FirstOrDefault();
            }

            foreach (var coveredId in coveredIds)
            {
                _context.SubstitutionActions.Add(new SubstitutionAction
                {
                    EffectueParUserId = actingUserId,
                    PourUserId = coveredId,
                    Action = action,
                    DocumentId = documentId,
                    Reference = reference ?? string.Empty,
                    DateAction = System.DateTime.Now
                });
            }

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Resolve <see cref="Document.GestionnaireUserId"/> for rows written before
        /// the column existed. Creation has always encoded the creator's user id in
        /// <see cref="Document.NumeroBureauOrdre"/> as "{userId}/{year}", so the
        /// entrusted agent can be recovered for existing folders exactly.
        /// Idempotent: a healthy database matches 0 rows.
        /// </summary>
        public async Task<int> BackfillDocumentCustodiansAsync()
        {
            var pending = await _context.Documents
                .Where(d => d.GestionnaireUserId == null && d.NumeroBureauOrdre != null)
                .ToListAsync();

            if (pending.Count == 0) return 0;

            var knownUserIds = _context.Utilisateurs.Select(u => u.Id).ToHashSet();
            var updated = 0;

            foreach (var doc in pending)
            {
                var prefix = doc.NumeroBureauOrdre.Split('/').FirstOrDefault();
                if (int.TryParse(prefix, out var ownerId) && knownUserIds.Contains(ownerId))
                {
                    doc.GestionnaireUserId = ownerId;
                    updated++;
                }
            }

            if (updated > 0) await _context.SaveChangesAsync();
            return updated;
        }
    }
}
