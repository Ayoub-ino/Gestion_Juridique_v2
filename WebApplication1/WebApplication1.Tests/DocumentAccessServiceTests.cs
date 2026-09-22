using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    public class DocumentAccessServiceTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        private static CourrierAdministratif CreateDoc(string serviceCode) => new()
        {
            NumeroReference = "REF-1",
            NumeroOrdre = "ORD-1",
            Sujet = "Sujet",
            Objet = "Objet",
            Expediteur = "Exp",
            ServiceActuel = ServiceMapper.MapToServiceEnum(serviceCode),
            ServiceActuelCode = serviceCode,
            StatutActuel = StatutDossier.Nouveau,
            DateCreation = DateTime.Now
        };

        /// <summary>
        /// A pending handover that left the folder at its destination — the state
        /// written by the old "Transaction Unique" creation mode.
        /// </summary>
        private static (AppDbContext Ctx, CourrierAdministratif Doc) CreateStranded(
            StatutTransaction statut = StatutTransaction.EnAttente,
            string? commentaire = null,
            bool deleted = false)
        {
            var ctx = CreateContext();
            var doc = CreateDoc("archive");
            doc.EstSupprime = deleted;
            ctx.Documents.Add(doc);
            ctx.SaveChanges();

            ctx.Transactions.Add(new Transaction
            {
                DocumentId = doc.Id,
                Document = doc,
                ServiceOrigine = ServiceTribunal.BureauOrdre,
                ServiceOrigineCode = "bureauordre",
                ServiceDestination = ServiceTribunal.Archive,
                ServiceDestinationCode = "archive",
                Statut = statut,
                Commentaire = commentaire,
                DateTransaction = DateTime.Now
            });
            ctx.SaveChanges();
            return (ctx, doc);
        }

        [Fact]
        public async Task RepairUnansweredHandovers_MovesStrandedFolderBackToSender()
        {
            var (ctx, doc) = CreateStranded();
            var service = new DocumentAccessService(ctx, new SubstitutionService(ctx));

            var repaired = await service.RepairUnansweredHandoversAsync();

            Assert.Equal(1, repaired);
            Assert.Equal("bureauordre", doc.ServiceActuelCode);
            Assert.Equal(ServiceTribunal.BureauOrdre, doc.ServiceActuel);
            Assert.Equal(StatutDossier.EnInstance, doc.StatutActuel);
        }

        [Fact]
        public async Task RepairUnansweredHandovers_LeavesAnsweredHandoversAlone()
        {
            var (ctx, doc) = CreateStranded(StatutTransaction.Accepte);
            var service = new DocumentAccessService(ctx, new SubstitutionService(ctx));

            var repaired = await service.RepairUnansweredHandoversAsync();

            Assert.Equal(0, repaired);
            Assert.Equal("archive", doc.ServiceActuelCode);
        }

        [Fact]
        public async Task RepairUnansweredHandovers_LeavesRefusalNoticesAlone()
        {
            var (ctx, doc) = CreateStranded(commentaire: "[REFUS]");
            var service = new DocumentAccessService(ctx, new SubstitutionService(ctx));

            var repaired = await service.RepairUnansweredHandoversAsync();

            Assert.Equal(0, repaired);
            Assert.Equal("archive", doc.ServiceActuelCode);
        }

        [Fact]
        public async Task RepairUnansweredHandovers_IgnoresFolderStillWithItsSender()
        {
            // A normal pending transfer: the folder never left the sender, so the
            // handover is legitimate and must not be "repaired".
            var ctx = CreateContext();
            var doc = CreateDoc("bureauordre");
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            ctx.Transactions.Add(new Transaction
            {
                DocumentId = doc.Id,
                Document = doc,
                ServiceOrigine = ServiceTribunal.BureauOrdre,
                ServiceOrigineCode = "bureauordre",
                ServiceDestination = ServiceTribunal.Archive,
                ServiceDestinationCode = "archive",
                Statut = StatutTransaction.EnAttente,
                DateTransaction = DateTime.Now
            });
            await ctx.SaveChangesAsync();

            var service = new DocumentAccessService(ctx, new SubstitutionService(ctx));
            var repaired = await service.RepairUnansweredHandoversAsync();

            Assert.Equal(0, repaired);
            Assert.Equal("bureauordre", doc.ServiceActuelCode);
        }

        [Fact]
        public async Task RepairUnansweredHandovers_IgnoresDeletedFolders()
        {
            var (ctx, _) = CreateStranded(deleted: true);
            var service = new DocumentAccessService(ctx, new SubstitutionService(ctx));

            var repaired = await service.RepairUnansweredHandoversAsync();

            Assert.Equal(0, repaired);
        }

        [Fact]
        public async Task RepairUnansweredHandovers_IsIdempotent()
        {
            var (ctx, doc) = CreateStranded();
            var service = new DocumentAccessService(ctx, new SubstitutionService(ctx));

            Assert.Equal(1, await service.RepairUnansweredHandoversAsync());
            Assert.Equal(0, await service.RepairUnansweredHandoversAsync());
            Assert.Equal("bureauordre", doc.ServiceActuelCode);
        }

        [Fact]
        public async Task RepairUnansweredHandovers_HandlesDynamicServicesWithoutEnumValue()
        {
            // Services created from the admin panel have no enum counterpart; the
            // folder must still go back to the exact code that sent it.
            var ctx = CreateContext();
            var doc = CreateDoc("chk12345");
            doc.ServiceActuel = ServiceTribunal.BureauOrdre;
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            ctx.Transactions.Add(new Transaction
            {
                DocumentId = doc.Id,
                Document = doc,
                ServiceOrigine = ServiceTribunal.BureauOrdre,
                ServiceOrigineCode = "bureauordre",
                ServiceDestination = ServiceTribunal.BureauOrdre,
                ServiceDestinationCode = "chk12345",
                Statut = StatutTransaction.EnAttente,
                DateTransaction = DateTime.Now
            });
            await ctx.SaveChangesAsync();

            var service = new DocumentAccessService(ctx, new SubstitutionService(ctx));
            var repaired = await service.RepairUnansweredHandoversAsync();

            Assert.Equal(1, repaired);
            Assert.Equal("bureauordre", doc.ServiceActuelCode);
        }
    }
}
