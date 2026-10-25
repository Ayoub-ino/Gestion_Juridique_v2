using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Field configuration of the three « Gérer les courriers » forms.
    ///
    /// Reading is open to any authenticated user (the forms need it to render);
    /// changing the field set requires the <c>gerer_champs_courrier</c> permission,
    /// which the admin panel grants like any other — nothing is hardcoded.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CourrierFieldsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CourrierFieldService _fieldService;

        public CourrierFieldsController(AppDbContext context, CourrierFieldService fieldService)
        {
            _context = context;
            _fieldService = fieldService;
        }

        /// <summary>Active fields of one form, in order — what the form renders.</summary>
        [HttpGet("{type}")]
        public async Task<IActionResult> GetByType(string type)
        {
            if (!CourrierFieldService.IsKnownType(type))
                return BadRequest(new { error = "Type de courrier inconnu" });

            var fields = await _fieldService.GetFieldsAsync(type);
            return Ok(fields.Select(ToDto));
        }

        /// <summary>
        /// Every field of every type, including hidden ones — the admin screen.
        /// </summary>
        [HttpGet]
        [RequirePermission("gerer_champs_courrier")]
        public async Task<IActionResult> GetAll()
        {
            var fields = await _fieldService.GetAllFieldsAsync();
            return Ok(fields.Select(ToDto));
        }

        /// <summary>Add a field the administrator defines.</summary>
        [HttpPost]
        [RequirePermission("gerer_champs_courrier")]
        public async Task<IActionResult> Create([FromBody] CourrierFieldDto dto)
        {
            if (dto == null || !CourrierFieldService.IsKnownType(dto.CourrierType))
                return BadRequest(new { error = "Type de courrier inconnu" });

            if (string.IsNullOrWhiteSpace(dto.LabelFr) && string.IsNullOrWhiteSpace(dto.LabelAr))
                return BadRequest(new { error = "Le libellé du champ est obligatoire" });

            var key = string.IsNullOrWhiteSpace(dto.FieldKey)
                ? await BuildUniqueKeyAsync(dto.CourrierType, dto.LabelFr ?? dto.LabelAr ?? "champ")
                : dto.FieldKey!.Trim();

            var exists = await _context.CourrierFields
                .AnyAsync(f => f.CourrierType == dto.CourrierType && f.FieldKey == key);
            if (exists)
                return Conflict(new { error = "Un champ avec cette clé existe déjà dans ce formulaire" });

            var nextOrder = await _context.CourrierFields
                .Where(f => f.CourrierType == dto.CourrierType)
                .Select(f => (int?)f.DisplayOrder)
                .MaxAsync() ?? 0;

            var field = new CourrierFieldConfig
            {
                CourrierType = dto.CourrierType,
                FieldKey = key,
                LabelFr = dto.LabelFr?.Trim() ?? string.Empty,
                LabelAr = dto.LabelAr?.Trim() ?? string.Empty,
                FieldType = NormalizeType(dto.FieldType),
                IsRequired = dto.IsRequired ?? false,
                IsActive = dto.IsActive ?? true,
                IsCustom = true,
                DisplayOrder = nextOrder + 1
            };

            _context.CourrierFields.Add(field);
            await _context.SaveChangesAsync();
            return StatusCode(201, ToDto(field));
        }

        /// <summary>
        /// Update a field: label, widget, required flag, visibility. The key is
        /// immutable — it binds the field to its widget and to stored values.
        /// </summary>
        [HttpPut("{id}")]
        [RequirePermission("gerer_champs_courrier")]
        public async Task<IActionResult> Update(int id, [FromBody] CourrierFieldDto dto)
        {
            var field = await _context.CourrierFields.FindAsync(id);
            if (field == null)
                return NotFound(new { error = "Champ non trouvé" });

            if (dto == null)
                return BadRequest(new { error = "Données invalides" });

            if (dto.LabelFr != null) field.LabelFr = dto.LabelFr.Trim();
            if (dto.LabelAr != null) field.LabelAr = dto.LabelAr.Trim();
            if (dto.FieldType != null) field.FieldType = NormalizeType(dto.FieldType);
            if (dto.IsRequired.HasValue) field.IsRequired = dto.IsRequired.Value;
            if (dto.IsActive.HasValue) field.IsActive = dto.IsActive.Value;
            if (dto.DisplayOrder.HasValue) field.DisplayOrder = dto.DisplayOrder.Value;

            await _context.SaveChangesAsync();
            return Ok(ToDto(field));
        }

        /// <summary>Apply a new order in one call (the admin screen's up/down moves).</summary>
        [HttpPost("reorder")]
        [RequirePermission("gerer_champs_courrier")]
        public async Task<IActionResult> Reorder([FromBody] List<CourrierFieldOrderDto> order)
        {
            if (order == null || order.Count == 0)
                return BadRequest(new { error = "Ordre vide" });

            var ids = order.Select(o => o.Id).ToList();
            var fields = await _context.CourrierFields.Where(f => ids.Contains(f.Id)).ToListAsync();

            foreach (var field in fields)
            {
                var match = order.FirstOrDefault(o => o.Id == field.Id);
                if (match != null) field.DisplayOrder = match.DisplayOrder;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Ordre enregistré" });
        }

        /// <summary>
        /// Remove a field from a form. Values already stored in the field's own
        /// column are left untouched, so nothing is lost if it is added back.
        /// </summary>
        [HttpDelete("{id}")]
        [RequirePermission("gerer_champs_courrier")]
        public async Task<IActionResult> Delete(int id)
        {
            var field = await _context.CourrierFields.FindAsync(id);
            if (field == null)
                return NotFound(new { error = "Champ non trouvé" });

            _context.CourrierFields.Remove(field);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Champ supprimé" });
        }

        // ============ HELPERS ============

        private static object ToDto(CourrierFieldConfig f) => new
        {
            f.Id,
            f.CourrierType,
            f.FieldKey,
            f.LabelFr,
            f.LabelAr,
            f.FieldType,
            f.IsRequired,
            f.IsActive,
            f.IsCustom,
            f.DisplayOrder
        };

        /// <summary>Allowed widget hints; anything else falls back to a text input.</summary>
        private static readonly string[] FieldTypes =
            { "text", "number", "date", "textarea", "select", "checkbox", "file" };

        private static string NormalizeType(string? type)
        {
            var value = (type ?? "text").Trim().ToLowerInvariant();
            return FieldTypes.Contains(value) ? value : "text";
        }

        /// <summary>
        /// Turn a label into a stable, unique key ("Numéro de recours" →
        /// "numero_de_recours", then "numero_de_recours_2" if taken).
        ///
        /// Accents are folded to their base letter so a key is ASCII whenever the
        /// label is: "Numéro" and "Numero" must not produce two different keys.
        /// </summary>
        private async Task<string> BuildUniqueKeyAsync(string type, string label)
        {
            var normalized = label.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder();
            foreach (var ch in normalized)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
                if (char.IsLetterOrDigit(ch)) builder.Append(ch);
                else if (builder.Length > 0 && builder[^1] != '_') builder.Append('_');
            }

            var baseKey = builder.ToString().Trim('_');
            if (string.IsNullOrEmpty(baseKey)) baseKey = "champ";

            var key = baseKey;
            var suffix = 1;
            while (await _context.CourrierFields.AnyAsync(f => f.CourrierType == type && f.FieldKey == key))
            {
                suffix++;
                key = $"{baseKey}_{suffix}";
            }
            return key;
        }
    }

    public class CourrierFieldDto
    {
        public string CourrierType { get; set; } = string.Empty;
        public string? FieldKey { get; set; }
        public string? LabelFr { get; set; }
        public string? LabelAr { get; set; }
        public string? FieldType { get; set; }
        public bool? IsRequired { get; set; }
        public bool? IsActive { get; set; }
        /// <summary>Ignored on create (the field is appended); used by the reorder call.</summary>
        public int? DisplayOrder { get; set; }
    }

    public class CourrierFieldOrderDto
    {
        public int Id { get; set; }
        public int DisplayOrder { get; set; }
    }
}
