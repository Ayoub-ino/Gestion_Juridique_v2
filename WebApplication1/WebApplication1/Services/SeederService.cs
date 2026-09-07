using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Seeds the RBAC data (admin user, services, permissions, service permissions,
    /// admin overrides, historical services, demo users) and applies pending EF Core
    /// migrations.
    /// Replaces the ~380-line seeding block that previously lived in Program.cs.
    ///
    /// Two modes:
    ///  - force = false (startup): each step only runs when its table is empty (fast path).
    ///  - force = true  (POST /api/seed/run): idempotent insert-if-missing per row, so the
    ///    RBAC matrix can be re-applied to an already-populated database. Existing rows
    ///    (including overrides or permissions disabled by an admin) are left untouched.
    /// </summary>
    public class SeederService
    {
        private readonly AppDbContext _context;

        public SeederService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> SeedAsync(bool force = false)
        {
            try
            {
                _context.Database.Migrate();
                await SeedCoreAsync(force);
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur seed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Seeds without applying migrations, so it can be exercised with the EF
        /// InMemory provider in unit tests. In force mode performs idempotent
        /// insert-if-missing seeding so the RBAC matrix can be re-applied to an
        /// already-populated database.
        /// Exceptions propagate to the caller (no swallowing) so that failures can
        /// be detected by tests and by the /api/seed/run endpoint.
        /// </summary>
        public async Task SeedCoreAsync(bool force = false)
        {
            // --- 1. Ensure admin user exists ---
                _context.ChangeTracker.Clear();
                var admin = _context.Utilisateurs.FirstOrDefault(u => u.Login == "admin");
                if (admin == null)
                {
                    admin = new Utilisateur
                    {
                        Login = "admin",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                        Nom = "Administrateur",
                        Role = "Admin",
                        Service = "Admin"
                    };
                    _context.Utilisateurs.Add(admin);
                    _context.SaveChanges();
                    Console.WriteLine("=========================================");
                    Console.WriteLine("ADMIN CREE AUTOMATIQUEMENT !");
                    Console.WriteLine("   Login: admin");
                    Console.WriteLine("   Mot de passe: admin123");
                    Console.WriteLine("=========================================");
                }

                // --- 2. Seed RBAC Services (9 target services including atabligh) ---
                _context.ChangeTracker.Clear();
                if (force || !_context.RbacServices.Any())
                {
                    var rbacServices = new List<Service>
                    {
                        new Service { Nom = "Bureau d'ordre", Code = "bureauordre", Description = "Bureau d'ordre et bureau administratif" },
                        new Service { Nom = "Fath M'lafat", Code = "fathmilafat", Description = "Ouverture des dossiers judiciaires" },
                        new Service { Nom = "Secrétariat", Code = "secretarait", Description = "Secrétariat général" },
                        new Service { Nom = "Séances & Procédures", Code = "seances&procedures", Description = "Gestion des séances et procédures" },
                        new Service { Nom = "Khibra (Expertise)", Code = "khibra", Description = "Service d'expertise" },
                        new Service { Nom = "Taslim Nusakh", Code = "taslimnosakh", Description = "Délivrance des copies" },
                        new Service { Nom = "Tasfiyat Sawa2ir Takmilia", Code = "tasfiatSawa2irTakmilia", Description = "Règlement des affaires complémentaires" },
                        new Service { Nom = "Archive", Code = "archive", Description = "Service des archives" },
                        new Service { Nom = "Atabligh", Code = "atabligh", Description = "Service de notification et التبليغ" }
                    };
                    var existingCodes = _context.RbacServices.Select(s => s.Code).ToHashSet();
                    foreach (var svc in rbacServices.Where(s => !existingCodes.Contains(s.Code)))
                    {
                        _context.RbacServices.Add(svc);
                    }
                    _context.SaveChanges();
                    Console.WriteLine("RBAC services créés (insert-if-missing).");

                    // Ensure all seeded services are active (restore any accidentally archived ones)
                    var inactiveSeeded = _context.RbacServices
                        .Where(s => existingCodes.Contains(s.Code) && !s.IsActive)
                        .ToList();
                    if (inactiveSeeded.Count > 0)
                    {
                        foreach (var svc in inactiveSeeded)
                        {
                            svc.IsActive = true;
                            svc.DeletedAt = null;
                        }
                        _context.SaveChanges();
                        Console.WriteLine($"Restauré {inactiveSeeded.Count} service(s) archivé(s) par erreur.");
                    }
                }

                // --- 3. Seed Permissions (~40) ---
                _context.ChangeTracker.Clear();
                if (force || !_context.Permissions.Any())
                {
                    var permissions = new List<Permission>
                    {
                        // Documents
                        new Permission { Key = "transferer", LabelFr = "Transférer", LabelAr = "تحويل", Category = "documents", DefaultEnabled = true },
                        new Permission { Key = "consulter", LabelFr = "Consulter", LabelAr = "استشارة", Category = "documents", DefaultEnabled = true },
                        new Permission { Key = "creer_modifier", LabelFr = "Créer / Modifier", LabelAr = "إنشاء / تعديل", Category = "documents", DefaultEnabled = true },
                        new Permission { Key = "supprimer", LabelFr = "Supprimer", LabelAr = "حذف", Category = "documents", DefaultEnabled = false },
                        new Permission { Key = "archiver", LabelFr = "Archiver", LabelAr = "أرشفة", Category = "documents", DefaultEnabled = true },
                        new Permission { Key = "restaurer", LabelFr = "Restaurer", LabelAr = "استعادة", Category = "documents", DefaultEnabled = false },
                        new Permission { Key = "voir_corbeille", LabelFr = "Voir corbeille", LabelAr = "عرض سلة المهملات", Category = "documents", DefaultEnabled = false },
                        new Permission { Key = "creer_courrier_admin", LabelFr = "Créer courrier administratif", LabelAr = "إنشاء رسالة إدارية", Category = "documents", DefaultEnabled = true },
                        new Permission { Key = "creer_courrier_juridique", LabelFr = "Créer dossier juridique", LabelAr = "إنشاء ملف قضائي", Category = "documents", DefaultEnabled = true },

                        // Notifications
                        new Permission { Key = "accepter", LabelFr = "Accepter", LabelAr = "قبول", Category = "notifications", DefaultEnabled = true },
                        new Permission { Key = "refuser", LabelFr = "Refuser", LabelAr = "رفض", Category = "notifications", DefaultEnabled = true },
                        new Permission { Key = "voir_toutes", LabelFr = "Voir toutes les notifications", LabelAr = "عرض كل الإشعارات", Category = "notifications", DefaultEnabled = false },
                        new Permission { Key = "annuler_transfert", LabelFr = "Annuler transfert", LabelAr = "إلغاء التحويل", Category = "notifications", DefaultEnabled = true },

                        // Juridique
                        new Permission { Key = "etape_precedente", LabelFr = "Étape précédente", LabelAr = "المرحلة السابقة", Category = "juridique", DefaultEnabled = true },
                        new Permission { Key = "etape_suivante", LabelFr = "Étape suivante", LabelAr = "المرحلة التالية", Category = "juridique", DefaultEnabled = true },
                        new Permission { Key = "ouvrir_dossier", LabelFr = "Ouvrir dossier", LabelAr = "فتح ملف", Category = "juridique", DefaultEnabled = true },
                        new Permission { Key = "cloturer", LabelFr = "Clôturer", LabelAr = "إغلاق", Category = "juridique", DefaultEnabled = false },
                        new Permission { Key = "transferer_juridique", LabelFr = "Transférer juridique", LabelAr = "تحويل قضائي", Category = "juridique", DefaultEnabled = true },
                        new Permission { Key = "retrait_archive", LabelFr = "Retrait archive", LabelAr = "سحب من الأرشيف", Category = "juridique", DefaultEnabled = false },

                        // Recherche
                        new Permission { Key = "recherche_avancee", LabelFr = "Recherche avancée", LabelAr = "بحث متقدم", Category = "recherche", DefaultEnabled = true },
                        new Permission { Key = "export_excel", LabelFr = "Export Excel", LabelAr = "تصدير Excel", Category = "recherche", DefaultEnabled = true },
                        new Permission { Key = "export_word", LabelFr = "Export Word", LabelAr = "تصدير Word", Category = "recherche", DefaultEnabled = true },

                        // Admin
                        new Permission { Key = "gerer_utilisateurs", LabelFr = "Gérer utilisateurs", LabelAr = "إدارة المستخدمين", Category = "admin", DefaultEnabled = false },
                        new Permission { Key = "gerer_services", LabelFr = "Gérer services", LabelAr = "إدارة المصالح", Category = "admin", DefaultEnabled = false },
                        new Permission { Key = "gerer_permissions", LabelFr = "Gérer permissions", LabelAr = "إدارة الصلاحيات", Category = "admin", DefaultEnabled = false },
                        new Permission { Key = "gerer_equipements", LabelFr = "Gérer équipements", LabelAr = "إدارة المعدات", Category = "admin", DefaultEnabled = false },
                        new Permission { Key = "gerer_listes", LabelFr = "Gérer listes dynamiques", LabelAr = "إدارة اللوائح الديناميكية", Category = "admin", DefaultEnabled = false },
                        new Permission { Key = "gerer_substituts", LabelFr = "Gérer substituts", LabelAr = "إدارة البدائل", Category = "admin", DefaultEnabled = false },

                        // Autres
                        new Permission { Key = "voir_workspace", LabelFr = "Voir espace de travail", LabelAr = "عرض مساحة العمل", Category = "autres", DefaultEnabled = true },
                        new Permission { Key = "ajouter_notes", LabelFr = "Ajouter notes", LabelAr = "إضافة ملاحظات", Category = "autres", DefaultEnabled = true },
                        new Permission { Key = "voir_historique", LabelFr = "Voir historique", LabelAr = "عرض السجل", Category = "autres", DefaultEnabled = true },
                        new Permission { Key = "telecharger_fichiers", LabelFr = "Télécharger fichiers", LabelAr = "تحميل الملفات", Category = "autres", DefaultEnabled = true },
                        new Permission { Key = "dashboard", LabelFr = "Tableau de bord", LabelAr = "لوحة القيادة", Category = "autres", DefaultEnabled = true },
                        new Permission { Key = "mes_entites", LabelFr = "Mes entités", LabelAr = "كياني", Category = "autres", DefaultEnabled = true },
                        new Permission { Key = "transactions", LabelFr = "Transactions", LabelAr = "المعاملات", Category = "autres", DefaultEnabled = true },
                        new Permission { Key = "archives_view", LabelFr = "Voir archives", LabelAr = "عرض الأرشيف", Category = "autres", DefaultEnabled = true },
                        new Permission { Key = "profil", LabelFr = "Mon profil", LabelAr = "ملفي الشخصي", Category = "autres", DefaultEnabled = true }
                    };
                    var existingKeys = _context.Permissions.Select(p => p.Key).ToHashSet();
                    foreach (var perm in permissions.Where(p => !existingKeys.Contains(p.Key)))
                    {
                        _context.Permissions.Add(perm);
                    }
                    _context.SaveChanges();
                    Console.WriteLine("Permissions créées (insert-if-missing).");
                }

                // --- 4. Seed ServicePermissions (assign default permissions to each service) ---
                _context.ChangeTracker.Clear();
                if (force || !_context.ServicePermissions.Any())
                {
                    var allServices = _context.RbacServices.ToList();

                    // STRICT permission matrix per requirement
                    // All services get notification permissions (accepter, refuser) by default
                    // Admin is excluded from notifications via AdminPermissionOverrides
                    var serviceDefaults = new Dictionary<string, List<string>>
                    {
                        // Creer, Modifier, Transférer + courriers admin + suppression + notes
                        ["bureauordre"] = new() { "creer_modifier", "creer_courrier_admin", "supprimer", "transferer", "consulter", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "transactions", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "ajouter_notes", "profil" },
                        // Creer, Modifier, Transférer + dossiers juridiques + mouvements + notes
                        ["fathmilafat"] = new() { "creer_modifier", "creer_courrier_juridique", "transferer", "transferer_juridique", "consulter", "ouvrir_dossier", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "transactions", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "ajouter_notes", "profil" },
                        // Modifier, Transférer (no creation)
                        ["secretarait"] = new() { "transferer", "consulter", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "transactions", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "ajouter_notes", "profil" },
                        // Mouvements juridiques (étapes Jalsat) + notes
                        ["seances&procedures"] = new() { "transferer", "transferer_juridique", "consulter", "etape_precedente", "etape_suivante", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "transactions", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "ajouter_notes", "profil" },
                        // Expertise (sous-service Jalsat) + notes
                        ["khibra"] = new() { "transferer", "transferer_juridique", "consulter", "etape_precedente", "etape_suivante", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "transactions", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "ajouter_notes", "profil" },
                        // Transférer uniquement + mouvements juridiques (Taslim)
                        ["taslimnosakh"] = new() { "transferer", "transferer_juridique", "consulter", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "transactions", "archives_view", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "profil" },
                        ["tasfiatSawa2irTakmilia"] = new() { "transferer", "transferer_juridique", "consulter", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "transactions", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "profil" },
                        // Archiver, Restaurer, Retraits + suppression + mouvements (retrait archive)
                        ["archive"] = new() { "archiver", "supprimer", "restaurer", "voir_corbeille", "retrait_archive", "transferer_juridique", "consulter", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "archives_view", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "profil" },
                        // atabligh - Transférer uniquement + mouvements juridiques (Tabligh)
                        ["atabligh"] = new() { "transferer", "transferer_juridique", "consulter", "accepter", "refuser", "annuler_transfert", "dashboard", "mes_entites", "transactions", "archives_view", "recherche_avancee", "export_excel", "export_word", "voir_historique", "voir_workspace", "telecharger_fichiers", "profil" }
                    };

                    var existingPerms = _context.ServicePermissions
                        .Select(sp => sp.ServiceId + "|" + sp.PermissionKey)
                        .ToHashSet();
                    var added = 0;
                    foreach (var service in allServices)
                    {
                        if (serviceDefaults.TryGetValue(service.Code, out var permKeys))
                        {
                            foreach (var key in permKeys.Where(k => !existingPerms.Contains(service.Id + "|" + k)))
                            {
                                _context.ServicePermissions.Add(new ServicePermission
                                {
                                    ServiceId = service.Id,
                                    PermissionKey = key,
                                    Enabled = true
                                });
                                added++;
                            }
                        }
                    }
                    _context.SaveChanges();
                    Console.WriteLine($"ServicePermissions assignées ({added} ajoutées).");
                }

                // --- 5. Seed AdminPermissionOverrides (default disabled) ---
                _context.ChangeTracker.Clear();
                if (force || !_context.AdminPermissionOverrides.Any())
                {
                    var adminOverrides = new[]
                    {
                        // Documents: no create, no modify, no delete, no transfer
                        "creer_modifier", "transferer", "supprimer", "restaurer",
                        "archiver", "creer_courrier_admin", "creer_courrier_juridique",
                        // Notifications: no accept, no refuse
                        "accepter", "refuser", "voir_toutes",
                        // Juridique: no workflow actions
                        "etape_precedente", "etape_suivante", "ouvrir_dossier",
                        "cloturer", "transferer_juridique", "retrait_archive",
                        // Recherche: no export, no advanced search
                        "recherche_avancee", "export_excel", "export_word",
                        // Autres: no notes creation
                        "ajouter_notes"
                    };
                    var existingOverrides = _context.AdminPermissionOverrides.Select(o => o.PermissionKey).ToHashSet();
                    var added = 0;
                    foreach (var key in adminOverrides.Where(k => !existingOverrides.Contains(k)))
                    {
                        _context.AdminPermissionOverrides.Add(new AdminPermissionOverride
                        {
                            PermissionKey = key,
                            Enabled = false
                        });
                        added++;
                    }
                    _context.SaveChanges();
                    Console.WriteLine($"AdminPermissionOverrides seedés ({added} ajoutés, 20 permissions désactivées par défaut).");
                }

                // --- 5b. Seed Historical Services (Virtual services for history tracking only) ---
                _context.ChangeTracker.Clear();
                if (force || !_context.HistoricalServices.Any())
                {
                    var historicalServices = new List<HistoricalService>
                    {
                        // Service des audiences (excluding Expertise which is active as Khibra)
                        new HistoricalService { Nom = "Recherche", Code = "recherche", Description = "Service de recherche", SortOrder = 10 },
                        new HistoricalService { Nom = "Commissaire du roi", Code = "commissaire_roi", Description = "Commissaire du roi", SortOrder = 20 },
                        new HistoricalService { Nom = "Conseiller rapporteur", Code = "conseiller_rapporteur", Description = "Conseiller rapporteur", SortOrder = 30 },

                        // Délivrance des copies (excluding Notification which is atabligh, Archives which is active)
                        new HistoricalService { Nom = "Règlement des dépens", Code = "reglement_depens", Description = "Règlement des dépens", SortOrder = 40 },

                        // Secrétariat particulier, Ouverture des dossiers
                        new HistoricalService { Nom = "Secrétariat particulier", Code = "secretariat_particulier", Description = "Secrétariat particulier", SortOrder = 50 },
                        new HistoricalService { Nom = "Ouverture des dossiers", Code = "ouverture_dossiers", Description = "Ouverture des dossiers", SortOrder = 60 },

                        // Autres services
                        new HistoricalService { Nom = "Bureau de notification", Code = "bureau_notification", Description = "Bureau de notification", SortOrder = 70 },
                        new HistoricalService { Nom = "Bureau d'expertise", Code = "bureau_expertise", Description = "Bureau d'expertise", SortOrder = 80 },
                        new HistoricalService { Nom = "Cellule informatique", Code = "cellule_informatique", Description = "Cellule informatique", SortOrder = 90 },
                        new HistoricalService { Nom = "Gestion financière", Code = "gestion_financiere", Description = "Gestion financière", SortOrder = 100 },
                        new HistoricalService { Nom = "Caisse du tribunal", Code = "caisse_tribunal", Description = "Caisse du tribunal", SortOrder = 110 },
                        new HistoricalService { Nom = "Recouvrement", Code = "recouvrement", Description = "Service de recouvrement", SortOrder = 120 },

                        // Procédures commissaire royal, Pourvois en cassation, Remise copie jugement, Efficacité judiciaire, Greffe, Direction
                        new HistoricalService { Nom = "Procédures commissaire royal", Code = "procedures_commissaire_royal", Description = "Procédures commissaire royal", SortOrder = 130 },
                        new HistoricalService { Nom = "Pourvois en cassation", Code = "pourvois_cassation", Description = "Pourvois en cassation", SortOrder = 140 },
                        new HistoricalService { Nom = "Remise copie jugement", Code = "remise_copie_jugement", Description = "Remise copie jugement", SortOrder = 150 },
                        new HistoricalService { Nom = "Efficacité judiciaire", Code = "efficacite_judiciaire", Description = "Efficacité judiciaire", SortOrder = 160 },
                        new HistoricalService { Nom = "Greffe", Code = "greffe", Description = "Greffe", SortOrder = 170 },
                        new HistoricalService { Nom = "Direction", Code = "direction", Description = "Direction", SortOrder = 180 }
                    };
                    var existingCodes = _context.HistoricalServices.Select(s => s.Code).ToHashSet();
                    foreach (var svc in historicalServices.Where(s => !existingCodes.Contains(s.Code)))
                    {
                        _context.HistoricalServices.Add(svc);
                    }
                    _context.SaveChanges();
                    Console.WriteLine("Services historiques créés (insert-if-missing).");
                }

                // --- 6. Seed one user per RBAC service (including atabligh) ---
                _context.ChangeTracker.Clear();
                var rbacServiceList = _context.RbacServices.ToList();
                var serviceUserDefs = new[]
                {
                    new { Login = "bureauordre", Pass = "bureauordre123", Nom = "Agent Bureau d'Ordre", ServiceCode = "bureauordre" },
                    new { Login = "fathmilafat", Pass = "fathmilafat123", Nom = "Agent Fath M'lafat", ServiceCode = "fathmilafat" },
                    new { Login = "secretarait", Pass = "secretarait123", Nom = "Agent Secrétariat", ServiceCode = "secretarait" },
                    new { Login = "seances", Pass = "seances123", Nom = "Agent Séances & Procédures", ServiceCode = "seances&procedures" },
                    new { Login = "khibra", Pass = "khibra123", Nom = "Agent Expertise", ServiceCode = "khibra" },
                    new { Login = "taslimnosakh", Pass = "taslim123", Nom = "Agent Taslim Nusakh", ServiceCode = "taslimnosakh" },
                    new { Login = "tasfiya", Pass = "tasfiya123", Nom = "Agent Tasfiyat Sawa2ir", ServiceCode = "tasfiatSawa2irTakmilia" },
                    new { Login = "archive", Pass = "archive123", Nom = "Agent Archive", ServiceCode = "archive" },
                    new { Login = "atabligh", Pass = "atabligh123", Nom = "Agent Atabligh", ServiceCode = "atabligh" }
                };

                var createdUsers = 0;
                foreach (var u in serviceUserDefs)
                {
                    if (!_context.Utilisateurs.Any(x => x.Login == u.Login))
                    {
                        var svc = rbacServiceList.FirstOrDefault(s => s.Code == u.ServiceCode);
                        _context.Utilisateurs.Add(new Utilisateur
                        {
                            Login = u.Login,
                            PasswordHash = BCrypt.Net.BCrypt.HashPassword(u.Pass),
                            Nom = u.Nom,
                            Role = "User",
                            Service = u.ServiceCode,
                            ServiceId = svc?.Id
                        });
                        createdUsers++;
                    }
                }
                _context.SaveChanges();
                Console.WriteLine($"Utilisateurs RBAC créés ({createdUsers} ajoutés).");

                // Safety: ensure every active service has at least one active user
                _context.ChangeTracker.Clear();
                var servicesWithoutUsers = _context.RbacServices
                    .Where(s => s.IsActive)
                    .Where(s => !_context.Utilisateurs.Any(u => u.ServiceId == s.Id && u.IsActive))
                    .ToList();
                foreach (var svc in servicesWithoutUsers)
                {
                    var login = svc.Code.Replace("&", "").ToLower();
                    _context.Utilisateurs.Add(new Utilisateur
                    {
                        Login = login,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword($"{login}123"),
                        Nom = $"Agent {svc.Nom}",
                        Role = "User",
                        Service = svc.Code,
                        ServiceId = svc.Id
                    });
                    Console.WriteLine($"Créé utilisateur de secours pour {svc.Code}: {login}");
                }
                _context.SaveChanges();
        }
    }
}
