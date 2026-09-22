using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Helpers;
using WebApplication1.Models;
using WebApplication1.Services;
using Xunit;

namespace WebApplication1.Tests
{
    /// <summary>
    /// Absence delegations. The scope is deliberately narrow: a substitute reaches
    /// only the folders entrusted to the agent they replace
    /// (<see cref="Document.GestionnaireUserId"/>), never that agent's whole service.
    /// </summary>
    public class SubstitutionServiceTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        private static Utilisateur AddUser(AppDbContext ctx, string nom, string service, string role = "User")
        {
            var user = new Utilisateur
            {
                Login = nom.ToLowerInvariant(),
                Nom = nom,
                PasswordHash = "x",
                Role = role,
                Service = service,
                IsActive = true
            };
            ctx.Utilisateurs.Add(user);
            ctx.SaveChanges();
            return user;
        }

        /// <summary>
        /// A folder held by <paramref name="serviceCode"/> and entrusted to
        /// <paramref name="entrustedToUserId"/> (null = nobody, i.e. a legacy row
        /// that the backfill has not attributed yet).
        /// </summary>
        private static CourrierAdministratif AddDoc(
            AppDbContext ctx, string serviceCode, int? entrustedToUserId = null, string reference = "REF-9")
        {
            var doc = new CourrierAdministratif
            {
                NumeroReference = reference,
                NumeroOrdre = "ORD-9",
                Sujet = "Sujet",
                Objet = "Objet",
                Expediteur = "Exp",
                ServiceActuel = ServiceMapper.MapToServiceEnum(serviceCode),
                ServiceActuelCode = serviceCode,
                StatutActuel = StatutDossier.Nouveau,
                DateCreation = DateTime.Now,
                GestionnaireUserId = entrustedToUserId
            };
            ctx.Documents.Add(doc);
            ctx.SaveChanges();
            return doc;
        }

        private static Substitute Delegate(AppDbContext ctx, Utilisateur absent, Utilisateur substitute, bool active = true)
        {
            var sub = new Substitute
            {
                UserId = absent.Id,
                SubstituteUserId = substitute.Id,
                DateAssignation = DateTime.Now,
                IsActive = active,
                DateRevocation = active ? null : DateTime.Now
            };
            ctx.Substitutes.Add(sub);
            ctx.SaveChanges();
            return sub;
        }

        // ── Own scope is never widened by a delegation ──

        [Fact]
        public void OwnServiceCode_IsTheUsersOwnServiceOnly()
        {
            using var ctx = CreateContext();
            var absent = AddUser(ctx, "Absent", "secretarait");
            var substitute = AddUser(ctx, "Remplacant", "bureauordre");
            Delegate(ctx, absent, substitute);

            var service = new SubstitutionService(ctx);

            Assert.Equal("bureauordre", service.GetOwnServiceCode(substitute.Id));
        }

        [Fact]
        public void OwnServiceEnum_IsNullForAServiceCreatedFromTheAdminPanel()
        {
            using var ctx = CreateContext();
            var user = AddUser(ctx, "Custom", "servicepersonnalise");

            var service = new SubstitutionService(ctx);

            Assert.Null(service.GetOwnServiceEnum(user.Id));
        }

        [Fact]
        public void OwnServiceEnum_MapsAKnownService()
        {
            using var ctx = CreateContext();
            var user = AddUser(ctx, "Seances", "seances&procedures");

            var service = new SubstitutionService(ctx);

            Assert.Equal(ServiceTribunal.JalsatWaIjra2at, service.GetOwnServiceEnum(user.Id));
        }

        // ── Narrow custody ──

        [Fact]
        public void SubstituteHasCustodyOfAnEntrustedFolder_AndLosesItOnRevocation()
        {
            using var ctx = CreateContext();
            var absent = AddUser(ctx, "Absent", "secretarait");
            var substitute = AddUser(ctx, "Remplacant", "bureauordre");
            var doc = AddDoc(ctx, "secretarait", absent.Id);

            var access = new DocumentAccessService(ctx, new SubstitutionService(ctx));
            Assert.False(access.IsUserCustodian(doc, substitute.Id));

            var sub = Delegate(ctx, absent, substitute);
            Assert.True(access.IsUserCustodian(doc, substitute.Id));

            sub.IsActive = false;
            sub.DateRevocation = DateTime.Now;
            ctx.SaveChanges();

            Assert.False(access.IsUserCustodian(doc, substitute.Id));
        }

