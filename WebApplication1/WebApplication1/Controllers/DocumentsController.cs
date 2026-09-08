using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DocumentsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DocumentsController(AppDbContext context)
        {
            _context = context;
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

        // LISTE DES CORBEILLE (docs supprimés)
        [HttpGet("corbeille")]
        [RequirePermission("voir_corbeille")]
        public async Task<IActionResult> GetCorbeille()
        {
            var docs = await _context.Documents
                .Where(d => d.EstSupprime == true)
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

            document.ServiceActuel = ServiceTribunal.Archive;
            document.StatutActuel = StatutDossier.Archive;
            await _context.SaveChangesAsync();
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

            // Delete linked transactions first
            var transactions = await _context.Transactions.Where(t => t.DocumentId == id).ToListAsync();
            _context.Transactions.RemoveRange(transactions);

            // Delete linked document accesses
            var accesses = await _context.DocumentAccesses.Where(da => da.DocumentId == id).ToListAsync();
            _context.DocumentAccesses.RemoveRange(accesses);

            // Delete physical file if exists
            if (!string.IsNullOrEmpty(document.FilePath))
            {
                var fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", document.FilePath.TrimStart('/'));
                if (System.IO.File.Exists(fullPath))
                {
                    System.IO.File.Delete(fullPath);
                }
            }

            // Hard delete the document
            _context.Documents.Remove(document);
            await _context.SaveChangesAsync();

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

            foreach (var doc in documents)
            {
                // Delete linked transactions
                var transactions = await _context.Transactions.Where(t => t.DocumentId == doc.Id).ToListAsync();
                _context.Transactions.RemoveRange(transactions);

                // Delete linked document accesses
                var accesses = await _context.DocumentAccesses.Where(da => da.DocumentId == doc.Id).ToListAsync();
                _context.DocumentAccesses.RemoveRange(accesses);

                // Delete physical file if exists
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
            return Ok(new { message = $"{documents.Count} document(s) supprimé(s) définitivement" });
        }
    }

    public class ArchiveBatchDto
    {
        public List<int> Ids { get; set; } = new();
    }
}