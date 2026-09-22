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
    /// <summary>
    /// Gestion des équipements.
    ///
    /// <para>The register collects exactly five pieces of information — numéro de
    /// série, informations supplémentaires, type, état and service — and then
    /// drives a two-state treatment: an item is <b>chargé</b> or <b>déchargé</b>,
    /// with the date of discharge recorded on the way out.</para>
    ///
    /// <para>Type and état are codes into the managed lists
    /// <c>types_equipement</c> and <c>etats_equipement</c>; the front-end resolves
    /// their French/Arabic labels, so renaming a list entry needs no code change.</para>
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class EquipmentController : ControllerBase
    {
        private const string TypeList = "types_equipement";
        private const string EtatList = "etats_equipement";

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

        /// <summary>
        /// The type/état choices offered by the entry form. Served from the same
        /// managed lists the register stores codes against, so the form and the
        /// table can never disagree about what a code means.
        /// </summary>
        [HttpGet("lists")]
        public async Task<IActionResult> GetLists()
        {
            var types = await _context.ListItems
                .Where(li => li.ListName == TypeList && li.IsActive)
                .OrderBy(li => li.DisplayOrder)
                .Select(li => new { li.Code, li.ValueFr, li.ValueAr, li.DisplayOrder })
                .ToListAsync();

            var etats = await _context.ListItems
                .Where(li => li.ListName == EtatList && li.IsActive)
                .OrderBy(li => li.DisplayOrder)
                .Select(li => new { li.Code, li.ValueFr, li.ValueAr, li.DisplayOrder })
                .ToListAsync();

            return Ok(new { types, etats });
        }

        [HttpPost]
        [RequirePermission("gerer_equipements")]
        public async Task<IActionResult> Create([FromBody] CreateEquipmentDto dto)
        {
            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var validationError = await ValidateAsync(dto.Serial, dto.Type, dto.Etat, dto.Service, null);
            if (validationError != null)
                return validationError;

            var equipment = new Equipment
            {
                Serial = dto.Serial.Trim(),
                Type = dto.Type,
                Etat = dto.Etat,
                Service = dto.Service,
                AdditionalInfo = string.IsNullOrWhiteSpace(dto.AdditionalInfo) ? null : dto.AdditionalInfo.Trim(),
                // A new item enters the register charged; discharge is a later,
                // explicit action that stamps the date.
                EstCharge = true,
                DateDechargement = null,
                DateCreation = DateTime.Now
            };

            _context.Equipment.Add(equipment);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Équipement créé avec succès", id = equipment.Id });
        }

        /// <summary>
        /// Updates the five entry fields only. The charge state is deliberately
        /// untouched here — it is governed by <c>charger</c>/<c>decharger</c>, so
        /// editing an item can never silently re-charge it.
        /// </summary>
        [HttpPut("{id}")]
        [RequirePermission("gerer_equipements")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateEquipmentDto dto)
        {
            var item = await _context.Equipment.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Équipement non trouvé" });

            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            var serial = string.IsNullOrWhiteSpace(dto.Serial) ? item.Serial : dto.Serial.Trim();
            var validationError = await ValidateAsync(
                serial,
                dto.Type ?? item.Type,
                dto.Etat ?? item.Etat,
                dto.Service ?? item.Service,
                id);
            if (validationError != null)
                return validationError;

            item.Serial = serial;
            item.Type = dto.Type ?? item.Type;
            item.Etat = dto.Etat ?? item.Etat;
            item.Service = dto.Service ?? item.Service;
            if (dto.AdditionalInfo != null)
                item.AdditionalInfo = string.IsNullOrWhiteSpace(dto.AdditionalInfo) ? null : dto.AdditionalInfo.Trim();

            await _context.SaveChangesAsync();
            return Ok(new { message = "Équipement modifié avec succès" });
        }

        /// <summary>Charger: the item returns to the charged state and its discharge date is cleared.</summary>
        [HttpPost("{id}/charger")]
        [RequirePermission("gerer_equipements")]
        public async Task<IActionResult> Charger(int id)
        {
            var item = await _context.Equipment.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Équipement non trouvé" });

            item.EstCharge = true;
            item.DateDechargement = null;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Équipement chargé" });
        }

        /// <summary>Décharger: the item leaves the charged state, stamped with the discharge date.</summary>
        [HttpPost("{id}/decharger")]
        [RequirePermission("gerer_equipements")]
        public async Task<IActionResult> Decharger(int id, [FromBody] DechargerDto? dto)
        {
            var item = await _context.Equipment.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Équipement non trouvé" });

            item.EstCharge = false;
            item.DateDechargement = dto?.DateDechargement ?? DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Équipement déchargé" });
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

        /// <summary>
        /// Shared entry-rule check. <paramref name="ignoreId"/> lets an edit keep
        /// its own serial without tripping the uniqueness rule.
        /// </summary>
        private async Task<IActionResult?> ValidateAsync(
            string? serial, string? type, string? etat, string? service, int? ignoreId)
        {
            if (string.IsNullOrWhiteSpace(serial))
                return BadRequest(new { error = "Le numéro de série est obligatoire" });

            var trimmed = serial.Trim();
            var duplicate = await _context.Equipment.AnyAsync(e =>
                e.Serial == trimmed && (ignoreId == null || e.Id != ignoreId.Value));
            if (duplicate)
                return Conflict(new { error = "Un équipement avec ce numéro de série existe déjà" });

            if (string.IsNullOrWhiteSpace(type))
                return BadRequest(new { error = "Le type est obligatoire" });

            if (string.IsNullOrWhiteSpace(etat))
                return BadRequest(new { error = "L'état est obligatoire" });

            if (string.IsNullOrWhiteSpace(service))
                return BadRequest(new { error = "Le service est obligatoire" });

            return null;
        }
    }

    public class CreateEquipmentDto
    {
        public string Serial { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Etat { get; set; } = string.Empty;
        public string Service { get; set; } = string.Empty;
        public string? AdditionalInfo { get; set; }
    }

    public class UpdateEquipmentDto
    {
        public string? Serial { get; set; }
        public string? Type { get; set; }
        public string? Etat { get; set; }
        public string? Service { get; set; }
        public string? AdditionalInfo { get; set; }
    }

    public class DechargerDto
    {
        public DateTime? DateDechargement { get; set; }
    }
}
