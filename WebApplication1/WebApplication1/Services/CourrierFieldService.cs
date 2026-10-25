using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    /// <summary>
    /// Reads and validates the admin-managed field definitions of the three
    /// « Gérer les courriers » forms.
    ///
    /// Everything the forms and the creation endpoints know about their field set
    /// comes from here: which fields exist, their labels, their order, whether they
    /// are shown, and — enforced server-side, not just by a red asterisk — whether
    /// they are required.
    /// </summary>
    public class CourrierFieldService
    {
        public const string Administratif = "administratif";
        public const string Juridique = "juridique";
        public const string Sortant = "sortant";

        /// <summary>The three form types, in the order the admin tab shows them.</summary>
        public static readonly string[] Types = { Administratif, Juridique, Sortant };

        /// <summary>
        /// Sentinel a controller passes for a field that must be filled in the FORM
        /// but that the API has always accepted empty — « Source », « Date
        /// d'arrivée », « Mode de traitement », the destination pickers.
        ///
        /// The rule the three creation endpoints follow is: the API enforces the
        /// folder's identity (the reference number), its subject, and every field
        /// the administrator ADDED; the remaining standard fields are enforced by
        /// the form, so an existing integration that posts a partial payload keeps
        /// working exactly as before while « Gestion des champs » still owns what
        /// the form shows and demands.
        /// </summary>
        public const string FormEnforced = "form-level";

        private readonly AppDbContext _context;

        public CourrierFieldService(AppDbContext context)
        {
            _context = context;
        }

        public static bool IsKnownType(string? type) =>
            type != null && Types.Contains(type);

        /// <summary>
        /// Active fields of a form, in display order.
        /// <paramref name="includeInactive"/> is used by the admin screen only.
        /// </summary>
        public async Task<List<CourrierFieldConfig>> GetFieldsAsync(string type, bool includeInactive = false)
        {
            var query = _context.CourrierFields.Where(f => f.CourrierType == type);
            if (!includeInactive)
                query = query.Where(f => f.IsActive);

            return await query
                .OrderBy(f => f.DisplayOrder)
                .ThenBy(f => f.Id)
                .ToListAsync();
        }

        /// <summary>
        /// Every field of every type, ordered — what the admin screen renders.
        /// </summary>
        public async Task<List<CourrierFieldConfig>> GetAllFieldsAsync() =>
            await _context.CourrierFields
                .OrderBy(f => f.CourrierType)
                .ThenBy(f => f.DisplayOrder)
                .ThenBy(f => f.Id)
                .ToListAsync();

        /// <summary>
        /// Required fields the caller left empty, as their French label.
        ///
        /// This is the server-side counterpart of the form's « * »: a field the
        /// admin marked required cannot be bypassed by posting to the API directly.
        /// A value counts as missing when it is blank, or an unchecked checkbox
        /// ("False"/"false"), so a required toggle behaves like a required input.
        ///
        /// Two kinds of key are skipped, both deliberately: one the caller does not
        /// pass at all (some widgets have no value at creation time — the
        /// attachment is uploaded once the folder exists), and one passed as
        /// <see cref="FormEnforced"/>.
        /// </summary>
        public async Task<List<string>> FindMissingRequiredAsync(
            string type,
            IReadOnlyDictionary<string, string?> values)
        {
            var required = await _context.CourrierFields
                .Where(f => f.CourrierType == type && f.IsActive && f.IsRequired)
                .OrderBy(f => f.DisplayOrder)
                .ToListAsync();

            var missing = new List<string>();
            foreach (var field in required)
            {
                if (!values.TryGetValue(field.FieldKey, out var value))
                {
                    // A custom field only ever arrives through the JSON bag, so its
                    // absence really does mean "not filled in". A standard widget the
                    // caller does not send (the attachment, uploaded once the folder
                    // exists) is left to the form.
                    if (field.IsCustom) missing.Add(field.LabelFr);
                    continue;
                }
                if (IsBlank(value)) missing.Add(field.LabelFr);
            }
            return missing;
        }

        private static bool IsBlank(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return true;
            var trimmed = value.Trim();
            return trimmed.Equals("false", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// The default field set of the reference forms. Seeded once; from then on
        /// the database is authoritative and the admin panel owns the field set.
        /// </summary>
        internal static List<CourrierFieldConfig> DefaultFields()
        {
            var rows = new List<CourrierFieldConfig>();
            var order = 0;

            void Add(string type, string key, string fr, string ar, string widget, bool required)
            {
                rows.Add(new CourrierFieldConfig
                {
                    CourrierType = type,
                    FieldKey = key,
                    LabelFr = fr,
                    LabelAr = ar,
                    FieldType = widget,
                    IsRequired = required,
                    IsActive = true,
                    IsCustom = false,
                    DisplayOrder = ++order
                });
            }

            order = 0;
            Add(Administratif, "source", "Source", "المصدر", "select", true);
            Add(Administratif, "dateArrivee", "Date d'arrivée", "تاريخ التوصل", "date", true);
            Add(Administratif, "dateMessage", "Date du message", "تاريخ الرسالة", "date", false);
            Add(Administratif, "numeroInterne", "Numéro interne", "الرقم الداخلي", "text", true);
            Add(Administratif, "numeroBureau", "N° de bureau", "رقم المكتب", "text", false);
            Add(Administratif, "transmissible", "Transmissible", "قابل للتحويل", "checkbox", false);
            Add(Administratif, "etat", "État", "الحالة", "select", false);
            Add(Administratif, "service", "Service", "المصلحة", "text", false);
            Add(Administratif, "objet", "Objet", "الموضوع", "text", true);
            Add(Administratif, "document", "Document (PDF / Word / Excel)", "وثيقة (PDF / Word / Excel)", "file", false);
            Add(Administratif, "notes", "Notes", "ملاحظات", "textarea", false);
            Add(Administratif, "modeTraitement", "Mode de traitement", "طريقة المعالجة", "select", true);
            Add(Administratif, "serviceDestinataire", "Service destinataire", "المصلحة المستقبِلة", "select", false);
            Add(Administratif, "servicesDiffusion", "Services de diffusion", "مصالح النشر", "select", false);

            order = 0;
            Add(Juridique, "dossierLie", "Dossier lié", "ملف مرتبط", "select", false);
            Add(Juridique, "typeDocumentLie", "Type de document lié", "نوع الوثيقة المرتبطة", "select", false);
            Add(Juridique, "sourceDocLie", "Source du document lié", "مصدر الوثيقة المرتبطة", "select", true);
            Add(Juridique, "dossierParent", "Dossier parent", "الملف الأصلي", "select", false);
            Add(Juridique, "objet", "Objet", "الموضوع", "text", true);
            Add(Juridique, "tribunalSource", "Tribunal / Source", "المحكمة / المصدر", "select", true);
            Add(Juridique, "date", "Date", "التاريخ", "date", true);
            Add(Juridique, "numeroDossierJuridique", "Numéro dossier judiciaire", "رقم الملف القضائي", "text", true);
            Add(Juridique, "numeroBureau", "N° de bureau", "رقم المكتب", "text", false);
            Add(Juridique, "etat", "État", "الحالة", "select", false);
            Add(Juridique, "service", "Service", "المصلحة", "text", false);
            Add(Juridique, "numeroDossierAppel", "Numéro dossier (Cour d'Appel)", "رقم الملف (محكمة الاستئناف)", "text", true);
            Add(Juridique, "typeDossier", "Type de dossier", "نوع الملف", "select", false);
            Add(Juridique, "numeroPremiereInstance", "Numéro de première instance", "رقم الدرجة الأولى", "text", false);
            Add(Juridique, "document", "Document (PDF / Word / Excel)", "وثيقة (PDF / Word / Excel)", "file", false);
            Add(Juridique, "notes", "Notes", "ملاحظات", "textarea", false);
            Add(Juridique, "serviceDestination", "Service destinataire", "المصلحة المستقبِلة", "select", true);
            Add(Juridique, "recipientUser", "Utilisateur destinataire", "المستخدم المستقبِل", "select", false);

            order = 0;
            Add(Sortant, "numeroBureau", "N° de bureau", "رقم المكتب", "text", false);
            Add(Sortant, "service", "Service", "المصلحة", "text", false);
            Add(Sortant, "destinataire", "Destinataire", "المُرسَل إليه", "text", false);
            Add(Sortant, "objet", "Objet", "الموضوع", "text", true);
            Add(Sortant, "dateEnvoi", "Date", "التاريخ", "date", true);
            Add(Sortant, "document", "Document (PDF / Word / Excel)", "وثيقة (PDF / Word / Excel)", "file", false);
            Add(Sortant, "notes", "Notes", "ملاحظات", "textarea", false);

            return rows;
        }
    }

    /// <summary>
    /// Serialization of the values held in the JSON bag (<see cref="Models.Document.ChampsPersonnalises"/>).
    /// Kept in one place so the three creation endpoints cannot drift apart.
    /// </summary>
    public static class CourrierFieldValues
    {
        private static readonly System.Text.Json.JsonSerializerOptions Options = new()
        {
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        /// <summary>
        /// Serialize the submitted values, dropping blanks. Returns null when there
        /// is nothing to keep, so an untouched form stores no empty JSON object.
        /// </summary>
        public static string? Serialize(IReadOnlyDictionary<string, string?>? values)
        {
            if (values == null || values.Count == 0) return null;

            var kept = values
                .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            return kept.Count == 0 ? null : System.Text.Json.JsonSerializer.Serialize(kept, Options);
        }
    }
}