        [Fact]
        public void SubstituteDoesNotReachAColleaguesFolderInTheSameService()
        {
            using var ctx = CreateContext();
            var absent = AddUser(ctx, "Absent", "secretarait");
            var colleague = AddUser(ctx, "Collegue", "secretarait");
            var substitute = AddUser(ctx, "Remplacant", "bureauordre");
            // Held by the absent agent's service, but entrusted to the colleague.
            var doc = AddDoc(ctx, "secretarait", colleague.Id);

            Delegate(ctx, absent, substitute);
            var access = new DocumentAccessService(ctx, new SubstitutionService(ctx));

            Assert.False(access.IsUserCustodian(doc, substitute.Id));
        }

        [Fact]
        public void SubstituteDoesNotReachAFolderThatLeftTheAgentsService()
        {
            using var ctx = CreateContext();
            var absent = AddUser(ctx, "Absent", "secretarait");
            var substitute = AddUser(ctx, "Remplacant", "bureauordre");
            // Still entrusted to the absent agent, but the folder has moved on.
            var doc = AddDoc(ctx, "khibra", absent.Id);

            Delegate(ctx, absent, substitute);
            var access = new DocumentAccessService(ctx, new SubstitutionService(ctx));

            Assert.False(access.IsUserCustodian(doc, substitute.Id));
        }

        [Fact]
        public void SubstituteHasNoCustodyOfAFolderWithNoEntrustedAgent()
        {
            using var ctx = CreateContext();
            var absent = AddUser(ctx, "Absent", "secretarait");
            var substitute = AddUser(ctx, "Remplacant", "bureauordre");
            var doc = AddDoc(ctx, "secretarait", entrustedToUserId: null);

            Delegate(ctx, absent, substitute);
            var access = new DocumentAccessService(ctx, new SubstitutionService(ctx));

            Assert.False(access.IsUserCustodian(doc, substitute.Id));
        }

        // ── ACL ──

        [Fact]
        public async Task SubstituteHasEditorAccessOnlyToEntrustedFolders()
        {
            using var ctx = CreateContext();
            var absent = AddUser(ctx, "Absent", "secretarait");
            var colleague = AddUser(ctx, "Collegue", "secretarait");
            var substitute = AddUser(ctx, "Remplacant", "bureauordre");

            var entrusted = AddDoc(ctx, "secretarait", absent.Id, "REF-ENTRUSTED");
            var other = AddDoc(ctx, "secretarait", colleague.Id, "REF-COLLEAGUE");

            var access = new DocumentAccessService(ctx, new SubstitutionService(ctx));
            await access.GrantOwnerAsync(entrusted.Id, "secretarait");
            await access.GrantOwnerAsync(other.Id, "secretarait");

            Assert.False(await access.UserHasAccessAsync(entrusted.Id, substitute.Id, DocumentAccessLevel.Viewer));

            Delegate(ctx, absent, substitute);

            Assert.True(await access.UserHasAccessAsync(entrusted.Id, substitute.Id, DocumentAccessLevel.Editor));
            Assert.False(await access.UserHasAccessAsync(other.Id, substitute.Id, DocumentAccessLevel.Viewer));
        }

        // ── Listing scope ──

        [Fact]
        public void ScopePredicate_MatchesOwnServiceAndEntrustedFoldersOnly()
        {
            using var ctx = CreateContext();
            var absent = AddUser(ctx, "Absent", "secretarait");
            var colleague = AddUser(ctx, "Collegue", "secretarait");
            var substitute = AddUser(ctx, "Remplacant", "bureauordre");

            var ownService = AddDoc(ctx, "bureauordre", colleague.Id, "REF-OWN");
            var entrusted = AddDoc(ctx, "secretarait", absent.Id, "REF-ENTRUSTED");
            var colleagues = AddDoc(ctx, "secretarait", colleague.Id, "REF-COLLEAGUE");
            var elsewhere = AddDoc(ctx, "khibra", null, "REF-ELSEWHERE");

            Delegate(ctx, absent, substitute);
            var service = new SubstitutionService(ctx);

            var matches = SubstitutionService
                .BuildScopePredicate<Document>(
                    service.GetOwnServiceCode(substitute.Id),
                    service.GetOwnServiceEnum(substitute.Id),
                    service.GetCoveredUserIds(substitute.Id))
                .Compile();

            Assert.True(matches(ownService));
            Assert.True(matches(entrusted));
            Assert.False(matches(colleagues), "a colleague's folder must stay out of reach");
            Assert.False(matches(elsewhere));
        }

