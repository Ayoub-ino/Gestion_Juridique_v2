// Regression spec: the admin account is a system/user manager only.
//
// It must not participate in folder transfers — no transfer notification, no
// transaction register — and every folder action (create, modify, transfer,
// delete) is denied by the seeded admin overrides, so those controls must not be
// rendered either.
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

describe("Admin role boundaries", () => {
  const reference = `TEST-ADMIN-${Date.now()}`;

  before(() => {
    // One folder to look at. The suite-wide purge removes TEST-* fixtures after
    // the spec, so nothing is left in the database.
    cy.request({
      method: "POST",
      url: `${API_URL}/api/auth/login`,
      body: { Login: "bureauordre", Password: "bureauordre123" },
    })
      .its("body.token")
      .then((token: string) => {
        cy.request({
          method: "POST",
          url: `${API_URL}/api/CourrierAdmin`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            NumeroOrdre: reference,
            NumeroReference: reference,
            Expediteur: "Admin boundaries",
            Objet: `Admin boundaries ${reference}`,
          },
        });
      });
  });

  // Cypress clears cookies and localStorage between tests, so every test logs in.
  const loginAsAdmin = () => {
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type("admin");
    cy.get('input[type="password"]').type("admin123");
    cy.get('button[type="submit"]').click();
    cy.get("aside", { timeout: 20000 }).should("exist");
  };

  it("offers only the management screens in the sidebar", () => {
    loginAsAdmin();

    cy.get("aside").within(() => {
      // Management screens are available…
      cy.contains(/Administration|الإدارة/).should("exist");
      cy.contains(/Utilisateurs|المستخدمون/).should("exist");
      cy.contains(/Permissions|الصلاحيات/).should("exist");
      cy.contains(/Équipements|المعدات/).should("exist");
      cy.contains(/Services Historiques|المصالح التاريخية/).should("exist");
      cy.contains(/Listes dynamiques|اللوائح الديناميكية/).should("exist");

      // …but the personal transfer screens are not offered to an admin
      cy.contains(/Registre des transactions|سجل المعاملات/).should("not.exist");
      cy.contains(/Notifications|الإشعارات/).should("not.exist");
    });
  });

  it("shows folders read-only: no transfer, no delete, no edit", () => {
    loginAsAdmin();

    cy.get("aside").within(() => {
      cy.contains(/Mes dossiers|ملفاتي/).click();
    });
    cy.wait(1000);

    // The admin sees folders held by every service, including this one…
    cy.contains("tr", reference, { timeout: 20000 }).within(() => {
      cy.contains(/Voir|عرض/).should("exist");
      // …but cannot act on them
      cy.contains(/Supprimer|حذف/).should("not.exist");
      cy.contains(/Transférer au service suivant|إحالة إلى المصلحة الموالية/).should("not.exist");
    });

    // The detail modal must not offer Modifier / Transférer either
    cy.contains("tr", reference).within(() => {
      cy.contains(/Voir|عرض/).click();
    });

    cy.contains(/Modifier|تعديل/, { timeout: 20000 }).should("not.exist");
    cy.contains(/Transférer au service suivant|إحالة إلى المصلحة الموالية/).should("not.exist");
    cy.contains(/Enregistrer|حفظ/).should("not.exist");
  });
});

export {};
