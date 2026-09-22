namespace WebApplication1.Helpers
{
    /// <summary>
    /// Authorities entitled to request an exceptional withdrawal of a folder kept
    /// in the archive. These are legal functions, not organisation data, hence a
    /// fixed catalogue rather than an admin-managed list. Stored as a stable code
    /// so the label can be rendered in the user's language.
    /// </summary>
    public static class RetraitAuthorities
    {
        public const string ChefGreffe = "chef_greffe";
        public const string ConseillerRapporteur = "conseiller_rapporteur";
        public const string PremierPresident = "premier_president";

        public static readonly string[] All =
        {
            ChefGreffe,
            ConseillerRapporteur,
            PremierPresident
        };

        public static bool IsValid(string? code) =>
            !string.IsNullOrWhiteSpace(code) && All.Contains(code);
    }
}
