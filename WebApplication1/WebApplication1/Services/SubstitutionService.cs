using System.Linq.Expressions;
using Microsoft.AspNetCore.Http;
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
    /// The scope is deliberately <b>narrow</b>: a delegation grants nothing at all
    /// in the substitute's own session. The agent being replaced has their own
    /// service and folders, and those are reached only inside the replacement
    /// workspace, where the middleware makes the caller *be* that agent. Mixing the
    /// two accounts in one listing would give the substitute a merged view of
    /// folders that belong to two different services.
    /// </remarks>
    public class SubstitutionService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor? _httpContextAccessor;

        public SubstitutionService(AppDbContext context, IHttpContextAccessor? httpContextAccessor = null)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        /// <summary>
        /// Close every delegation whose period has elapsed. Called before any read
        /// of the delegation state so an expired delegation never grants anything,
        /// even if no clean-up has run since it lapsed.
        /// </summary>
        public async Task<int> ExpireElapsedDelegationsAsync()
        {
            var now = System.DateTime.Now;
            var elapsed = await _context.Substitutes
                .Where(s => s.IsActive
                    && s.DateFin != null
                    && s.DateFin < now)
                .ToListAsync();

            if (elapsed.Count == 0) return 0;

            foreach (var sub in elapsed)
            {
                sub.IsActive = false;
                sub.Statut = SubstitutionStatusConstants.Termine;
                sub.DateRevocation ??= now;
            }

            await _context.SaveChangesAsync();
            return elapsed.Count;
        }

        /// <summary>Active delegation where <paramref name="userId"/> is the absent agent.</summary>
        public Substitute? GetActiveForAbsentUser(int userId) =>
            _context.Substitutes
                .Where(s => s.UserId == userId && s.IsActive)
                .OrderByDescending(s => s.DateAssignation)
                .FirstOrDefault();

        /// <summary>
        /// Active delegations where <paramref name="userId"/> is the substitute —
        /// accepted, not closed, and still inside their period.
        /// </summary>
        public List<Substitute> GetActiveForSubstitute(int userId) =>
            _context.Substitutes
                .Where(s => s.SubstituteUserId == userId && s.IsActive)
                .Where(s => s.DateFin == null || s.DateFin > System.DateTime.Now)
                .OrderByDescending(s => s.DateAssignation)
                .ToList();

        /// <summary>
        /// Agents this substitute is currently covering. Used to record the
        /// delegation trace — never to widen what they may see.
        /// </summary>
        public List<int> GetCoveredUserIds(int substituteUserId) =>
            _context.Substitutes
                .Where(s => s.SubstituteUserId == substituteUserId && s.IsActive)
                .Select(s => s.UserId)
                .Distinct()
                .ToList();

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
        /// own service holds. Shared by every listing so they cannot drift apart.
        /// </summary>
        /// <remarks>
        /// Delegations deliberately add <b>nothing</b> here. The agent being replaced
        /// has their own service and their own folders; merging those into the
        /// substitute's listing made two separate accounts share one view. The
        /// replaced agent's scope is reached only inside the replacement workspace,
        /// where <see cref="Middleware.DelegationImpersonationMiddleware"/> makes the
        /// caller *be* that agent — so their own scope applies, exactly as it does
        /// when they sign in.
        /// </remarks>
        public static Expression<Func<T, bool>> BuildScopePredicate<T>(
            string? ownServiceCode,
            ServiceTribunal? ownServiceEnum) where T : Document
        {
            return d =>
                // Held by the caller's own service.
                (ownServiceCode != null && d.ServiceActuelCode == ownServiceCode)
                // Legacy rows written before the dynamic service codes existed.
                || (ownServiceCode == null
                    && ownServiceEnum != null
                    && d.ServiceActuelCode == null
                    && d.ServiceActuel == ownServiceEnum.Value);
        }

        /// <summary>
        /// Record that <paramref name="actingUserId"/> acted on behalf of someone.
        /// No-op when the user is not currently substituting for anyone, so this can
        /// be called unconditionally from the mutation endpoints.
        /// </summary>
        public async Task LogDelegatedActionAsync(int actingUserId, string action, int? documentId = null, string? reference = null)
        {
            // Who really acted, and for whom.
            //
            // Outside a workspace the caller acts as themselves, for every agent
            // they cover — and a caller who covers nobody produces no trace at all
            // (the mutation endpoints call this unconditionally). Inside a
            // workspace the absent agent IS the effective principal, so the real
            // person is recovered from the delegation claim the middleware attached.
            var subjects = new List<int>();
            var author = actingUserId;

            var originalClaim = _httpContextAccessor?.HttpContext?.User
                .FindFirst(DelegationConstants.OriginalUserClaim)?.Value;
            if (ServiceMapper.TryParseUserId(originalClaim, out var originalUserId))
            {
                author = originalUserId;
                subjects.Add(actingUserId);
            }
            else
            {
                subjects.AddRange(GetCoveredUserIds(actingUserId));
            }

            if (subjects.Count == 0) return;

            // Resolve the folder reference when the caller did not supply it, so the
            // trace is readable without every endpoint having to look it up.
            if (string.IsNullOrEmpty(reference) && documentId.HasValue)
            {
                reference = _context.Documents
                    .Where(d => d.Id == documentId.Value)
                    .Select(d => d.NumeroReference)
                    .FirstOrDefault();
            }

            foreach (var subject in subjects)
            {
                _context.SubstitutionActions.Add(new SubstitutionAction
                {
                    EffectueParUserId = author,
                    PourUserId = subject,
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
