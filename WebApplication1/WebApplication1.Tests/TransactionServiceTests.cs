using Microsoft.EntityFrameworkCore;
using WebApplication1.Core.Enums;
using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    public class TransactionServiceTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        private static Utilisateur CreateUser(string service, string role = "User") => new()
        {
            Login = $"user_{service}",
            PasswordHash = "hash",
            Nom = $"User {service}",
            Role = role,
            Service = service,
            IsActive = true
        };

        private static CourrierAdministratif CreateDoc() => new()
        {
            NumeroReference = "REF-1",
            NumeroOrdre = "ORD-1",
            Sujet = "Sujet",
            Objet = "Objet",
            Expediteur = "Exp",
            ServiceActuel = ServiceTribunal.BureauOrdre,
            StatutActuel = StatutDossier.Nouveau,
            DateCreation = DateTime.Now
        };

        [Fact]
        public async Task GetPendingAsync_NonAdmin_OnlyOwnService()
        {
            var ctx = CreateContext();
            var me = CreateUser("BureauOrdre");
            var other = CreateUser("Archive");
            ctx.Utilisateurs.AddRange(me, other);

            var doc1 = CreateDoc();
            var doc2 = CreateDoc();
            ctx.Documents.AddRange(doc1, doc2);
            await ctx.SaveChangesAsync();

            ctx.Transactions.AddRange(
                new Transaction
                {
                    DocumentId = doc1.Id,
                    Document = doc1,
                    ServiceOrigine = ServiceTribunal.BureauOrdre,
                    ServiceDestination = ServiceTribunal.BureauOrdre,
                    Statut = StatutTransaction.EnAttente
                },
                new Transaction
                {
                    DocumentId = doc2.Id,
                    Document = doc2,
                    ServiceOrigine = ServiceTribunal.BureauOrdre,
                    ServiceDestination = ServiceTribunal.Archive,
                    Statut = StatutTransaction.EnAttente
                }
            );
            await ctx.SaveChangesAsync();

            var service = new TransactionService(ctx);
            var result = await service.GetPendingAsync(me.Id);

            Assert.True(result.Success);
            var items = Assert.IsAssignableFrom<IEnumerable<object>>(result.Data!).Cast<dynamic>().ToList();
            Assert.Single(items);
        }

        [Fact]
        public async Task AccepterAsync_WithDoitRevenir_CreatesReturnTransaction()
        {
            var ctx = CreateContext();
            var me = CreateUser("BureauOrdre");
            ctx.Utilisateurs.Add(me);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var tx = new Transaction
            {
                DocumentId = doc.Id,
                Document = doc,
                ServiceOrigine = ServiceTribunal.Archive,
                ServiceDestination = ServiceTribunal.BureauOrdre,
                Statut = StatutTransaction.EnAttente,
                DoitRevenir = true
            };
            ctx.Transactions.Add(tx);
            await ctx.SaveChangesAsync();

            var service = new TransactionService(ctx);
            var result = await service.AccepterAsync(tx.Id, "ok", me.Id, me.Id.ToString());

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.Accepte, (await ctx.Transactions.FindAsync(tx.Id))!.Statut);
            Assert.Equal(StatutDossier.EnInstance, (await ctx.Documents.FindAsync(doc.Id))!.StatutActuel);
            Assert.Equal(2, await ctx.Transactions.CountAsync()); // original + auto return
        }

        [Fact]
        public async Task RefuserAsync_RejectsWrongService()
        {
            var ctx = CreateContext();
            var me = CreateUser("Archive");
            ctx.Utilisateurs.Add(me);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var tx = new Transaction
            {
                DocumentId = doc.Id,
                Document = doc,
                ServiceOrigine = ServiceTribunal.BureauOrdre,
                ServiceDestination = ServiceTribunal.BureauOrdre, // not "Archive"
                Statut = StatutTransaction.EnAttente
            };
            ctx.Transactions.Add(tx);
            await ctx.SaveChangesAsync();

            var service = new TransactionService(ctx);
            var result = await service.RefuserAsync(tx.Id, "motif", false, me.Id, me.Id.ToString());

            Assert.False(result.Success);
            Assert.Equal(403, result.StatusCode);
            Assert.Equal(StatutTransaction.EnAttente, (await ctx.Transactions.FindAsync(tx.Id))!.Statut);
        }

        [Fact]
        public async Task AnnulerTransitionAsync_RestoresDocumentAndAnnullsChain()
        {
            var ctx = CreateContext();
            var admin = CreateUser("BureauOrdre", "Admin");
            ctx.Utilisateurs.Add(admin);
            await ctx.SaveChangesAsync();

            var doc = CreateDoc();
            doc.ServiceActuel = ServiceTribunal.JalsatWaIjra2at;
            doc.StatutActuel = StatutDossier.EnCours;
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var accepted = new Transaction
            {
                DocumentId = doc.Id,
                Document = doc,
                ServiceOrigine = ServiceTribunal.BureauOrdre,
                ServiceDestination = ServiceTribunal.JalsatWaIjra2at,
                Statut = StatutTransaction.Accepte,
                DateTransaction = DateTime.Now.AddMinutes(-1),
                StatutPrecedent = StatutDossier.Nouveau
            };
            ctx.Transactions.Add(accepted);
            await ctx.SaveChangesAsync();

            var service = new TransactionService(ctx);
            var result = await service.AnnulerTransitionAsync(accepted.Id, admin.Id);

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.Annule, (await ctx.Transactions.FindAsync(accepted.Id))!.Statut);
            Assert.Equal(ServiceTribunal.BureauOrdre, (await ctx.Documents.FindAsync(doc.Id))!.ServiceActuel);
            Assert.Equal(StatutDossier.Nouveau, (await ctx.Documents.FindAsync(doc.Id))!.StatutActuel);
        }

        [Fact]
        public async Task GetStatsAsync_CountsByStatus()
        {
            var ctx = CreateContext();
            // Use a non-admin user so stats are returned (admin gets zeros)
            var user = CreateUser("BureauOrdre", "User");
            ctx.Utilisateurs.Add(user);

            var doc1 = CreateDoc();
            var doc2 = CreateDoc();
            var doc3 = CreateDoc();
            ctx.Documents.AddRange(doc1, doc2, doc3);
            await ctx.SaveChangesAsync();

            ctx.Transactions.AddRange(
                new Transaction { DocumentId = doc1.Id, Document = doc1, ServiceOrigine = ServiceTribunal.BureauOrdre, ServiceDestination = ServiceTribunal.Archive, Statut = StatutTransaction.Accepte },
                new Transaction { DocumentId = doc2.Id, Document = doc2, ServiceOrigine = ServiceTribunal.BureauOrdre, ServiceDestination = ServiceTribunal.Archive, Statut = StatutTransaction.Refuse },
                new Transaction { DocumentId = doc3.Id, Document = doc3, ServiceOrigine = ServiceTribunal.BureauOrdre, ServiceDestination = ServiceTribunal.Archive, Statut = StatutTransaction.EnAttente }
            );
            await ctx.SaveChangesAsync();

            var service = new TransactionService(ctx);
            var result = await service.GetStatsAsync(user.Id);

            Assert.True(result.Success);
            dynamic stats = result.Data!;
            Assert.Equal(3, (int)stats.total);
            Assert.Equal(1, (int)stats.acceptes);
            Assert.Equal(1, (int)stats.refuses);
            Assert.Equal(1, (int)stats.enAttente);
        }

        [Fact]
        public async Task GetStatsAsync_AdminUser_ReturnsZeros()
        {
            var ctx = CreateContext();
            var admin = CreateUser("BureauOrdre", "Admin");
            ctx.Utilisateurs.Add(admin);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            ctx.Transactions.Add(
                new Transaction { DocumentId = doc.Id, Document = doc, ServiceOrigine = ServiceTribunal.BureauOrdre, ServiceDestination = ServiceTribunal.Archive, Statut = StatutTransaction.Accepte }
            );
            await ctx.SaveChangesAsync();

            var service = new TransactionService(ctx);
            var result = await service.GetStatsAsync(admin.Id);

            Assert.True(result.Success);
            dynamic stats = result.Data!;
            Assert.Equal(0, (int)stats.total);
            Assert.Equal(0, (int)stats.acceptes);
            Assert.Equal(0, (int)stats.refuses);
            Assert.Equal(0, (int)stats.enAttente);
        }
    }
}
