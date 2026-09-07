using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class ServicesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ServicesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var services = await _context.Services.ToListAsync();
            return Ok(services);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null)
                return NotFound(new { message = "Service non trouvé" });
            return Ok(service);
        }

        [HttpPost]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Create([FromBody] ServiceInfo service)
        {
            if (service == null)
                return BadRequest(new { error = "Données invalides" });

            _context.Services.Add(service);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Service créé avec succès", id = service.Id });
        }

        [HttpPut("{id}")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Update(int id, [FromBody] ServiceInfo dto)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null)
                return NotFound(new { message = "Service non trouvé" });

            service.Nom = dto.Nom ?? service.Nom;
            service.Description = dto.Description ?? service.Description;
            service.Etage = dto.Etage ?? service.Etage;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Service modifié avec succès" });
        }

        [HttpDelete("{id}")]
        [RequirePermission("gerer_services")]
        public async Task<IActionResult> Delete(int id)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null)
                return NotFound(new { message = "Service non trouvé" });

            _context.Services.Remove(service);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Service supprimé avec succès" });
        }
    }
}
