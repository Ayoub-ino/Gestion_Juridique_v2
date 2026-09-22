namespace WebApplication1.Models
{
    /// <summary>
    /// A piece of the court's equipment register.
    ///
    /// <para><b>Fields collected at entry</b> — and only these: the serial number,
    /// free-form additional information, the type and the state (both drawn from
    /// the managed lists <c>types_equipement</c> / <c>etats_equipement</c>), and
    /// the service the item is attached to.</para>
    ///
    /// <para><b>Charge state</b> is never part of the entry form. An item is
    /// created charged; it leaves that state only through an explicit
    /// <c>Décharger</c> action, which stamps <see cref="DateDechargement"/>.</para>
    /// </summary>
    public class Equipment
    {
        public int Id { get; set; }

        /// <summary>Numéro de série — the register's natural key, unique across the table.</summary>
        public string Serial { get; set; } = string.Empty;

        /// <summary>Code of a row in the <c>types_equipement</c> list.</summary>
        public string Type { get; set; } = string.Empty;

        /// <summary>Code of a row in the <c>etats_equipement</c> list.</summary>
        public string Etat { get; set; } = string.Empty;

        /// <summary>Code of the service the item belongs to.</summary>
        public string Service { get; set; } = string.Empty;

        /// <summary>True while the item is charged. New items start charged.</summary>
        public bool EstCharge { get; set; } = true;

        /// <summary>Set when the item is discharged, cleared when it is charged again.</summary>
        public DateTime? DateDechargement { get; set; }

        /// <summary>Informations supplémentaires — optional free text.</summary>
        public string? AdditionalInfo { get; set; }

        public DateTime DateCreation { get; set; } = DateTime.Now;
    }
}
