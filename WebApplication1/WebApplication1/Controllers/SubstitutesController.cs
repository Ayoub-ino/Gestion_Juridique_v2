using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SubstitutesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SubstitutesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUserId(int userId)
        {
            var sub = await _context.Substitutes
                .Where(s => s.UserId == userId && s.IsActive)
                .Select(s => new {
                    s.Id,
                    s.UserId,
                    s.SubstituteUserId,
                    SubstituteUserName = _context.Utilisateurs
                        .Where(u => u.Id == s.SubstituteUserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    s.DateAssignation,
                    s.DateRevocation,
                    s.IsActive
                })
                .ToListAsync();
            return Ok(sub);
        }

        [HttpGet("history/{userId}")]
        public async Task<IActionResult> GetHistory(int userId)
        {
            var history = await _context.Substitutes
                .Where(s => s.UserId == userId)
                .Select(s => new {
                    s.Id,
                    s.UserId,
                    s.SubstituteUserId,
                    SubstituteUserName = _context.Utilisateurs
                        .Where(u => u.Id == s.SubstituteUserId)
                        .Select(u => u.Nom)
                        .FirstOrDefault(),
                    s.DateAssignation,
                    s.DateRevocation,
                    s.IsActive
                })
                .OrderByDescending(s => s.DateAssignation)
                .ToListAsync();
            return Ok(history);
        }

        [HttpPost]
        [RequirePermission("gerer_substituts")]
        public async Task<IActionResult> Create([FromBody] SubstituteDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var substitute = new Substitute
            {
                UserId = dto.UserId,
                SubstituteUserId = dto.SubstituteUserId,
                DateAssignation = DateTime.Now,
                IsActive = true
            };

            _context.Substitutes.Add(substitute);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Remplaçant défini avec succès" });
        }

        [HttpDelete("{id}")]
        [RequirePermission("gerer_substituts")]
        public async Task<IActionResult> Delete(int id)
        {
            var sub = await _context.Substitutes.FindAsync(id);
            if (sub == null)
                return NotFound(new { message = "Substitution non trouvée" });

            sub.IsActive = false;
            sub.DateRevocation = DateTime.Now;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Remplaçant annulé avec succès" });
        }
    }

    public class SubstituteDto
    {
        public int UserId { get; set; }
        public int SubstituteUserId { get; set; }
    }
}
