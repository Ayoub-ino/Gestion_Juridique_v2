using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using WebApplication1.Data;
using WebApplication1.Middleware;
using WebApplication1.Models;
using WebApplication1.Security;
using WebApplication1.Services;

var builder = WebApplication.CreateBuilder(args);

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is missing from appsettings.json");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = null,
        ValidAudience = null,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// CORS origins are configurable (appsettings Cors:AllowedOrigins or env Cors__AllowedOrigins__0).
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
});

// ===== CONFIGURATION JSON : ENUMS EN CHAÎNES =====
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddOpenApi();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<WebApplication1.Services.PermissionService>();
builder.Services.AddScoped<WebApplication1.Services.PermissionValidationService>();
builder.Services.AddScoped<WebApplication1.Services.SeederService>();
builder.Services.AddScoped<WebApplication1.Services.TransactionService>();
builder.Services.AddScoped<WebApplication1.Services.WorkspaceService>();
builder.Services.AddScoped<WebApplication1.Services.DocumentAccessService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Global exception handler middleware — catches unhandled exceptions across all controllers
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.ContentType = "application/json";
    context.Response.StatusCode = 500;
    var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    var message = app.Environment.IsDevelopment()
        ? $"Une erreur interne s'est produite: {exception?.Message}"
        : "Une erreur interne s'est produite";
    await context.Response.WriteAsJsonAsync(new { error = message });
}));

app.UseCors("AllowReactApp");

app.UseStaticFiles();

// Explicit routing so endpoint metadata (incl. [RequirePermission]) is available
// to the authentication & permission middleware that run after this point.
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

// Permission enforcement middleware — validates [RequirePermission] attributes
// read from the matched endpoint metadata (server-side, not client-supplied).
app.UseMiddleware<PermissionValidationMiddleware>();

app.MapControllers();

// ========== SEED RBAC (logic moved to Services/SeederService) ==========
using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<SeederService>();
    await seeder.SeedAsync();
}

app.Run();