using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTO;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Domain logic for the workspace (document detail, edition with modification
    /// audit trail, notes and modifications history). The controller stays thin.
    /// </summary>
    public class WorkspaceService
    {
        private readonly AppDbContext _context;

        public WorkspaceService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<ServiceResult> GetDocumentAsync(int id)
        {
            var doc = await _context.Documents
                .Include(d => d.Transactions.OrderByDescending(t => t.DateTransaction).Take(20))
                .FirstOrDefaultAsync(d => d.Id == id);

            if (doc == null) return ServiceResult.Fail(404, "Document non trouvé");

            object details = doc switch
            {
                CourrierAdministratif ca => new
                {
                    type = "entrant-admin",
                    ca.Id, ca.NumeroOrdre, ca.NumeroReference, ca.Sujet, ca.Objet,
                    ca.Expediteur, ca.DateCreation, ca.DateReception,
                    ca.TypeCircuit, ca.ServiceActuel, ca.StatutActuel, ca.FilePath,
                    ca.NumeroBureauOrdre, ca.EstSupprime,
                    transactions = ca.Transactions.Select(t => new
                    {
                        t.Id, t.ServiceOrigine, t.ServiceDestination,
                        t.DateTransaction, t.Remarques, t.Statut,
                        t.Commentaire, t.MotifRefus, t.DoitRevenir
                    })
                },
                DossierJuridique dj => new
                {
                    type = "entrant-juridique",
                    dj.Id, dj.NumeroReference, dj.NumeroDossierJuridique,
                    dj.Sujet, dj.Objet, dj.Demandeur,
                    dj.DateCreation, dj.DateEntree,
                    dj.TypeCircuit, dj.MotifException,
                    dj.ServiceActuel, dj.StatutActuel,
                    dj.FilePath,
                    dj.EtapeJalsatActuelle, dj.EtatGlobal,
                    dj.Circuit, dj.EtapeService,
                    dj.JalsatTransaction, dj.TaslimTransaction,
                    dj.AutoriteRetrait, dj.NumeroBureauOrdre, dj.EstSupprime,
                    transactions = dj.Transactions.Select(t => new
                    {
                        t.Id, t.ServiceOrigine, t.ServiceDestination,
                        t.DateTransaction, t.Remarques, t.Statut,
                        t.Commentaire, t.MotifRefus, t.DoitRevenir
                    })
                },
                CourrierSortant cs => new
                {
                    type = cs.TypeSortant == "demande" ? "sortant-demande" : "sortant-normal",
                    cs.Id, cs.NumeroReference, cs.NumeroEnvoi,
                    cs.Sujet, cs.Objet,
                    cs.DateCreation, cs.DateEnvoi,
                    cs.DestinataireExterne,
                    cs.TribunalOrigine, cs.TribunalDestination,
                    cs.ServiceActuel, cs.StatutActuel,
                    cs.FilePath,
                    cs.NumeroBureauOrdre, cs.EstSupprime,
                    transactions = cs.Transactions.Select(t => new
                    {
                        t.Id, t.ServiceOrigine, t.ServiceDestination,
                        t.DateTransaction, t.Remarques, t.Statut,
                        t.Commentaire, t.MotifRefus, t.DoitRevenir
                    })
                },
                _ => new { type = "unknown", doc.Id }
            };

            return ServiceResult.Ok(details);
        }

        public async Task<ServiceResult> UpdateDocumentAsync(int id, UpdateDocumentDto dto, string userName, string userService)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return ServiceResult.Fail(404, "Document non trouvé");

            var modifications = new List<DocumentModification>();

            void Track(string champ, string? ancienne, string? nouvelle)
            {
                if (nouvelle != null && nouvelle != ancienne)
                {
                    modifications.Add(new DocumentModification
                    {
                        DocumentId = id,
                        Champ = champ,
                        AncienneValeur = ancienne,
                        NouvelleValeur = nouvelle,
                        Utilisateur = userName,
                        Service = userService
                    });
                }
            }

            switch (doc)
            {
                case CourrierAdministratif ca:
                    Track("NumeroOrdre", ca.NumeroOrdre, dto.NumeroOrdre); ca.NumeroOrdre = dto.NumeroOrdre ?? ca.NumeroOrdre;
                    Track("Expediteur", ca.Expediteur, dto.Expediteur); ca.Expediteur = dto.Expediteur ?? ca.Expediteur;
                    Track("Objet", ca.Objet, dto.Objet); ca.Objet = dto.Objet ?? ca.Objet;
                    Track("TypeCircuit", ca.TypeCircuit, dto.TypeCircuit); ca.TypeCircuit = dto.TypeCircuit ?? ca.TypeCircuit;
                    Track("Sujet", ca.Sujet, dto.Sujet); ca.Sujet = dto.Sujet ?? ca.Sujet;
                    break;

                case DossierJuridique dj:
                    Track("Demandeur", dj.Demandeur, dto.Demandeur); dj.Demandeur = dto.Demandeur ?? dj.Demandeur;
                    Track("Objet", dj.Objet, dto.Objet); dj.Objet = dto.Objet ?? dj.Objet;
                    Track("EtatGlobal", dj.EtatGlobal, dto.EtatGlobal); dj.EtatGlobal = dto.EtatGlobal ?? dj.EtatGlobal;
                    Track("EtapeJalsatActuelle", dj.EtapeJalsatActuelle, dto.EtapeJalsatActuelle); dj.EtapeJalsatActuelle = dto.EtapeJalsatActuelle ?? dj.EtapeJalsatActuelle;
                    Track("Circuit", dj.Circuit, dto.Circuit); dj.Circuit = dto.Circuit ?? dj.Circuit;
                    Track("TypeCircuit", dj.TypeCircuit, dto.TypeCircuit); dj.TypeCircuit = dto.TypeCircuit ?? dj.TypeCircuit;
                    Track("MotifException", dj.MotifException, dto.MotifException); dj.MotifException = dto.MotifException ?? dj.MotifException;
                    Track("Sujet", dj.Sujet, dto.Sujet); dj.Sujet = dto.Sujet ?? dj.Sujet;
                    Track("JalsatTransaction", dj.JalsatTransaction, dto.JalsatTransaction); dj.JalsatTransaction = dto.JalsatTransaction ?? dj.JalsatTransaction;
                    Track("TaslimTransaction", dj.TaslimTransaction, dto.TaslimTransaction); dj.TaslimTransaction = dto.TaslimTransaction ?? dj.TaslimTransaction;
                    Track("AutoriteRetrait", dj.AutoriteRetrait, dto.AutoriteRetrait); dj.AutoriteRetrait = dto.AutoriteRetrait ?? dj.AutoriteRetrait;
                    break;

                case CourrierSortant cs:
                    Track("Objet", cs.Objet, dto.Objet); cs.Objet = dto.Objet ?? cs.Objet;
                    Track("DestinataireExterne", cs.DestinataireExterne, dto.DestinataireExterne); cs.DestinataireExterne = dto.DestinataireExterne ?? cs.DestinataireExterne;
                    Track("TribunalOrigine", cs.TribunalOrigine, dto.TribunalOrigine); cs.TribunalOrigine = dto.TribunalOrigine ?? cs.TribunalOrigine;
                    Track("TribunalDestination", cs.TribunalDestination, dto.TribunalDestination); cs.TribunalDestination = dto.TribunalDestination ?? cs.TribunalDestination;
                    Track("Sujet", cs.Sujet, dto.Sujet); cs.Sujet = dto.Sujet ?? cs.Sujet;
                    break;
            }

            if (modifications.Count > 0)
            {
                _context.DocumentModifications.AddRange(modifications);
                await _context.SaveChangesAsync();
            }

            return ServiceResult.Ok(new { message = "Document mis à jour", modifications = modifications.Count });
        }

        public async Task<ServiceResult> GetNotesAsync(int id)
        {
            var notes = await _context.DocumentNotes
                .Where(n => n.DocumentId == id)
                .OrderByDescending(n => n.DateCreation)
                .Select(n => new
                {
                    n.Id, n.DocumentId, n.Contenu, n.Auteur, n.Service,
                    n.DateCreation, n.DateModification
                })
                .ToListAsync();

            return ServiceResult.Ok(notes);
        }

        public async Task<ServiceResult> AddNoteAsync(int id, AddNoteDto dto, string userName, string userService)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return ServiceResult.Fail(404, "Document non trouvé");

            var note = new DocumentNote
            {
                DocumentId = id,
                Contenu = dto.Contenu,
                Auteur = userName,
                Service = userService,
                DateCreation = DateTime.Now
            };

            _context.DocumentNotes.Add(note);
            await _context.SaveChangesAsync();

            return ServiceResult.Ok(new
            {
                note.Id, note.DocumentId, note.Contenu, note.Auteur, note.Service,
                note.DateCreation, note.DateModification
            });
        }

        public async Task<ServiceResult> UpdateNoteAsync(int noteId, AddNoteDto dto)
        {
            var note = await _context.DocumentNotes.FindAsync(noteId);
            if (note == null) return ServiceResult.Fail(404, "Note non trouvée");

            note.Contenu = dto.Contenu;
            note.DateModification = DateTime.Now;
            await _context.SaveChangesAsync();

            return ServiceResult.Ok(new
            {
                note.Id, note.DocumentId, note.Contenu, note.Auteur, note.Service,
                note.DateCreation, note.DateModification
            });
        }

        public async Task<ServiceResult> DeleteNoteAsync(int noteId)
        {
            var note = await _context.DocumentNotes.FindAsync(noteId);
            if (note == null) return ServiceResult.Fail(404, "Note non trouvée");

            _context.DocumentNotes.Remove(note);
            await _context.SaveChangesAsync();

            return ServiceResult.Ok(new { message = "Note supprimée" });
        }

        public async Task<ServiceResult> GetModificationsAsync(int id)
        {
            var mods = await _context.DocumentModifications
                .Where(m => m.DocumentId == id)
                .OrderByDescending(m => m.DateModification)
                .Select(m => new
                {
                    m.Id, m.DocumentId, m.Champ, m.AncienneValeur, m.NouvelleValeur,
                    m.Utilisateur, m.Service, m.DateModification
                })
                .ToListAsync();

            return ServiceResult.Ok(mods);
        }

        public async Task<string> GetUserNameAsync(int userId)
        {
            var user = await _context.Utilisateurs.FindAsync(userId);
            return user?.Nom ?? "Inconnu";
        }

        public async Task<string> GetUserServiceAsync(int userId)
        {
            var user = await _context.Utilisateurs.FindAsync(userId);
            return user?.Service ?? "";
        }

        public async Task<Utilisateur?> GetUserByIdAsync(int userId)
        {
            return await _context.Utilisateurs.FindAsync(userId);
        }
    }
}
