using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebApplication1.DTO;
using WebApplication1.Helpers;
using WebApplication1.Models;
using WebApplication1.Security;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WorkspaceController : ControllerBase
    {
        private readonly WorkspaceService _service;
        private readonly DocumentAccessService _accessService;

        public WorkspaceController(WorkspaceService service, DocumentAccessService accessService)
        {
            _service = service;
            _accessService = accessService;
        }

        private IActionResult Map(ServiceResult result) =>
            result.Success ? Ok(result.Data) : StatusCode(result.StatusCode, result.Data);

        // ============ GET document full details ============
        [HttpGet("document/{id}")]
        [RequirePermission("voir_workspace")]
        public async Task<IActionResult> GetDocument(int id) =>
            Map(await _service.GetDocumentAsync(id));

        // ============ PUT update document (ACL-gated) ============
        [HttpPut("document/{id}")]
        [RequirePermission("creer_modifier")]
        public async Task<IActionResult> UpdateDocument(int id, [FromBody] UpdateDocumentDto dto)
        {
            // Resolve current user
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!ServiceMapper.TryParseUserId(userIdStr, out var userId))
                return Unauthorized();

            // Ensure backward-compatible ACL initialization for legacy documents
            var doc = await _service.GetDocumentAsync(id);
            if (!doc.Success)
                return StatusCode(doc.StatusCode, doc.Data);

            // Extract current service from document details
            var docData = doc.Data as dynamic;
            string currentService = docData?.ServiceActuel?.ToString() ?? "";
            if (!string.IsNullOrEmpty(currentService))
            {
                var normalizedService = currentService.ToLowerInvariant();
                await _accessService.EnsureAccessInitializedAsync(id, normalizedService);
            }

            // Check ACL: user must have Editor or Owner access
            var user = await _service.GetUserByIdAsync(userId);
            var isAdminLike = user?.Role is "Admin" or "Greffier" or "Directeur" or "Consultant";

            if (!isAdminLike)
            {
                var hasEditAccess = await _accessService.UserHasAccessAsync(id, userId, DocumentAccessLevel.Editor);
                if (!hasEditAccess)
                {
                    return StatusCode(403, new { error = "Accès refusé: vous n'avez pas les droits de modification sur ce document" });
                }
            }

            var (userName, userService) = await ResolveUserAsync();
            return Map(await _service.UpdateDocumentAsync(id, dto, userName, userService));
        }

        // ============ DOCUMENT ACCESS (ACL) ============
        [HttpGet("document/{id}/access")]
        public async Task<IActionResult> GetDocumentAccess(int id)
        {
            // Auto-initialize ACL for legacy documents that have no access rows
            var accessList = await _accessService.GetDocumentAccessListAsync(id);
            if (accessList.Count == 0)
            {
                // Fetch the document to determine its current service
                var doc = await _service.GetDocumentAsync(id);
                if (doc.Success)
                {
                    var docData = doc.Data as dynamic;
                    string currentService = docData?.ServiceActuel?.ToString() ?? "";
                    if (!string.IsNullOrEmpty(currentService))
                    {
                        await _accessService.EnsureAccessInitializedAsync(id, currentService);
                        accessList = await _accessService.GetDocumentAccessListAsync(id);
                    }
                }
            }
            return Ok(accessList);
        }

        // ============ GRANT ACCESS (Owner only) ============
        [HttpPost("document/{id}/access")]
        [RequirePermission("gerer_permissions")]
        public async Task<IActionResult> GrantAccess(int id, [FromBody] GrantAccessDto dto)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            ServiceMapper.TryParseUserId(userIdStr, out var userId);

            if (!Enum.TryParse<DocumentAccessLevel>(dto.AccessLevel, true, out var level))
                return BadRequest(new { error = "Niveau d'accès invalide (Viewer/Editor/Owner)" });

            await _accessService.UpsertAccessForUserAsync(id, dto.ServiceCode, level, userId);
            return Ok(new { message = $"Accès {dto.AccessLevel} accordé au service {dto.ServiceCode}" });
        }

        // ============ REVOKE ACCESS ============
        [HttpDelete("document/{id}/access/{serviceCode}")]
        [RequirePermission("gerer_permissions")]
        public async Task<IActionResult> RevokeAccess(int id, string serviceCode)
        {
            await _accessService.RevokeAccessAsync(id, serviceCode);
            return Ok(new { message = $"Accès révoqué pour le service {serviceCode}" });
        }

        // ============ BACKFILL ACL for all existing documents ============
        [HttpPost("document/backfill-acl")]
        [RequirePermission("gerer_permissions")]
        public async Task<IActionResult> BackfillAcl()
        {
            var backfilled = await _accessService.BackfillAllDocumentAccessAsync();
            return Ok(new { message = $"{backfilled} documents ont été initialisés avec les accès ACL", count = backfilled });
        }

        // ============ NOTES ============
        [HttpGet("document/{id}/notes")]
        public async Task<IActionResult> GetNotes(int id) =>
            Map(await _service.GetNotesAsync(id));

        [HttpPost("document/{id}/notes")]
        [RequirePermission("ajouter_notes")]
        public async Task<IActionResult> AddNote(int id, [FromBody] AddNoteDto dto)
        {
            var (userName, userService) = await ResolveUserAsync();
            return Map(await _service.AddNoteAsync(id, dto, userName, userService));
        }

        [HttpPut("notes/{noteId}")]
        [RequirePermission("ajouter_notes")]
        public async Task<IActionResult> UpdateNote(int noteId, [FromBody] AddNoteDto dto) =>
            Map(await _service.UpdateNoteAsync(noteId, dto));

        [HttpDelete("notes/{noteId}")]
        [RequirePermission("ajouter_notes")]
        public async Task<IActionResult> DeleteNote(int noteId) =>
            Map(await _service.DeleteNoteAsync(noteId));

        // ============ MODIFICATIONS AUDIT ============
        [HttpGet("document/{id}/modifications")]
        [RequirePermission("voir_historique")]
        public async Task<IActionResult> GetModifications(int id) =>
            Map(await _service.GetModificationsAsync(id));

        private async Task<(string Name, string Service)> ResolveUserAsync()
        {
            if (!ServiceMapper.TryParseUserId(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return ("Inconnu", "");
            return (await _service.GetUserNameAsync(userId), await _service.GetUserServiceAsync(userId));
        }
    }

    public class GrantAccessDto
    {
        public string ServiceCode { get; set; } = string.Empty;
        public string AccessLevel { get; set; } = "Editor";
    }
}
