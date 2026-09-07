using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly PermissionService _permissionService;

        public AuthController(AppDbContext context, IConfiguration configuration, PermissionService permissionService)
        {
            _context = context;
            _configuration = configuration;
            _permissionService = permissionService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var user = await _context.Utilisateurs.FirstOrDefaultAsync(u => u.Login == dto.Login);

            if (user == null)
                return Unauthorized(new { message = "Identifiant ou mot de passe incorrect" });

            if (!user.IsActive)
                return Unauthorized(new { message = "Compte désactivé" });

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return Unauthorized(new { message = "Identifiant ou mot de passe incorrect" });

            var jwtKey = _configuration["Jwt:Key"]
                ?? throw new InvalidOperationException("Jwt:Key is missing from configuration");

            // Get user permissions for JWT claims
            var permissions = await _permissionService.GetUserPermissionsAsync(user.Id);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Nom ?? user.Login),
                new Claim(ClaimTypes.Role, user.Role ?? ""),
                new Claim("Service", user.Service ?? ""),
                new Claim("ServiceId", user.ServiceId?.ToString() ?? "")
            };

            // Add permission claims
            foreach (var perm in permissions)
            {
                claims.Add(new Claim("permission", perm));
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: creds
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            return Ok(new
            {
                token = tokenString,
                user = new
                {
                    user.Id,
                    user.Login,
                    user.Nom,
                    user.Role,
                    user.Service,
                    user.ServiceId,
                    permissions
                }
            });
        }

        // GET api/auth/me — fresh user + permissions straight from the DB.
        // Used by the frontend to reflect permission changes made in the admin
        // panel without forcing a full re-login.
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> Me()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId))
                return Unauthorized();

            var user = await _context.Utilisateurs.FindAsync(userId);
            if (user == null || !user.IsActive)
                return Unauthorized(new { message = "Compte introuvable ou désactivé" });

            var permissions = await _permissionService.GetUserPermissionsAsync(user.Id);

            return Ok(new
            {
                user = new
                {
                    user.Id,
                    user.Login,
                    user.Nom,
                    user.Role,
                    user.Service,
                    user.ServiceId,
                    permissions
                }
            });
        }
    }

    public class LoginDto
    {
        [Required]
        public string Login { get; set; } = string.Empty;
        [Required]
        public string Password { get; set; } = string.Empty;
    }
}
