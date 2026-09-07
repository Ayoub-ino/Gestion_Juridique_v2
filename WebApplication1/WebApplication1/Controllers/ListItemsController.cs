using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class ListItemsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ListItemsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? listName)
        {
            var query = _context.ListItems.AsQueryable();
            if (!string.IsNullOrEmpty(listName))
                query = query.Where(li => li.ListName == listName);

            var items = await query.OrderBy(li => li.DisplayOrder).ToListAsync();
            return Ok(items);
        }

        [HttpGet("{listName}")]
        public async Task<IActionResult> GetByListName(string listName)
        {
            var items = await _context.ListItems
                .Where(li => li.ListName == listName && li.IsActive)
                .OrderBy(li => li.DisplayOrder)
                .ToListAsync();
            return Ok(items);
        }

        [HttpPost]
        [RequirePermission("gerer_listes")]
        public async Task<IActionResult> Create([FromBody] ListItem item)
        {
            if (item == null)
                return BadRequest(new { error = "Données invalides" });

            var exists = await _context.ListItems
                .AnyAsync(li => li.ListName == item.ListName && li.Code == item.Code);
            if (exists)
                return Conflict(new { error = "Ce code existe déjà dans cette liste" });

            _context.ListItems.Add(item);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Élément créé avec succès", id = item.Id });
        }

        [HttpPut("{id}")]
        [RequirePermission("gerer_listes")]
        public async Task<IActionResult> Update(int id, [FromBody] ListItem dto)
        {
            var item = await _context.ListItems.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Élément non trouvé" });

            item.Code = dto.Code ?? item.Code;
            item.ValueFr = dto.ValueFr ?? item.ValueFr;
            item.ValueAr = dto.ValueAr ?? item.ValueAr;
            item.DisplayOrder = dto.DisplayOrder;
            item.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Élément modifié avec succès" });
        }

        [HttpDelete("{id}")]
        [RequirePermission("gerer_listes")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.ListItems.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Élément non trouvé" });

            _context.ListItems.Remove(item);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Élément supprimé avec succès" });
        }
    }
}
