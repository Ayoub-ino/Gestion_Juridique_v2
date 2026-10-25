namespace WebApplication1.Models
{
    /// <summary>
    /// Definition of one field of one of the three "Gérer les courriers" forms
    /// (administratif / juridique / sortant).
    ///
    /// The forms are rendered from this table and the backend validates against
    /// it, so an administrator can rename, reorder, require, hide, add or remove
    /// a field from « Gestion des champs » without a redeploy. Nothing about the
    /// field set is hardcoded.
    /// </summary>
    public class CourrierFieldConfig
    {
        public int Id { get; set; }

        /// <summary>"administratif" | "juridique" | "sortant".</summary>
        public string CourrierType { get; set; } = string.Empty;

        /// <summary>
        /// Stable key binding the field to its widget and to the DTO property.
        /// Keys of the seeded fields match the existing forms so no stored data
        /// moves; custom fields use a generated key and are kept in the JSON bag.
        /// </summary>
        public string FieldKey { get; set; } = string.Empty;

        public string LabelFr { get; set; } = string.Empty;
        public string LabelAr { get; set; } = string.Empty;

        /// <summary>
        /// Widget hint: text | number | date | textarea | select | checkbox | file.
        /// Only custom fields use it directly (the seeded fields keep their own
        /// richer widgets in the form components).
        /// </summary>
        public string FieldType { get; set; } = "text";

        /// <summary>Rendered with the red « * » and enforced server-side.</summary>
        public bool IsRequired { get; set; }

        /// <summary>When false the field is hidden from the form and the listing.</summary>
        public bool IsActive { get; set; } = true;

        /// <summary>True for fields added from the admin panel (value stored in the JSON bag).</summary>
        public bool IsCustom { get; set; }

        public int DisplayOrder { get; set; }
    }
}
