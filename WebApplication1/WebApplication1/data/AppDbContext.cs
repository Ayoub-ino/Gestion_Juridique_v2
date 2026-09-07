using Microsoft.EntityFrameworkCore;
using WebApplication1.Models;

namespace WebApplication1.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Document> Documents { get; set; }
        public DbSet<CourrierAdministratif> CourriersAdministratifs { get; set; }
        public DbSet<Transaction> Transactions { get; set; }
        public DbSet<DossierJuridique> DossiersJuridiques { get; set; }
        public DbSet<Utilisateur> Utilisateurs { get; set; }
        public DbSet<ActionJuridique> ActionsJuridiques { get; set; }
        public DbSet<CourrierSortant> CourriersSortants { get; set; }
        public DbSet<ServiceInfo> Services { get; set; }
        public DbSet<Equipment> Equipment { get; set; }
        public DbSet<ListItem> ListItems { get; set; }
        public DbSet<Substitute> Substitutes { get; set; }
        public DbSet<Retrait> Retraits { get; set; }
        public DbSet<DocumentNote> DocumentNotes { get; set; }
        public DbSet<DocumentModification> DocumentModifications { get; set; }

        // RBAC tables
        public DbSet<Service> RbacServices { get; set; }
        public DbSet<Permission> Permissions { get; set; }
        public DbSet<ServicePermission> ServicePermissions { get; set; }
        public DbSet<AdminPermissionOverride> AdminPermissionOverrides { get; set; }
        public DbSet<HistoricalService> HistoricalServices { get; set; }
        public DbSet<PermissionValidationLog> PermissionValidationLogs { get; set; }
        public DbSet<DocumentAccess> DocumentAccesses { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Service unique constraint on Code
            modelBuilder.Entity<Service>()
                .HasIndex(s => s.Code)
                .IsUnique();

            // ServicePermission: one permission key per service
            modelBuilder.Entity<ServicePermission>()
                .HasIndex(sp => new { sp.ServiceId, sp.PermissionKey })
                .IsUnique();

            // Permission: unique key
            modelBuilder.Entity<Permission>()
                .HasIndex(p => p.Key)
                .IsUnique();

            // AdminPermissionOverride: unique PermissionKey
            modelBuilder.Entity<AdminPermissionOverride>()
                .HasIndex(e => e.PermissionKey)
                .IsUnique();

            // HistoricalService: unique Code
            modelBuilder.Entity<HistoricalService>()
                .HasIndex(h => h.Code)
                .IsUnique();

            // Utilisateur -> Service FK
            modelBuilder.Entity<Utilisateur>()
                .HasOne(u => u.ServiceEntity)
                .WithMany()
                .HasForeignKey(u => u.ServiceId)
                .OnDelete(DeleteBehavior.SetNull);

            // Equipment: unique NumeroInventaire
            modelBuilder.Entity<Equipment>()
                .HasIndex(e => e.NumeroInventaire)
                .IsUnique()
                .HasFilter("[NumeroInventaire] IS NOT NULL");

            // Transaction: TargetUserId FK
            modelBuilder.Entity<Transaction>()
                .HasOne(t => t.TargetUser)
                .WithMany()
                .HasForeignKey(t => t.TargetUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // DocumentAccess: one access row per (document, service) pair
            modelBuilder.Entity<DocumentAccess>()
                .HasIndex(da => new { da.DocumentId, da.ServiceCode })
                .IsUnique();

            // DocumentAccess: FK to Document
            modelBuilder.Entity<DocumentAccess>()
                .HasOne(da => da.Document)
                .WithMany()
                .HasForeignKey(da => da.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}