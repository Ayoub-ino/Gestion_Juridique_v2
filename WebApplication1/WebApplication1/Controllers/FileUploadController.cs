using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Wordprocessing;
using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FileUploadController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public FileUploadController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        private string GetUploadsFolder()
        {
            var folder = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "uploads");
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);
            return folder;
        }

        // POST api/FileUpload
        [HttpPost]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "Aucun fichier fourni" });

            var folder = GetUploadsFolder();
            var ext = Path.GetExtension(file.FileName);
            var storedName = $"{DateTime.Now:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{ext}";
            var filePath = Path.Combine(folder, storedName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new
            {
                fileName = file.FileName,
                storedName = storedName,
                size = file.Length,
                url = $"/uploads/{storedName}"
            });
        }

        // POST api/FileUpload/{documentId}
        [HttpPost("{documentId}")]
        public async Task<IActionResult> UploadToDocument(int documentId, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "Aucun fichier fourni" });

            var doc = await _context.Documents.FindAsync(documentId);
            if (doc == null)
                return NotFound(new { error = "Document non trouvé" });

            var folder = GetUploadsFolder();
            var ext = Path.GetExtension(file.FileName);
            var storedName = $"{DateTime.Now:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{ext}";
            var filePath = Path.Combine(folder, storedName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Update FilePath in the document (store storedName for URL building)
            doc.FilePath = storedName;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                documentId,
                fileName = file.FileName,
                storedName,
                size = file.Length,
                url = $"/uploads/{storedName}"
            });
        }

        // GET api/FileUpload/{storedName}
        // Serves files inline for browser preview with streaming and caching
        [HttpGet("{storedName}")]
        public async Task<IActionResult> ServeInline(string storedName)
        {
            var safeName = Path.GetFileName(storedName);
            var folder = GetUploadsFolder();
            var filePath = Path.Combine(folder, safeName);
            if (!System.IO.File.Exists(filePath))
                return NotFound(new { error = "Fichier non trouvé" });

            var ext = Path.GetExtension(safeName).ToLower();
            var contentType = GetContentType(ext);
            var fileInfo = new FileInfo(filePath);
            var lastModified = fileInfo.LastWriteTimeUtc;
            var etag = $"\"{fileInfo.LastWriteTimeUtc.Ticks}-{fileInfo.Length}\"";

            // Check If-None-Match (ETag caching)
            var ifNoneMatch = Request.Headers["If-None-Match"].FirstOrDefault();
            if (ifNoneMatch == etag)
                return StatusCode(304);

            // Check If-Modified-Since
            var ifModifiedSince = Request.Headers["If-Modified-Since"].FirstOrDefault();
            if (DateTime.TryParse(ifModifiedSince, out var modDate) && modDate >= lastModified)
                return StatusCode(304);

            Response.Headers["Cache-Control"] = "private, max-age=3600";
            Response.Headers["ETag"] = etag;
            Response.Headers["Last-Modified"] = lastModified.ToString("R");

            // Stream file efficiently with 8KB buffer
            var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
            return File(stream, contentType);
        }

        // GET api/FileUpload/download/{storedName}
        // Forces browser download with Content-Disposition: attachment header
        [HttpGet("download/{storedName}")]
        [RequirePermission("telecharger_fichiers")]
        public async Task<IActionResult> Download(string storedName)
        {
            var safeName = Path.GetFileName(storedName);
            var folder = GetUploadsFolder();
            var filePath = Path.Combine(folder, safeName);
            if (!System.IO.File.Exists(filePath))
                return NotFound(new { error = "Fichier non trouvé" });

            var ext = Path.GetExtension(safeName).ToLower();
            var contentType = GetContentType(ext);
            var fileInfo = new FileInfo(filePath);

            // Extract original filename from stored name (remove timestamp+GUID prefix)
            var originalName = safeName;
            var underscoreIdx = safeName.IndexOf('_');
            if (underscoreIdx > 0)
            {
                var afterTimestamp = safeName.Substring(underscoreIdx + 1);
                // Skip the GUID part (32 hex chars) and keep the rest as filename
                if (afterTimestamp.Length > 33)
                    originalName = afterTimestamp.Substring(32);
            }

            Response.Headers["Cache-Control"] = "no-store";
            Response.Headers["Content-Disposition"] = $"attachment; filename=\"{originalName}\"; filename*=UTF-8''{Uri.EscapeDataString(originalName)}";

            // Stream file directly to response for zero memory overhead
            var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
            return File(stream, contentType, originalName);
        }

        private static string GetContentType(string ext)
        {
            return ext switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".txt" => "text/plain",
                ".csv" => "text/csv",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".webp" => "image/webp",
                _ => "application/octet-stream"
            };
        }

        // GET api/FileUpload/preview/{storedName}
        [HttpGet("preview/{storedName}")]
        public async Task<IActionResult> Preview(string storedName)
        {
            // Security: sanitize path to prevent directory traversal
            var safeName = Path.GetFileName(storedName);
            var folder = GetUploadsFolder();
            var filePath = Path.Combine(folder, safeName);
            if (!System.IO.File.Exists(filePath))
                return NotFound(new { error = "Fichier non trouvé" });

            var ext = Path.GetExtension(safeName).ToLower();
            var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
            var headerUtf8 = Encoding.UTF8.GetString(fileBytes, 0, Math.Min(fileBytes.Length, 100)).TrimStart('\uFEFF', ' ', '\t', '\r', '\n');

            // Detect HTML content saved with office extension (with or without BOM)
            if (headerUtf8.StartsWith("<html", StringComparison.OrdinalIgnoreCase) ||
                headerUtf8.StartsWith("<!DOCTYPE", StringComparison.OrdinalIgnoreCase))
            {
                var htmlContent = Encoding.UTF8.GetString(fileBytes).TrimStart('\uFEFF');
                return Content(htmlContent, "text/html", Encoding.UTF8);
            }

            if (ext == ".docx")
            {
                try
                {
                    using var stream = new MemoryStream(fileBytes);
                    using var doc = WordprocessingDocument.Open(stream, false);
                    var body = doc.MainDocumentPart?.Document?.Body;
                    if (body == null)
                        return Content(BuildErrorHtml("Corps du document .docx introuvable"), "text/html", Encoding.UTF8);
                    var sb = new StringBuilder();

                    foreach (var element in body.Elements())
                    {
                        if (element is Paragraph para)
                        {
                            var text = para.InnerText;
                            if (string.IsNullOrWhiteSpace(text)) { sb.AppendLine("<br/>"); continue; }

                            var styleId = para.ParagraphProperties?.ParagraphStyleId?.Val?.Value;
                            if (styleId != null && (styleId.StartsWith("Heading") || styleId.StartsWith("Titre")))
                            {
                                sb.AppendLine($"<h2>{System.Net.WebUtility.HtmlEncode(text)}</h2>");
                            }
                            else
                            {
                                sb.AppendLine($"<p>{System.Net.WebUtility.HtmlEncode(text)}</p>");
                            }
                        }
                        else if (element is DocumentFormat.OpenXml.Wordprocessing.Table table)
                        {
                            sb.AppendLine("<table>");
                            foreach (var row in table.Elements<TableRow>())
                            {
                                sb.AppendLine("<tr>");
                                foreach (var cell in row.Elements<TableCell>())
                                {
                                    var cellText = cell.InnerText;
                                    sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(cellText)}</td>");
                                }
                                sb.AppendLine("</tr>");
                            }
                            sb.AppendLine("</table>");
                        }
                    }

                    var html = BuildHtml(storedName, sb.ToString());
                    return Content(html, "text/html", Encoding.UTF8);
                }
                catch (Exception ex)
                {
                    return Content(BuildErrorHtml("Erreur lecture .docx: " + ex.Message), "text/html", Encoding.UTF8);
                }
            }

            if (ext == ".doc")
            {
                try
                {
                    var text = ExtractTextFromDoc(fileBytes);
                    var html = BuildHtml(storedName, text);
                    return Content(html, "text/html", Encoding.UTF8);
                }
                catch (Exception ex)
                {
                    return Content(BuildErrorHtml("Erreur lecture .doc: " + ex.Message), "text/html", Encoding.UTF8);
                }
            }

            if (ext == ".xlsx" || ext == ".xls")
            {
                try
                {
                    using var stream = new MemoryStream(fileBytes);
                    using var doc = SpreadsheetDocument.Open(stream, false);
                    var workbookPart = doc.WorkbookPart;
                    if (workbookPart?.Workbook?.Sheets == null)
                        return Content(BuildErrorHtml("Classeur Excel introuvable"), "text/html", Encoding.UTF8);
                    var sb = new StringBuilder();

                    foreach (var sheet in workbookPart.Workbook.Sheets.Elements<Sheet>())
                    {
                        var sheetId = sheet.Id;
                        if (string.IsNullOrEmpty(sheetId))
                            continue;
                        var worksheetPart = (WorksheetPart?)workbookPart.GetPartById(sheetId!);
                        if (worksheetPart?.Worksheet == null)
                            continue;
                        var rows = worksheetPart.Worksheet.Descendants<Row>();

                        sb.AppendLine("<table>");
                        foreach (var row in rows)
                        {
                            sb.AppendLine("<tr>");
                            foreach (var cell in row.Elements<Cell>())
                            {
                                var cellValue = cell.InnerText;
                                if (cell.DataType != null && cell.DataType.Value == CellValues.SharedString)
                                {
                                    var ssId = int.Parse(cellValue);
                                    cellValue = workbookPart.SharedStringTablePart?.SharedStringTable?.Elements<SharedStringItem>().ElementAt(ssId).Text?.Text ?? "";
                                }
                                sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(cellValue ?? "")}</td>");
                            }
                            sb.AppendLine("</tr>");
                        }
                        sb.AppendLine("</table>");
                    }

                    var html = BuildHtml(storedName, sb.ToString());
                    return Content(html, "text/html", Encoding.UTF8);
                }
                catch (Exception ex)
                {
                    return Content(BuildErrorHtml("Erreur lecture Excel: " + ex.Message), "text/html", Encoding.UTF8);
                }
            }

            // PDF and images: serve directly for inline browser rendering
            if (ext == ".pdf" || ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".gif" || ext == ".webp")
            {
                var contentType = ext switch
                {
                    ".pdf" => "application/pdf",
                    ".png" => "image/png",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".gif" => "image/gif",
                    ".webp" => "image/webp",
                    _ => "application/octet-stream"
                };
                return File(fileBytes, contentType);
            }

            // Unsupported format: show download fallback
            return Content(BuildErrorHtml($"Format {ext} non supporté pour l'aperçu. Utilisez le bouton Télécharger pour sauvegarder le fichier."), "text/html", Encoding.UTF8);
        }

        private string ExtractTextFromDoc(byte[] fileBytes)
        {
            var text = Encoding.Unicode.GetString(fileBytes);

            text = Regex.Replace(text, @"[^\u0000-\u007F\u00C0-\u024F\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s\r\n\t.,;:!?\-()""''…·•\[\]{}\/\\@#$%^&*+=<>~`|]", " ");

            var lines = text.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            var sb = new StringBuilder();
            bool prevWasEmpty = false;

            foreach (var rawLine in lines)
            {
                var line = rawLine.Trim();
                if (string.IsNullOrWhiteSpace(line))
                {
                    if (!prevWasEmpty) { sb.AppendLine("<br/>"); prevWasEmpty = true; }
                    continue;
                }
                prevWasEmpty = false;
                sb.AppendLine($"<p>{System.Net.WebUtility.HtmlEncode(line)}</p>");
            }

            return sb.ToString();
        }

        private string BuildHtml(string fileName, string bodyContent)
        {
            return $@"<!DOCTYPE html>
<html>
<head>
<meta charset=""utf-8"">
<style>
body {{ font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; line-height: 1.8; color: #1e293b; }}
h2 {{ color: #1e40af; margin-top: 20px; }}
p {{ margin: 8px 0; }}
table {{ border-collapse: collapse; width: 100%; margin: 15px 0; }}
td, th {{ border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }}
th {{ background: #f1f5f9; font-weight: bold; }}
.header {{ background: #f8fafc; border-bottom: 2px solid #3b82f6; padding: 12px 20px; margin: -30px -30px 20px -30px; font-size: 12px; color: #64748b; }}
</style>
</head>
<body>
<div class=""header"">📄 {System.Net.WebUtility.HtmlEncode(fileName)}</div>
{bodyContent}
</body>
</html>";
        }

        private string BuildErrorHtml(string message)
        {
            return $@"<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""><style>body{{font-family:Arial,sans-serif;padding:30px;text-align:center;color:#dc2626;}}h2{{margin-top:40px;}}</style></head>
<body>
<h2>⚠️ Erreur de lecture du fichier</h2>
<p>{System.Net.WebUtility.HtmlEncode(message)}</p>
<p style=""color:#64748b;margin-top:20px;font-size:13px;"">Essayez d'ouvrir le fichier directement avec le bouton ci-dessous.</p>
</body>
</html>";
        }
    }
}
