// E2E coverage for the "Recherche de dossiers" view.
//
// Guards two reported regressions:
//   1. The type filter must offer the three live dossier types and must never
//      show the obsolete "Normal" label (replaced by "Courrier Sortant").
//   2. The date filter is a single input — a duplicate "date fin" picker was
//      reported and must stay removed.
//
// Requires: backend on :5200 with the seeded DB (the `bureauordre` service
// holds `recherche_avancee`, which is what renders the tab).

/**
 * Logs in, switches the UI to French (the app boots in Arabic) and opens the
 * search tab, so the label assertions below are deterministic.
 */
const openSearchView = () => {
  cy.login("bureauordre", "bureauordre123");
  cy.get("aside", { timeout: 20000 }).should("exist");
  cy.get("aside").contains("button", "FR").click();
  cy.contains("button", "Recherche de dossiers", { timeout: 20000 }).click();
  cy.contains("Rechercher des dossiers", { timeout: 20000 }).should("be.visible");
};

describe("Recherche de dossiers", () => {
  it("opens the search view with its empty state", () => {
    openSearchView();
    cy.contains("Rechercher des dossiers").should("be.visible");
  });

  it("lists the three dossier types and never shows the obsolete 'Normal' label", () => {
    openSearchView();

    // The type <select> is the one owning the dossier-type options.
    cy.get('select:has(option[value="entrant-admin"])')
      .should("exist")
      .find("option")
      .then(($options) => {
        const labels = [...$options].map((option) => (option.textContent || "").trim());

        expect(labels).to.deep.equal([
          "Tous les types",
          "Courrier Administratif",
          "Courrier Juridique",
          "Courrier Sortant",
        ]);
        expect(labels).not.to.include("Normal");
      });
  });

  it("renders exactly one date filter input", () => {
    openSearchView();
    cy.get('input[type="date"]').should("have.length", 1);
  });
});