        [Fact]
        public void ScopePredicate_WithNoDelegation_IsTheOwnServiceOnly()
        {
            using var ctx = CreateContext();
            var colleague = AddUser(ctx, "Collegue", "secretarait");
            var user = AddUser(ctx, "Solo", "bureauordre");

            var ownService = AddDoc(ctx, "bureauordre", colleague.Id, "REF-OWN");
            var elsewhere = AddDoc(ctx, "secretarait", colleague.Id, "REF-ELSEWHERE");

            var service = new SubstitutionService(ctx);
            var matches = SubstitutionService
                .BuildScopePredicate<Document>(
                    service.GetOwnServiceCode(user.Id),
                    service.GetOwnServiceEnum(user.Id),
                    service.GetCoveredUserIds(user.Id))
                .Compile();

            Assert.True(matches(ownService));
            Assert.False(matches(elsewhere));
        }

        // ── Trace ──

        [Fact]
        public async Task DelegatedActionIsRecordedForEveryCoveredAgent()
        {
            using var ctx = CreateContext();
            var absentA = AddUser(ctx, "AbsentA", "secretarait");
            var absentB = AddUser(ctx, "AbsentB", "khibra");
            var substitute = AddUser(ctx, "Remplacant", "bureauordre");
            Delegate(ctx, absentA, substitute);
            Delegate(ctx, absentB, substitute);

            var doc = AddDoc(ctx, "secretarait", absentA.Id);
            var service = new SubstitutionService(ctx);
            await service.LogDelegatedActionAsync(substitute.Id, "Modification", doc.Id);

            var rows = ctx.SubstitutionActions.ToList();
            Assert.Equal(2, rows.Count);
            Assert.Contains(rows, r => r.PourUserId == absentA.Id && r.EffectueParUserId == substitute.Id);
            Assert.Contains(rows, r => r.PourUserId == absentB.Id);
            // The reference is resolved from the folder so the trace is readable.
            Assert.All(rows, r => Assert.Equal("REF-9", r.Reference));
        }

        [Fact]
        public async Task DelegatedActionWritesNothingWhenTheUserIsNotSubstituting()
        {
            using var ctx = CreateContext();
            var user = AddUser(ctx, "Solo", "bureauordre");
            var doc = AddDoc(ctx, "bureauordre", user.Id);

            await new SubstitutionService(ctx).LogDelegatedActionAsync(user.Id, "Modification", doc.Id);

            Assert.Empty(ctx.SubstitutionActions);
        }

        // ── Legacy attribution ──

        [Fact]
        public async Task Backfill_AttributesLegacyFoldersToTheAgentTheirBureauNumberNames()
        {
            using var ctx = CreateContext();
            var creator = AddUser(ctx, "Createur", "secretarait");
            var doc = AddDoc(ctx, "secretarait", entrustedToUserId: null);
            doc.NumeroBureauOrdre = $"{creator.Id}/2026";
            ctx.SaveChanges();

            var updated = await new SubstitutionService(ctx).BackfillDocumentCustodiansAsync();

            Assert.Equal(1, updated);
            Assert.Equal(creator.Id, doc.GestionnaireUserId);
        }

        [Fact]
        public async Task Backfill_LeavesUnresolvableRowsAloneAndIsIdempotent()
        {
            using var ctx = CreateContext();
            var unattributable = AddDoc(ctx, "secretarait", entrustedToUserId: null, reference: "REF-A");
            unattributable.NumeroBureauOrdre = "999999/2026";
            var alreadySet = AddDoc(ctx, "secretarait", entrustedToUserId: 1, reference: "REF-B");
            alreadySet.NumeroBureauOrdre = "77/2026";
            ctx.SaveChanges();

            var service = new SubstitutionService(ctx);

            Assert.Equal(0, await service.BackfillDocumentCustodiansAsync());
            Assert.Null(unattributable.GestionnaireUserId);
            Assert.Equal(1, alreadySet.GestionnaireUserId);

            // A second pass changes nothing.
            Assert.Equal(0, await service.BackfillDocumentCustodiansAsync());
        }

        // ── Withdrawal authorities ──

        [Theory]
        [InlineData(RetraitAuthorities.ChefGreffe)]
        [InlineData(RetraitAuthorities.ConseillerRapporteur)]
        [InlineData(RetraitAuthorities.PremierPresident)]
        public void WithdrawalAuthorities_AcceptsTheThreeEntitledFunctions(string code) =>
            Assert.True(RetraitAuthorities.IsValid(code));

        [Theory]
        [InlineData("")]
        [InlineData("inconnu")]
        [InlineData(null)]
        public void WithdrawalAuthorities_RejectsAnythingElse(string? code) =>
            Assert.False(RetraitAuthorities.IsValid(code));
    }
}
