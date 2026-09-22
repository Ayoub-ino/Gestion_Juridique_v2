using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DocumentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly DocumentAccessService _accessService;
        private readonly SubstitutionService _substitutions;

        public DocumentsController(AppDbContext context, DocumentAccessService accessService, SubstitutionService substitutions)
        {
            _context = context;
            _accessService = accessService;
            _substitutions = substitutions;
        }

        /// <summary>
        /// Visibility scope of the caller. Admin-like roles (Admin, Greffier,
        /// Directeur, Consultant) see every document; everyone else is restricted
        /// to the documents currently held by their own RBAC service.
        /// This mirrors the service scoping already applied by the listing
        /// controllers, so a user's trash only contains what they deleted.
        /// </summary>
        private async Task<Scope> ResolveScopeAsync()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(userIdStr, out var userId))
                return Scope.None;

            var user = await _context.Utilisateurs.FindAsync(userId);
            if (user == null) return Scope.None;

            var role = user.Role ?? "";
            if (role == "Admin" || role == "Greffier" || role == "Directeur" || role == "Consultant")
                return Scope.Admin;

            // The caller's own service, plus the folders entrusted to any agent they
            // are substituting for — never the whole service of the absent agent.
            return new Scope(
                false,
                _substitutions.GetOwnServiceCode(userId),
                _substitutions.GetOwnServiceEnum(userId),
                _substitutions.GetCoveredUserIds(userId));
        }

        /// <summary>Visibility scope of a non-administrator caller.</summary>
        private readonly record struct Scope(
            bool IsAdminLike,
            string? OwnServiceCode,
            ServiceTribunal? OwnServiceEnum,
            List<int> CoveredUserIds)
        {
            public static readonly Scope None =
                new(false, null, null, new List<int>());

            public static readonly Scope Admin =
                new(true, null, null, new List<int>());
        }

        // SOFT DELETE - Suppression logique
        [HttpPatch("{id}/supprimer")]
        [RequirePermission("supprimer")]
        public async Task<IActionResult> Supprimer(int id)
        {
            var document = await _context.Documents.FirstOrDefaultAsync(d => d.Id == id);
            if (document == null)
                return NotFound(new { error = "Document non trouvé" });

            document.EstSupprime = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Document supprimé (suppression logique)" });
        }

        // RESTORE - Restaurer un document supprimé
        [HttpPatch("{id}/restaurer")]
        [RequirePermission("restaurer")]
        public async Task<IActionResult> Restaurer(int id)
        {
            var document = await _context.Documents.FirstOrDefaultAsync(d => d.Id == id);
            if (document == null)
                return NotFound(new { error = "Document non trouvé" });

            document.EstSupprime = false;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Document restauré avec succès", id = document.Id });
        }

        // BATCH SOFT DELETE
        [HttpPost("supprimer-batch")]
        [RequirePermission("supprimer")]
        public async Task<IActionResult> SupprimerBatch([FromBody] List<int> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest(new { error = "Aucun document sélectionné" });

            var documents = await _context.Documents.Where(d => ids.Contains(d.Id)).ToListAsync();
            foreach (var doc in documents)
            {
                doc.EstSupprime = true;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{documents.Count} document(s) supprimé(s)" });
        }

        /// <summary>
        /// Trash query, scoped to the caller. The trash belongs to the service
        /// that deleted the document: a user only sees what their own service
        /// put there. Admin-like roles keep the global view.
        /// Shared by the corbeille listing and "empty trash" so the visible
        /// rows and the purged rows can never drift apart.
        /// </summary>
        private IQueryable<Document> ScopedCorbeilleQuery(Scope scope)
        {
            var query = _context.Documents.Where(d => d.EstSupprime == true);

            if (!scope.IsAdminLike
                && (scope.OwnServiceCode != null || scope.CoveredUserIds.Count > 0))
            {
                query = query.Where(SubstitutionService.BuildScopePredicate<Document>(
                    scope.OwnServiceCode, scope.OwnServiceEnum, scope.CoveredUserIds));
            }

            return query;
        }

        // LISTE DES CORBEILLE (docs supprimés)
        [HttpGet("corbeille")]
        [RequirePermission("voir_corbeille")]
        public async Task<IActionResult> GetCorbeille()
        {
            var scope = await ResolveScopeAsync();
            var query = ScopedCorbeilleQuery(scope);

            var docs = await query
                .OrderByDescending(d => d.DateCreation)
                .Select(d => new {
                    id = d.Id,
                    reference = d.NumeroReference,
                    objet = d.Sujet ?? d.Objet,
                    serviceActuel = d.ServiceActuel.ToString(),
                    statut = d.StatutActuel.ToString(),
                    date = d.DateCreation.ToString("dd/MM/yyyy"),
                    numeroBureauOrdre = d.NumeroBureauOrdre
                })
                .ToListAsync();
            return Ok(docs);
        }

        /// <summary>
        /// Hard-deletes the given documents together with everything attached to
        /// them: transaction history, ACL rows and the physical file on disk.
        /// Returns the number of purged documents.
        /// </summary>
        private async Task<int> PurgeDocumentsAsync(List<Document> documents)
        {
            foreach (var doc in documents)
            {
                var transactions = await _context.Transactions.Where(t => t.DocumentId == doc.Id).ToListAsync();
                _context.Transactions.RemoveRange(transactions);

                var accesses = await _context.DocumentAccesses.Where(da => da.DocumentId == doc.Id).ToListAsync();
                _context.DocumentAccesses.RemoveRange(accesses);

                if (!string.IsNullOrEmpty(doc.FilePath))
                {
                    var fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", doc.FilePath.TrimStart('/'));
                    if (System.IO.File.Exists(fullPath))
                    {
                        System.IO.File.Delete(fullPath);
                    }
                }

                _context.Documents.Remove(doc);
            }

            await _context.SaveChangesAsync();
            return documents.Count;
        }

        // EMPTY TRASH - Vider la corbeille (suppression définitive de tout ce
        // qu'elle contient, limité au périmètre de l'appelant)
        [HttpDelete("corbeille")]
        [RequirePermission("supprimer")]
        public async Task<IActionResult> EmptyCorbeille()
        {
            var scope = await ResolveScopeAsync();
            var documents = await ScopedCorbeilleQuery(scope)
                .ToListAsync();

            var count = await PurgeDocumentsAsync(documents);
            return Ok(new { message = $"{count} document(s) supprimé(s) définitivement", count });
        }

        // GET: api/Documents (sans supprimés)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Document>>> GetDocuments()
        {
            return await _context.Documents
                .Where(d => !d.EstSupprime)
                .ToListAsync();
        }

        // ARCHIVE (PATCH)
        [HttpPatch("{id}/archive")]
        [RequirePermission("archiver")]
        public async Task<IActionResult> ArchiveDocument(int id)
        {
            var document = await _context.Documents.FindAsync(id);
            if (document == null)
                return NotFound();

            // ── CUSTODY CHECK: only the current service holder can archive ──
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
            {
                if (!_accessService.IsUserCustodian(document, userId))
                    return StatusCode(403, new { error = "Vous n'êtes pas le détenteur actuel de ce document." });
            }

            document.ServiceActuel = ServiceTribunal.Archive;
            document.ServiceActuelCode = DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.Archive);
            document.StatutActuel = StatutDossier.Archive;
            await _context.SaveChangesAsync();

            if (ServiceMapper.TryParseUserId(userIdClaim, out var archivedBy))
                await _substitutions.LogDelegatedActionAsync(archivedBy, "Archivage", document.Id, document.NumeroReference);

            return Ok(new { message = "Document archivé avec succès" });
        }

        // ARCHIVE EN MASSE (POST)
        [HttpPost("archive-batch")]
        [RequirePermission("archiver")]
        public async Task<IActionResult> ArchiveBatch([FromBody] ArchiveBatchDto dto)
        {
            if (dto.Ids == null || dto.Ids.Count == 0)
                return BadRequest(new { error = "Aucun document sélectionné" });

            var documents = await _context.Documents.Where(d => dto.Ids.Contains(d.Id)).ToListAsync();
            foreach (var doc in documents)
            {
                doc.ServiceActuel = ServiceTribunal.Archive;
                doc.ServiceActuelCode = DocumentAccessService.ServiceTribunalToRbacCode(ServiceTribunal.Archive);
                doc.StatutActuel = StatutDossier.Archive;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{documents.Count} document(s) archivé(s)" });
        }

        // RAPPELS AUTOMATIQUES - Documents > 48h sans traitement
        [HttpGet("reminders")]
        [Authorize]
        public async Task<IActionResult> GetReminders()
        {
            var threshold = System.DateTime.Now.AddHours(-48);

            var lateDocs = await _context.Transactions
                .Include(t => t.Document)
                .Where(t => t.Statut == StatutTransaction.EnAttente
                    && t.DateTransaction <= threshold
                    && !t.Document.EstSupprime)
                .Select(t => new {
                    documentId = t.DocumentId,
                    reference = t.Document.NumeroReference,
                    objet = t.Document.Sujet ?? t.Document.Objet,
                    serviceOrigine = t.ServiceOrigine.ToString(),
                    serviceDestination = t.ServiceDestination.ToString(),
                    dateTransfert = t.DateTransaction.ToString("dd/MM/yyyy HH:mm"),
                    joursAttente = (int)(System.DateTime.Now - t.DateTransaction).TotalDays,
                    doItRevenir = t.DoitRevenir
                })
                .OrderByDescending(d => d.joursAttente)
                .ToListAsync();

            return Ok(lateDocs);
        }

        // PERMANENT DELETE - Suppression définitive (hard delete)
        [HttpDelete("{id}/permanent")]
        [RequirePermission("supprimer")]
        public async Task<IActionResult> PermanentDelete(int id)
        {
            var document = await _context.Documents.FirstOrDefaultAsync(d => d.Id == id);
            if (document == null)
                return NotFound(new { error = "Document non trouvé" });

            if (!document.EstSupprime)
                return BadRequest(new { error = "Ce document n'est pas archivé. Supprimez-le d'abord." });

            await PurgeDocumentsAsync(new List<Document> { document });

            return Ok(new { message = "Document supprimé définitivement" });
        }

        // BATCH PERMANENT DELETE
        [HttpPost("permanent-delete-batch")]
        [RequirePermission("supprimer")]
        public async Task<IActionResult> PermanentDeleteBatch([FromBody] List<int> ids)
        {
            if (ids == null || ids.Count == 0)
                return BadRequest(new { error = "Aucun document sélectionné" });

            var documents = await _context.Documents
                .Where(d => ids.Contains(d.Id) && d.EstSupprime)
                .ToListAsync();

            var count = await PurgeDocumentsAsync(documents);
            return Ok(new { message = $"{count} document(s) supprimé(s) définitivement" });
        }
    }

    public class ArchiveBatchDto
    {
        public List<int> Ids { get; set; } = new();
    }
}