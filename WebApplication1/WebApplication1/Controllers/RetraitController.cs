using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RetraitController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RetraitController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("document/{documentId}")]
        [Authorize]
        public async Task<IActionResult> GetRetraitsByDocument(int documentId)
        {
            var retraits = await _context.Retraits
                .Where(r => r.DocumentId == documentId)
                .OrderByDescending(r => r.DateRetrait)
                .ToListAsync();
            return Ok(retraits);
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAllRetraits()
        {
            var retraits = await _context.Retraits
                .OrderByDescending(r => r.DateRetrait)
                .ToListAsync();
            return Ok(retraits);
        }

        [HttpPost]
        [RequirePermission("retrait_archive")]
        public async Task<IActionResult> CreateRetrait([FromBody] CreateRetraitDto dto)
        {
            var doc = await _context.Documents.FindAsync(dto.DocumentId);
            if (doc == null)
                return NotFound(new { error = "Document non trouvé" });

            var retrait = new Retrait
            {
                DocumentId = dto.DocumentId,
                Reference = dto.Reference,
                EffectuePar = dto.EffectuePar,
                MotifRetrait = dto.MotifRetrait,
                Notes = dto.Notes,
                DateRetrait = dto.DateRetrait != default ? dto.DateRetrait : System.DateTime.Now,
                DateRetour = dto.DateRetour,
                ServiceArchives = dto.ServiceArchives
            };

            _context.Retraits.Add(retrait);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Retrait enregistré avec succès", retrait });
        }

        [HttpPatch("{id}/annuler")]
        [RequirePermission("retrait_archive")]
        public async Task<IActionResult> AnnulerRetrait(int id)
        {
            var retrait = await _context.Retraits.FindAsync(id);
            if (retrait == null)
                return NotFound(new { error = "Retrait non trouvé" });

            retrait.EstAnnule = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Retrait annulé" });
        }

        [HttpPatch("{id}/retourner")]
        [RequirePermission("retrait_archive")]
        public async Task<IActionResult> RetournerRetrait(int id)
        {
            var retrait = await _context.Retraits.FindAsync(id);
            if (retrait == null)
                return NotFound(new { error = "Retrait non trouvé" });

            retrait.DateRetour = System.DateTime.Now;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Document retourné", retrait });
        }

        [HttpDelete("{id}")]
        [RequirePermission("retrait_archive")]
        public async Task<IActionResult> DeleteRetrait(int id)
        {
            var retrait = await _context.Retraits.FindAsync(id);
            if (retrait == null)
                return NotFound(new { error = "Retrait non trouvé" });

            _context.Retraits.Remove(retrait);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Retrait supprimé" });
        }
    }

    public class CreateRetraitDto
    {
        [Range(1, int.MaxValue)]
        public int DocumentId { get; set; }
        public string Reference { get; set; } = string.Empty;
        public string EffectuePar { get; set; } = string.Empty;
        public string MotifRetrait { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public System.DateTime DateRetrait { get; set; }
        public System.DateTime? DateRetour { get; set; }
        public string ServiceArchives { get; set; } = string.Empty;
    }
}
