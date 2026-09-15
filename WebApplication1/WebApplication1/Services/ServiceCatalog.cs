using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Resolves a service identifier coming from the client (RBAC service code,
    /// service display name, historical service code, or a legacy ServiceTribunal
    /// enum name) to the canonical RBAC <c>Service.Code</c>.
    ///
    /// The lookup reads the live database, so services created or archived from
    /// the admin panel are immediately valid or invalid without code changes.
    /// </summary>
    public class ServiceCatalog
    {
        private readonly AppDbContext _context;

        public ServiceCatalog(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Resolve a raw identifier to an RBAC service code.
        /// Returns null when nothing matches (caller should reject the request).
        /// </summary>
        public async Task<string?> ResolveCodeAsync(string? raw)
        {
            var normalized = ServiceMapper.NormalizeServiceCode(raw);
            if (string.IsNullOrEmpty(normalized)) return null;

            // 1. Live services managed from the admin panel (by code or display name)
            var services = await _context.RbacServices
                .Select(s => new { s.Code, s.Nom })
                .ToListAsync();

            var match = services.FirstOrDefault(s =>
                ServiceMapper.NormalizeServiceCode(s.Code) == normalized ||
                ServiceMapper.NormalizeServiceCode(s.Nom) == normalized);
            if (match != null) return match.Code;

            // 2. Historical (record-only) services
            var historical = await _context.HistoricalServices
                .Select(s => new { s.Code, s.Nom })
                .ToListAsync();

            var historicalMatch = historical.FirstOrDefault(s =>
                ServiceMapper.NormalizeServiceCode(s.Code) == normalized ||
                ServiceMapper.NormalizeServiceCode(s.Nom) == normalized);
            if (historicalMatch != null) return historicalMatch.Code;

            // 3. Legacy enum name / French label
            if (ServiceMapper.TryMapToServiceEnum(raw ?? "", out var enumValue))
                return DocumentAccessService.ServiceTribunalToRbacCode(enumValue);

            return null;
        }

        /// <summary>
        /// True when the value looks like a historical (record-only) service.
        /// </summary>
        public async Task<bool> IsHistoricalServiceAsync(string? raw)
        {
            var normalized = ServiceMapper.NormalizeServiceCode(raw);
            if (string.IsNullOrEmpty(normalized)) return false;

            var historical = await _context.HistoricalServices
                .Select(s => new { s.Code, s.Nom })
                .ToListAsync();

            return historical.Any(s =>
                ServiceMapper.NormalizeServiceCode(s.Code) == normalized ||
                ServiceMapper.NormalizeServiceCode(s.Nom) == normalized);
        }
    }
}
