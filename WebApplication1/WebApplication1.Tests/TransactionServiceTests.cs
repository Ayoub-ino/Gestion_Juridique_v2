using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
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

        /// <summary>
        /// Wires the transaction service with a clone service. The clone service
        /// only touches the file system when a folder carries an attachment, which
        /// these tests never do, so a stub web root is enough.
        /// </summary>
        private static TransactionService CreateService(AppDbContext ctx) =>
            new(ctx, new DocumentAccessService(ctx, new SubstitutionService(ctx)), new DocumentCloneService(ctx, new TestEnv()));

        private sealed class TestEnv : IWebHostEnvironment
        {
            public string ApplicationName { get; set; } = "Tests";
            public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
            public string WebRootPath { get; set; } = Path.Combine(Path.GetTempPath(), "gj-tests-wwwroot");
            public string EnvironmentName { get; set; } = "Test";
            public string ContentRootPath { get; set; } = Path.GetTempPath();
            public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        }

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

            var service = CreateService(ctx);
            var result = await service.GetPendingAsync(me.Id);

            Assert.True(result.Success);
            var items = Assert.IsAssignableFrom<IEnumerable<object>>(result.Data!).Cast<dynamic>().ToList();
            Assert.Single(items);
        }

        [Fact]
        public async Task AccepterAsync_WithDoitRevenir_KeepsFolderWithSender()
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

            var service = CreateService(ctx);
            var result = await service.AccepterAsync(tx.Id, "ok", me.Id, me.Id.ToString());

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.Accepte, (await ctx.Transactions.FindAsync(tx.Id))!.Statut);
            // Folder stays with sender — no return transaction created
            Assert.Equal(ServiceTribunal.BureauOrdre, (await ctx.Documents.FindAsync(doc.Id))!.ServiceActuel);
            Assert.Equal(StatutDossier.EnInstance, (await ctx.Documents.FindAsync(doc.Id))!.StatutActuel);
            Assert.Equal(1, await ctx.Transactions.CountAsync()); // only the original transaction
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

            var service = CreateService(ctx);
            var result = await service.RefuserAsync(tx.Id, "motif", false, me.Id, me.Id.ToString());

            Assert.False(result.Success);
            Assert.Equal(403, result.StatusCode);
            Assert.Equal(StatutTransaction.EnAttente, (await ctx.Transactions.FindAsync(tx.Id))!.Statut);
        }

        [Fact]
        public async Task AnnulerTransitionAsync_FolderStaysWithSender()
        {
            var ctx = CreateContext();
            var admin = CreateUser("BureauOrdre", "Admin");
            ctx.Utilisateurs.Add(admin);
            await ctx.SaveChangesAsync();

            var doc = CreateDoc();
            // Folder stays with sender (BureauOrdre) during pending transfer
            doc.ServiceActuel = ServiceTribunal.BureauOrdre;
            doc.StatutActuel = StatutDossier.EnCours;
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var pending = new Transaction
            {
                DocumentId = doc.Id,
                Document = doc,
                ServiceOrigine = ServiceTribunal.BureauOrdre,
                ServiceDestination = ServiceTribunal.JalsatWaIjra2at,
                Statut = StatutTransaction.EnAttente,
                DateTransaction = DateTime.Now.AddMinutes(-1),
                StatutPrecedent = StatutDossier.Nouveau
            };
            ctx.Transactions.Add(pending);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            var result = await service.AnnulerTransitionAsync(pending.Id, admin.Id);

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.Annule, (await ctx.Transactions.FindAsync(pending.Id))!.Statut);
            // Folder never moved — stays with sender
            Assert.Equal(ServiceTribunal.BureauOrdre, (await ctx.Documents.FindAsync(doc.Id))!.ServiceActuel);
        }

        [Fact]
        public async Task AnnulerTransitionAsync_RejectsAlreadyAcceptedTransactions()
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

            // Already accepted — cannot be cancelled by anyone (admin or not)
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

            var service = CreateService(ctx);
            var result = await service.AnnulerTransitionAsync(accepted.Id, admin.Id);

            Assert.False(result.Success);
            // Document should remain unchanged
            Assert.Equal(ServiceTribunal.JalsatWaIjra2at, (await ctx.Documents.FindAsync(doc.Id))!.ServiceActuel);
            Assert.Equal(StatutTransaction.Accepte, (await ctx.Transactions.FindAsync(accepted.Id))!.Statut);
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

            var service = CreateService(ctx);
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

            var service = CreateService(ctx);
            var result = await service.GetStatsAsync(admin.Id);

            Assert.True(result.Success);
            dynamic stats = result.Data!;
            Assert.Equal(0, (int)stats.total);
            Assert.Equal(0, (int)stats.acceptes);
            Assert.Equal(0, (int)stats.refuses);
            Assert.Equal(0, (int)stats.enAttente);
        }

        // ── Folder history ────────────────────────────────────────────────────
        // A folder's history must describe what ACTUALLY happened to it. A
        // transfer only counts once it has moved the folder.

        private static Transaction CreateTx(
            Document doc, StatutTransaction statut, string? commentaire = null) => new()
        {
            DocumentId = doc.Id,
            Document = doc,
            ServiceOrigine = ServiceTribunal.BureauOrdre,
            ServiceDestination = ServiceTribunal.Archive,
            Statut = statut,
            Commentaire = commentaire,
            DateTransaction = DateTime.Now
        };

        private static async Task<int> HistoryCountAsync(AppDbContext ctx, int documentId)
        {
            var service = CreateService(ctx);
            var result = await service.GetHistoryAsync(documentId);
            Assert.True(result.Success);
            var items = Assert.IsAssignableFrom<IEnumerable<object>>(result.Data!).ToList();
            return items.Count;
        }

        [Fact]
        public async Task GetHistoryAsync_ExcludesPendingAndCancelledTransfers()
        {
            // The folder is still with the sender while a transfer is pending, and
            // a cancelled transfer never happened — neither belongs to the history.
            var ctx = CreateContext();
            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            ctx.Transactions.AddRange(
                CreateTx(doc, StatutTransaction.EnAttente),
                CreateTx(doc, StatutTransaction.Annule));
            await ctx.SaveChangesAsync();

            Assert.Equal(0, await HistoryCountAsync(ctx, doc.Id));
        }

        [Fact]
        public async Task GetHistoryAsync_RecordsAnAcceptedTransfer()
        {
            // Historique (record-only) services are auto-accepted, so their hop is
            // recorded immediately — this is the same state.
            var ctx = CreateContext();
            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            ctx.Transactions.Add(CreateTx(doc, StatutTransaction.Accepte));
            await ctx.SaveChangesAsync();

            Assert.Equal(1, await HistoryCountAsync(ctx, doc.Id));
        }

        [Fact]
        public async Task GetHistoryAsync_KeepsARefusedAttemptSoTheUiCanMarkIt()
        {
            // The folder did not move, but the denied attempt is kept so the journey
            // can render that hop with ❌.
            var ctx = CreateContext();
            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            ctx.Transactions.Add(CreateTx(doc, StatutTransaction.Refuse));
            await ctx.SaveChangesAsync();

            Assert.Equal(1, await HistoryCountAsync(ctx, doc.Id));
        }

        [Fact]
        public async Task GetHistoryAsync_ExcludesRefusalNotices()
        {
            // A "[REFUS]" transaction is a message addressed to the sender, not a
            // movement of the folder — it must never appear as a hop.
            var ctx = CreateContext();
            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            ctx.Transactions.AddRange(
                CreateTx(doc, StatutTransaction.EnAttente, "[REFUS]"),
                CreateTx(doc, StatutTransaction.Accepte, "[REFUS]"));
            await ctx.SaveChangesAsync();

            Assert.Equal(0, await HistoryCountAsync(ctx, doc.Id));
        }

        [Fact]
        public async Task GetHistoryAsync_KeepsOnlyCommittedMovementsAndRefusals()
        {
            var ctx = CreateContext();
            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            ctx.Transactions.AddRange(
                CreateTx(doc, StatutTransaction.EnAttente),
                CreateTx(doc, StatutTransaction.Annule),
                CreateTx(doc, StatutTransaction.EnAttente, "[REFUS]"),
                CreateTx(doc, StatutTransaction.Accepte),
                CreateTx(doc, StatutTransaction.Refuse),
                CreateTx(doc, StatutTransaction.Accepte, "[REFUS]"));
            await ctx.SaveChangesAsync();

            Assert.Equal(2, await HistoryCountAsync(ctx, doc.Id));
        }

        // ── Competing requests ────────────────────────────────────────────────
        // One send can target several users of the destination service, so the
        // same document may sit in more than one inbox at once.

        private static Transaction PendingTo(
            Document doc, ServiceTribunal origin, ServiceTribunal dest, int? targetUser = null) => new()
        {
            DocumentId = doc.Id,
            Document = doc,
            ServiceOrigine = origin,
            ServiceDestination = dest,
            Statut = StatutTransaction.EnAttente,
            TargetUserId = targetUser,
            DateTransaction = DateTime.Now
        };

        [Fact]
        public async Task AccepterAsync_ServiceWideRequest_TakesTheFolderItself()
        {
            // Nobody was named, so the folder simply moves to the service. That makes
            // any other open request for it stale, and those get closed.
            var ctx = CreateContext();
            var receiver = CreateUser("Archive");
            ctx.Utilisateurs.Add(receiver);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var first = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive);
            var second = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive);
            ctx.Transactions.AddRange(first, second);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            var result = await service.AccepterAsync(first.Id, "ok", receiver.Id, receiver.Id.ToString());

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.Accepte, (await ctx.Transactions.FindAsync(first.Id))!.Statut);
            Assert.Equal(StatutTransaction.Annule, (await ctx.Transactions.FindAsync(second.Id))!.Statut);
            // No copy was needed — the folder itself moved.
            Assert.Equal(1, await ctx.Documents.CountAsync());
            Assert.Equal(ServiceTribunal.Archive, (await ctx.Documents.FindAsync(doc.Id))!.ServiceActuel);
        }

        // ── One folder per named recipient ────────────────────────────────────
        // A send may name several users. They cannot share one row, or the first to
        // answer would move the folder out from under the others — so each named
        // recipient receives their own copy.

        [Fact]
        public async Task AccepterAsync_NamedRecipientReceivesTheirOwnCopy()
        {
            var ctx = CreateContext();
            var first = CreateUser("Archive");
            var second = CreateUser("Archive");
            second.Login = "second";
            ctx.Utilisateurs.AddRange(first, second);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var requestForFirst = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, first.Id);
            var requestForSecond = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, second.Id);
            ctx.Transactions.AddRange(requestForFirst, requestForSecond);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            var result = await service.AccepterAsync(requestForFirst.Id, "ok", first.Id, first.Id.ToString());

            Assert.True(result.Success);

            // A copy exists and went to the receiving service, carrying the SAME
            // identification number as the folder it came from.
            var copy = await ctx.Documents.SingleOrDefaultAsync(d => d.CopieDeDocumentId == doc.Id);
            Assert.NotNull(copy);
            Assert.Equal(ServiceTribunal.Archive, copy!.ServiceActuel);
            Assert.Equal(doc.NumeroReference, copy.NumeroReference);

            // The folder itself never left the sender.
            Assert.Equal(ServiceTribunal.BureauOrdre, (await ctx.Documents.FindAsync(doc.Id))!.ServiceActuel);

            // The other recipient's request stays open so they still get theirs.
            Assert.Equal(StatutTransaction.EnAttente, (await ctx.Transactions.FindAsync(requestForSecond.Id))!.Statut);

            // The acceptance is recorded against the COPY, not the original.
            var accepted = await ctx.Transactions.FindAsync(requestForFirst.Id);
            Assert.Equal(StatutTransaction.Accepte, accepted!.Statut);
            Assert.Equal(copy.Id, accepted.DocumentId);
        }

        [Fact]
        public async Task AccepterAsync_LastRecipientTakesTheFolderItself()
        {
            // N recipients end up with N folders and the sender is left with nothing
            // extra: the last acceptance moves the folder instead of copying it.
            var ctx = CreateContext();
            var first = CreateUser("Archive");
            var second = CreateUser("Archive");
            second.Login = "second";
            ctx.Utilisateurs.AddRange(first, second);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var requestForFirst = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, first.Id);
            var requestForSecond = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, second.Id);
            ctx.Transactions.AddRange(requestForFirst, requestForSecond);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            await service.AccepterAsync(requestForFirst.Id, "ok", first.Id, first.Id.ToString());
            var result = await service.AccepterAsync(requestForSecond.Id, "ok", second.Id, second.Id.ToString());

            Assert.True(result.Success);
            // Exactly two folders: the original plus the one copy — no third one.
            Assert.Equal(2, await ctx.Documents.CountAsync());
            Assert.Equal(ServiceTribunal.Archive, (await ctx.Documents.FindAsync(doc.Id))!.ServiceActuel);
            Assert.Equal(2, await ctx.Documents.CountAsync(d => d.ServiceActuel == ServiceTribunal.Archive));
        }

        [Fact]
        public async Task AccepterAsync_CopyInheritsTheCommittedHistory()
        {
            // The copy must show the same journey as the folder it came from, plus its
            // own acceptance — and the acceptance must not be counted twice.
            var ctx = CreateContext();
            var first = CreateUser("Archive");
            var second = CreateUser("Archive");
            second.Login = "second";
            ctx.Utilisateurs.AddRange(first, second);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var earlierHop = CreateTx(doc, StatutTransaction.Accepte);
            var requestForFirst = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, first.Id);
            var requestForSecond = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, second.Id);
            ctx.Transactions.AddRange(earlierHop, requestForFirst, requestForSecond);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            await service.AccepterAsync(requestForFirst.Id, "ok", first.Id, first.Id.ToString());

            var copy = await ctx.Documents.SingleAsync(d => d.CopieDeDocumentId == doc.Id);
            // One inherited hop + the acceptance of the copy itself.
            Assert.Equal(2, await HistoryCountAsync(ctx, copy.Id));
        }

        [Fact]
        public async Task AccepterAsync_LeavesRefusalNoticesAlone()
        {
            // A "[REFUS]" notice is a message to the sender, not a handoff of the
            // folder, so accepting a real transfer must not dismiss it.
            var ctx = CreateContext();
            var receiver = CreateUser("Archive");
            ctx.Utilisateurs.Add(receiver);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var real = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, receiver.Id);
            var notice = PendingTo(doc, ServiceTribunal.Archive, ServiceTribunal.BureauOrdre);
            notice.Commentaire = "[REFUS]";
            ctx.Transactions.AddRange(real, notice);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            var result = await service.AccepterAsync(real.Id, "ok", receiver.Id, receiver.Id.ToString());

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.EnAttente, (await ctx.Transactions.FindAsync(notice.Id))!.Statut);
        }

        [Fact]
        public async Task RefuserAsync_ClosesTheSiblingRequestsForTheSameRecipient()
        {
            // Service-wide duplicates of the same handoff are alternatives: once one
            // is refused they no longer represent anything.
            var ctx = CreateContext();
            var receiver = CreateUser("Archive");
            ctx.Utilisateurs.Add(receiver);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var first = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive);
            var sibling = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive);
            ctx.Transactions.AddRange(first, sibling);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            var result = await service.RefuserAsync(first.Id, "motif", true, receiver.Id, receiver.Id.ToString());

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.Refuse, (await ctx.Transactions.FindAsync(first.Id))!.Statut);
            Assert.Equal(StatutTransaction.Annule, (await ctx.Transactions.FindAsync(sibling.Id))!.Statut);
        }

        [Fact]
        public async Task RefuserAsync_LeavesOtherNamedRecipientsActionable()
        {
            // Each named recipient owns a separate copy, so one of them refusing says
            // nothing about the others' requests.
            var ctx = CreateContext();
            var first = CreateUser("Archive");
            var second = CreateUser("Archive");
            second.Login = "second";
            ctx.Utilisateurs.AddRange(first, second);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var refused = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, first.Id);
            var otherRecipient = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, second.Id);
            ctx.Transactions.AddRange(refused, otherRecipient);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            var result = await service.RefuserAsync(refused.Id, "motif", true, first.Id, first.Id.ToString());

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.EnAttente, (await ctx.Transactions.FindAsync(otherRecipient.Id))!.Statut);
        }

        [Fact]
        public async Task RefuserAsync_KeepsHandoffsToOtherServicesActionable()
        {
            // The folder did not move, so a handoff to a different service is
            // still valid and must stay pending.
            var ctx = CreateContext();
            var receiver = CreateUser("Archive");
            ctx.Utilisateurs.Add(receiver);

            var doc = CreateDoc();
            ctx.Documents.Add(doc);
            await ctx.SaveChangesAsync();

            var refused = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Archive, receiver.Id);
            var elsewhere = PendingTo(doc, ServiceTribunal.BureauOrdre, ServiceTribunal.Khibra);
            ctx.Transactions.AddRange(refused, elsewhere);
            await ctx.SaveChangesAsync();

            var service = CreateService(ctx);
            var result = await service.RefuserAsync(refused.Id, "motif", true, receiver.Id, receiver.Id.ToString());

            Assert.True(result.Success);
            Assert.Equal(StatutTransaction.EnAttente, (await ctx.Transactions.FindAsync(elsewhere.Id))!.Statut);
        }
    }
}
