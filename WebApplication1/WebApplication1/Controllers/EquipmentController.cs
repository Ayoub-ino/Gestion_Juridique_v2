using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class EquipmentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EquipmentController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var items = await _context.Equipment
                .OrderByDescending(e => e.DateCreation)
                .ToListAsync();
            return Ok(items);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var item = await _context.Equipment.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Équipement non trouvé" });
            return Ok(item);
        }

        [HttpPost]
        [RequirePermission("gerer_equipements")]
        public async Task<IActionResult> Create([FromBody] CreateEquipmentDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var exists = await _context.Equipment.AnyAsync(e => e.Serial == dto.Serial);
            if (exists)
                return Conflict(new { error = "Ce numéro de série existe déjà" });

            if (!string.IsNullOrEmpty(dto.NumeroInventaire) && await _context.Equipment.AnyAsync(e => e.NumeroInventaire == dto.NumeroInventaire))
                return Conflict(new { error = "Ce numéro d'inventaire existe déjà" });

            var equipment = new Equipment
            {
                Serial = dto.Serial,
                Code = dto.Code,
                Type = dto.Type,
                Etat = dto.Etat,
                Service = dto.Service,
                NumeroInventaire = dto.NumeroInventaire,
                Bureau = dto.Bureau,
                DateCreation = DateTime.Now
            };

            _context.Equipment.Add(equipment);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Équipement créé avec succès", id = equipment.Id });
        }

        [HttpPut("{id}")]
        [RequirePermission("gerer_equipements")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateEquipmentDto dto)
        {
            var item = await _context.Equipment.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Équipement non trouvé" });

            item.Serial = dto.Serial ?? item.Serial;
            item.Code = dto.Code ?? item.Code;
            item.Type = dto.Type ?? item.Type;
            item.Etat = dto.Etat ?? item.Etat;
            item.Service = dto.Service ?? item.Service;
            item.NumeroInventaire = dto.NumeroInventaire ?? item.NumeroInventaire;
            item.Bureau = dto.Bureau ?? item.Bureau;
            item.EstCharge = dto.EstCharge ?? item.EstCharge;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Équipement modifié avec succès" });
        }

        [HttpPut("{id}/toggle-charge")]
        [RequirePermission("gerer_equipements")]
        public async Task<IActionResult> ToggleCharge(int id)
        {
            var item = await _context.Equipment.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Équipement non trouvé" });

            item.EstCharge = !item.EstCharge;
            item.DateDechargement = item.EstCharge ? null : DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(new { message = item.EstCharge ? "Équipement chargé" : "Équipement déchargé" });
        }

        [HttpDelete("{id}")]
        [RequirePermission("gerer_equipements")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.Equipment.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Équipement non trouvé" });

            _context.Equipment.Remove(item);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Équipement supprimé avec succès" });
        }
    }

    public class CreateEquipmentDto
    {
        [Required]
        public string Serial { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        [Required]
        public string Type { get; set; } = string.Empty;
        [Required]
        public string Etat { get; set; } = string.Empty;
        [Required]
        public string Service { get; set; } = string.Empty;
        public string? NumeroInventaire { get; set; }
        public string? Bureau { get; set; }
    }

    public class UpdateEquipmentDto
    {
        public string? Serial { get; set; }
        public string? Code { get; set; }
        public string? Type { get; set; }
        public string? Etat { get; set; }
        public string? Service { get; set; }
        public string? NumeroInventaire { get; set; }
        public string? Bureau { get; set; }
        public bool? EstCharge { get; set; }
    }
}
