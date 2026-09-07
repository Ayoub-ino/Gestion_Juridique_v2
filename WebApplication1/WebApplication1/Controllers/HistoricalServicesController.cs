using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/historical-services")]
    [Authorize]
    public class HistoricalServicesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HistoricalServicesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> GetAll()
        {
            var services = await _context.HistoricalServices
                .Include(s => s.Parent)
                .OrderBy(s => s.SortOrder)
                .ThenBy(s => s.Nom)
                .Select(s => new
                {
                    s.Id,
                    s.Nom,
                    s.Code,
                    s.Description,
                    s.ParentId,
                    ParentNom = s.Parent != null ? s.Parent.Nom : null,
                    s.SortOrder,
                    s.IsActive,
                    s.CreatedAt,
                    s.UpdatedAt
                })
                .ToListAsync();

            return Ok(services);
        }

        [HttpGet("{id}")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> GetById(int id)
        {
            var service = await _context.HistoricalServices.FindAsync(id);
            if (service == null)
                return NotFound(new { error = "Service historique non trouvé" });

            return Ok(new
            {
                service.Id,
                service.Nom,
                service.Code,
                service.Description,
                service.ParentId,
                service.SortOrder,
                service.IsActive
            });
        }

        [HttpPost]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Create([FromBody] CreateHistoricalServiceDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var exists = await _context.HistoricalServices.AnyAsync(s => s.Code == dto.Code);
            if (exists)
                return Conflict(new { error = "Ce code existe déjà" });

            var service = new HistoricalService
            {
                Nom = dto.Nom,
                Code = dto.Code,
                Description = dto.Description,
                ParentId = dto.ParentId,
                SortOrder = dto.SortOrder,
                IsActive = true
            };

            _context.HistoricalServices.Add(service);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Service historique créé avec succès", id = service.Id });
        }

        [HttpPut("{id}")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateHistoricalServiceDto dto)
        {
            var service = await _context.HistoricalServices.FindAsync(id);
            if (service == null)
                return NotFound(new { error = "Service historique non trouvé" });

            if (dto.Nom != null) service.Nom = dto.Nom;
            if (dto.Code != null) service.Code = dto.Code;
            if (dto.Description != null) service.Description = dto.Description;
            if (dto.ParentId.HasValue) service.ParentId = dto.ParentId;
            if (dto.SortOrder.HasValue) service.SortOrder = dto.SortOrder.Value;
            if (dto.IsActive.HasValue) service.IsActive = dto.IsActive.Value;

            service.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Service historique modifié avec succès" });
        }

        [HttpDelete("{id}")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Delete(int id)
        {
            var service = await _context.HistoricalServices.FindAsync(id);
            if (service == null)
                return NotFound(new { error = "Service historique non trouvé" });

            // Check if it has children
            var hasChildren = await _context.HistoricalServices.AnyAsync(s => s.ParentId == id);
            if (hasChildren)
                return BadRequest(new { error = "Impossible de supprimer: ce service a des sous-services" });

            _context.HistoricalServices.Remove(service);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Service historique supprimé avec succès" });
        }
    }

    public class CreateHistoricalServiceDto
    {
        [Required]
        public string Nom { get; set; } = string.Empty;
        [Required]
        public string Code { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? ParentId { get; set; }
        public int SortOrder { get; set; } = 0;
    }

    public class UpdateHistoricalServiceDto
    {
        public string? Nom { get; set; }
        public string? Code { get; set; }
        public string? Description { get; set; }
        public int? ParentId { get; set; }
        public int? SortOrder { get; set; }
        public bool? IsActive { get; set; }
    }
}