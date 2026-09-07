using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebApplication1.Helpers;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TransactionsController : ControllerBase
    {
        private readonly TransactionService _service;

        public TransactionsController(TransactionService service)
        {
            _service = service;
        }

        private IActionResult Map(ServiceResult result) =>
            result.Success ? Ok(result.Data) : StatusCode(result.StatusCode, result.Data);

        [HttpGet("pending")]
        public async Task<IActionResult> GetPending()
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();
            return Map(await _service.GetPendingAsync(userId));
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAll()
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();
            return Map(await _service.GetAllAsync(userId));
        }

        [HttpPut("{id}/accepter")]
        [RequirePermission("accepter")]
        public async Task<IActionResult> Accepter(int id, [FromBody] CommentDto dto)
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();
            return Map(await _service.AccepterAsync(id, dto.Commentaire, userId, User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ""));
        }

        [HttpPut("{id}/refuser")]
        [RequirePermission("refuser")]
        public async Task<IActionResult> Refuser(int id, [FromBody] RefusDto dto)
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();
            return Map(await _service.RefuserAsync(id, dto.Commentaire, dto.DoitRevenir, userId, User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? ""));
        }

        [HttpPut("{id}/annuler-transition")]
        [RequirePermission("annuler_transfert")]
        public async Task<IActionResult> AnnulerTransition(int id)
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();
            return Map(await _service.AnnulerTransitionAsync(id, userId));
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();
            return Map(await _service.GetStatsAsync(userId));
        }

        [HttpGet("stats-by-service")]
        public async Task<IActionResult> GetStatsByService() =>
            Map(await _service.GetStatsByServiceAsync());

        [HttpGet("count-pending")]
        public async Task<IActionResult> CountPending()
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Ok(new { count = 0 });
            return Map(await _service.CountPendingAsync(userId));
        }

        [HttpGet("doit-revenir")]
        public async Task<IActionResult> GetDoitRevenir()
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized();
            return Map(await _service.GetDoitRevenirAsync(userId));
        }

        [HttpGet("history/{documentId}")]
        public async Task<IActionResult> GetHistory(int documentId) =>
            Map(await _service.GetHistoryAsync(documentId));
    }

    public class CommentDto
    {
        public string? Commentaire { get; set; }
    }

    public class RefusDto
    {
        public string? Commentaire { get; set; }
        public bool DoitRevenir { get; set; }
    }
}
