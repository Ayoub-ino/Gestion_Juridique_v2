using Microsoft.EntityFrameworkCore;
using WebApplication1.Core.Enums;
using WebApplication1.Data;
using WebApplication1.DTO;
using WebApplication1.Models;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    public class WorkspaceServiceTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task GetDocumentAsync_ReturnsAdminDetails()
        {
            var ctx = CreateContext();
            var doc = new CourrierAdministratif
            {
                NumeroReference = "REF-1",
                NumeroOrdre = "ORD-1",
                Sujet = "Sujet",
                Objet = "Objet",
                Expediteur = "Exp",
                ServiceActuel = ServiceTribunal.BureauOrdre,
                StatutActuel = StatutDossier.Nouveau
            };
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var service = new WorkspaceService(ctx);
            var result = await service.GetDocumentAsync(doc.Id);

            Assert.True(result.Success);
            dynamic details = result.Data!;
            Assert.Equal("entrant-admin", (string)details.type);
            Assert.Equal("ORD-1", (string)details.NumeroOrdre);
        }

        [Fact]
        public async Task GetDocumentAsync_MissingDoc_ReturnsNotFound()
        {
            var ctx = CreateContext();
            var service = new WorkspaceService(ctx);
            var result = await service.GetDocumentAsync(999);

            Assert.False(result.Success);
            Assert.Equal(404, result.StatusCode);
        }

        [Fact]
        public async Task UpdateDocumentAsync_TracksModificationAudit()
        {
            var ctx = CreateContext();
            var doc = new CourrierAdministratif
            {
                NumeroReference = "REF-1",
                NumeroOrdre = "OLD",
                Sujet = "Sujet",
                Objet = "Objet",
                Expediteur = "Exp",
                ServiceActuel = ServiceTribunal.BureauOrdre,
                StatutActuel = StatutDossier.Nouveau
            };
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var service = new WorkspaceService(ctx);
            var result = await service.UpdateDocumentAsync(
                doc.Id,
                new UpdateDocumentDto { NumeroOrdre = "NEW", Expediteur = "Exp" }, // Expediteur unchanged
                "Agent 1",
                "BureauOrdre"
            );

            Assert.True(result.Success);
            dynamic data = result.Data!;
            Assert.Equal(1, (int)data.modifications); // only NumeroOrdre tracked

            var docAfter = (CourrierAdministratif)(await ctx.Documents.FindAsync(doc.Id))!;
            Assert.Equal("NEW", docAfter!.NumeroOrdre);

            var mod = await ctx.DocumentModifications.SingleAsync();
            Assert.Equal("NumeroOrdre", mod.Champ);
            Assert.Equal("OLD", mod.AncienneValeur);
            Assert.Equal("NEW", mod.NouvelleValeur);
            Assert.Equal("Agent 1", mod.Utilisateur);
        }

        [Fact]
        public async Task AddAndDeleteNote_Works()
        {
            var ctx = CreateContext();
            var doc = new CourrierAdministratif
            {
                NumeroReference = "REF-1",
                NumeroOrdre = "ORD-1",
                Sujet = "Sujet",
                Objet = "Objet",
                Expediteur = "Exp",
                ServiceActuel = ServiceTribunal.BureauOrdre,
                StatutActuel = StatutDossier.Nouveau
            };
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var service = new WorkspaceService(ctx);
            var addResult = await service.AddNoteAsync(doc.Id, new AddNoteDto { Contenu = "Ma note" }, "Agent 1", "BureauOrdre");

            Assert.True(addResult.Success);
            var note = await ctx.DocumentNotes.SingleAsync();
            Assert.Equal("Ma note", note.Contenu);
            Assert.Equal("Agent 1", note.Auteur);

            var delResult = await service.DeleteNoteAsync(note.Id);
            Assert.True(delResult.Success);
            Assert.Equal(0, await ctx.DocumentNotes.CountAsync());
        }

        [Fact]
        public async Task GetModificationsAsync_ReturnsHistory()
        {
            var ctx = CreateContext();
            var doc = new CourrierAdministratif
            {
                NumeroReference = "REF-1",
                NumeroOrdre = "ORD-1",
                Sujet = "Sujet",
                Objet = "Objet",
                Expediteur = "Exp",
                ServiceActuel = ServiceTribunal.BureauOrdre,
                StatutActuel = StatutDossier.Nouveau
            };
            ctx.Documents.Add(doc);
            ctx.DocumentModifications.Add(new DocumentModification
            {
                DocumentId = doc.Id,
                Champ = "Objet",
                AncienneValeur = "a",
                NouvelleValeur = "b",
                Utilisateur = "Agent 1",
                Service = "BureauOrdre",
                DateModification = DateTime.Now
            });
            await ctx.SaveChangesAsync();

            var service = new WorkspaceService(ctx);
            var result = await service.GetModificationsAsync(doc.Id);

            Assert.True(result.Success);
            var mods = Assert.IsAssignableFrom<IEnumerable<object>>(result.Data!).Cast<dynamic>().ToList();
            Assert.Single(mods);
        }
    }
}
