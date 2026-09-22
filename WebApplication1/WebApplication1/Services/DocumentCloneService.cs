using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Duplicates a folder so a send that names several recipients can hand each of
    /// them their own independent working copy: same information, separate folder.
    ///
    /// Why a copy at all: one folder cannot sit in two places at once. Handing the
    /// same row to two users makes them compete over it — whoever acts first moves
    /// it out from under the other. A copy per recipient keeps each of them working
    /// on their own dossier without touching anyone else's.
    /// </summary>
    public class DocumentCloneService
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        /// <summary>Marker written by <c>TransactionService</c> for refusal notices.</summary>
        private const string RefusalNotice = "[REFUS]";

        public DocumentCloneService(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        /// <summary>
        /// Builds an unsaved copy of <paramref name="source"/>. The caller is
        /// responsible for adding it to the context and for re-routing it.
        /// The copy starts at the source's position, so a caller that fails before
        /// moving it never leaves a mis-routed row behind.
        /// </summary>
        public Document BuildCopy(Document source)
        {
            var copy = Duplicate(source);

            // A copy carries the SAME identification number as the folder it came
            // from (as a "document lié" does) and records the root it descends from.
            copy.NumeroReference = source.NumeroReference;
            copy.CopieDeDocumentId = source.CopieDeDocumentId ?? source.Id;

            copy.NumeroBureauOrdre = source.NumeroBureauOrdre;
            copy.Objet = source.Objet;
            copy.Sujet = source.Sujet;
            copy.Notes = source.Notes;
            copy.EstSupprime = false;
            copy.DateCreation = DateTime.Now;

            copy.ServiceActuel = source.ServiceActuel;
            copy.ServiceActuelCode = source.ServiceActuelCode;
            copy.StatutActuel = source.StatutActuel;
            // The copy is handed to whoever accepts it, so it starts out entrusted to
            // the same agent as the folder it was duplicated from.
            copy.GestionnaireUserId = source.GestionnaireUserId;

            // Own physical file, so editing/removing one copy never touches another.
            copy.FilePath = DuplicateAttachment(source.FilePath);

            return copy;
        }

        /// <summary>
        /// Copies the committed journey (accepted and refused hops) of the source
        /// onto its copy, so "Parcours du dossier" on the copy shows the same path
        /// the folder travelled before it was duplicated.
        ///
        /// Pending and cancelled requests are excluded — they never happened — and
        /// so are refusal notices, which are messages to the sender rather than
        /// movements.
        /// </summary>
        public async Task<int> CopyCommittedHistoryAsync(int sourceDocumentId, int copyDocumentId)
        {
            var history = await _context.Transactions
                .AsNoTracking()
                .Where(t => t.DocumentId == sourceDocumentId
                    && (t.Statut == StatutTransaction.Accepte || t.Statut == StatutTransaction.Refuse)
                    && (t.Commentaire == null || t.Commentaire != RefusalNotice))
                .OrderBy(t => t.Id)
                .ToListAsync();

            foreach (var entry in history)
            {
                _context.Transactions.Add(new Transaction
                {
                    DocumentId = copyDocumentId,
                    ServiceOrigine = entry.ServiceOrigine,
                    ServiceOrigineCode = entry.ServiceOrigineCode,
                    ServiceDestination = entry.ServiceDestination,
                    ServiceDestinationCode = entry.ServiceDestinationCode,
                    DateTransaction = entry.DateTransaction,
                    Remarques = entry.Remarques,
                    UtilisateurId = entry.UtilisateurId,
                    Statut = entry.Statut,
                    // The copy's own acceptance is recorded separately; a refusal
                    // notice is never duplicated (it belongs to the sender).
                    Commentaire = null,
                    MotifRefus = entry.MotifRefus,
                    DoitRevenir = entry.DoitRevenir,
                    TargetUserId = entry.TargetUserId,
                    StatutPrecedent = entry.StatutPrecedent,
                    HistoricalServiceCode = entry.HistoricalServiceCode
                });
            }

            await _context.SaveChangesAsync();
            return history.Count;
        }

        /// <summary>
        /// Rebuilds the concrete document type with every field carried over, so a
        /// copy of a juridical folder is a juridical folder (not a bare Document).
        /// </summary>
        private static Document Duplicate(Document source) => source switch
        {
            CourrierAdministratif c => new CourrierAdministratif
            {
                NumeroOrdre = c.NumeroOrdre,
                Expediteur = c.Expediteur,
                DateReception = c.DateReception,
                TypeCircuit = c.TypeCircuit,
                Transmissible = c.Transmissible,
                Source = c.Source,
                DateMessage = c.DateMessage,
                Etat = c.Etat
            },
            DossierJuridique j => new DossierJuridique
            {
                NumeroDossierJuridique = j.NumeroDossierJuridique,
                NumeroPremiereInstance = j.NumeroPremiereInstance,
                TypeDossier = j.TypeDossier,
                LinkedDocumentType = j.LinkedDocumentType,
                // A copy of a linked document stays attached to the same parent.
                DossierParentId = j.DossierParentId,
                TypeCircuit = j.TypeCircuit,
                MotifException = j.MotifException,
                Demandeur = j.Demandeur,
                DateEntree = j.DateEntree,
                EtapeJalsatActuelle = j.EtapeJalsatActuelle,
                EtatGlobal = j.EtatGlobal,
                Circuit = j.Circuit,
                EtapeService = j.EtapeService,
                JalsatTransaction = j.JalsatTransaction,
                TaslimTransaction = j.TaslimTransaction,
                AutoriteRetrait = j.AutoriteRetrait
            },
            CourrierSortant s => new CourrierSortant
            {
                DestinataireExterne = s.DestinataireExterne,
                TypeSortant = s.TypeSortant,
                DateEnvoi = s.DateEnvoi,
                NumeroEnvoi = s.NumeroEnvoi,
                TribunalOrigine = s.TribunalOrigine,
                TribunalDestination = s.TribunalDestination
            },
            _ => throw new NotSupportedException(
                $"Type de document non copiable : {source.GetType().Name}")
        };

        /// <summary>
        /// Gives the copy its own file on disk. When the original has no attachment
        /// (or the file is missing) the stored name is shared — there is nothing to
        /// separate.
        /// </summary>
        private string? DuplicateAttachment(string? storedName)
        {
            if (string.IsNullOrWhiteSpace(storedName)) return storedName;

            var safeName = Path.GetFileName(storedName);
            var folder = UploadsFolder();
            var sourcePath = Path.Combine(folder, safeName);
            if (!File.Exists(sourcePath)) return storedName;

            var extension = Path.GetExtension(safeName);
            var copyName = $"{DateTime.Now:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{extension}";
            File.Copy(sourcePath, Path.Combine(folder, copyName));
            return copyName;
        }

        private string UploadsFolder()
        {
            var folder = Path.Combine(
                _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"),
                "uploads");
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);
            return folder;
        }
    }
}
