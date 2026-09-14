// E2E tests for the Excel / Word export pipeline.
//
// `lib/exportImport.ts` lazy-loads `xlsx` and `mammoth` via dynamic `import()`
// so they stay out of the initial bundle. These tests guarantee the export
// flow still works end-to-end after that refactor (the dynamic import must
// resolve and produce a non-empty Blob).
//
// Requires: backend on :5200 with seeded DB (bureauordre has documents).

describe("Export - Excel & Word (async bundle loading)", () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type("bureauordre");
    cy.get('input[type="password"]').type("bureauordre123");
    cy.get('button[type="submit"]').click();

    cy.get("aside", { timeout: 10000 }).should("exist");
    // "Mes entités" hosts the general Excel/Word export buttons and the
    // "download template" action.
    cy.get("aside").within(() => {
      cy.contains(/Mes entités|وثائقي|ملفاتي/).click();
    });
    cy.wait(1000);
  });

  /** Install Blob capture stubs on the page's URL object. */
  const stubDownload = () => {
    cy.window().then((win) => {
      cy.stub(win.URL, "createObjectURL").as("createObjectURL").returns("blob:mock");
      cy.stub(win.URL, "revokeObjectURL").as("revokeObjectURL");
    });
  };

  /** Assert the captured Blob is non-empty and has the expected MIME type. */
  const expectBlob = (mimeFragment: string) => {
    cy.get("@createObjectURL", { timeout: 15000 }).should((stub) => {
      const calls = (stub as unknown as { getCalls: () => { args: unknown[] }[] }).getCalls();
      expect(calls.length, "URL.createObjectURL call count").to.be.greaterThan(0);
      // The Blob is created in the application's realm, so `instanceof Blob`
      // against the spec realm's constructor is unreliable. Assert structurally.
      const blob = calls[0].args[0] as { size: number; type: string };
      expect(typeof blob, "exported value").to.eq("object");
      expect(blob.size, "exported Blob size").to.be.greaterThan(0);
      expect(blob.type, "exported Blob MIME type").to.contain(mimeFragment);
    });
  };

  it("exports the document list to Excel (.xlsx) via the async xlsx import", () => {
    stubDownload();

    cy.get("button").contains("export excel").should("be.visible").click();

    expectBlob("spreadsheetml");
  });

  it("exports the document list to Word (.doc)", () => {
    stubDownload();

    cy.get("button").contains("export word").should("be.visible").click();

    expectBlob("msword");
  });

  it("downloads the Excel import template (.xlsx)", () => {
    stubDownload();

    cy.contains("button", /Télécharger modèle|تحميل النموذج/).should("be.visible").click();

    expectBlob("spreadsheetml");
  });
});
