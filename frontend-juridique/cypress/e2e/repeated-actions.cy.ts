// Regression spec: a user must be able to repeat a decision (accept / refuse /
// delete / edit+save) many times in a row. Historically the third or fourth
// action crashed React inside the click handler.
//
// Every console error, uncaught exception and non-2xx API response is recorded
// so the spec can report exactly what broke.
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

class Problems {
  private readonly items: string[] = [];
  get list(): string[] {
    return this.items;
  }
  add(entry: string) {
    if (!this.items.includes(entry)) this.items.push(entry);
  }
}

describe("Repeated transfer actions", () => {
  const stamp = Date.now();
  let refCounter = 0;
  const nextReference = () => `REP-${stamp}-${++refCounter}`;

  const login = (user: string, pass: string) =>
    cy
      .request({
        method: "POST",
        url: `${API_URL}/api/auth/login`,
        body: { Login: user, Password: pass },
        failOnStatusCode: false,
      })
      .then((r) => {
        expect(r.status, `login ${user}`).to.eq(200);
        return r.body.token as string;
      });

  // `body` accepts both objects and raw arrays (the batch endpoints take `int[]`)
  const authed = (
    token: string,
    method: Cypress.HttpMethod,
    url: string,
    body?: unknown,
  ) =>
    cy.request({
      method,
      url,
      headers: { Authorization: `Bearer ${token}` },
      body: body as Record<string, unknown> | undefined,
      failOnStatusCode: false,
    });

  const createdDocIds: number[] = [];

  const createCourrier = (transfer: boolean) =>
    login("bureauordre", "bureauordre123").then((t) => {
      const reference = nextReference();
      return authed(t, "POST", `${API_URL}/api/CourrierAdmin`, {
        NumeroOrdre: reference,
        NumeroReference: reference,
        Expediteur: "Repeated Actions",
        Objet: `Repeated actions ${reference}`,
      }).then((res) => {
        expect(res.status).to.eq(201);
        const id = (res.body.courrier?.id ?? res.body.id) as number;
        createdDocIds.push(id);
        if (!transfer) return id;
        return authed(t, "POST", `${API_URL}/api/Transfer`, {
          documentId: id,
          documentType: "entrant-admin",
          serviceDestination: "atabligh",
          message: "repeated actions check",
        }).then((tr) => {
          expect(tr.status).to.eq(200);
          return id;
        });
      });
    });

  const createMany = (count: number, transfer: boolean) =>
    Array.from({ length: count })
      .reduce(
        (acc: Cypress.Chainable, _, i) => acc.then(() => createCourrier(transfer && i >= 0)),
        cy.wrap(null) as Cypress.Chainable,
      )
      .then(() => undefined);

  /** Records console errors, uncaught exceptions and failed API responses. */
  const watchForProblems = (problems: Problems) => {
    cy.intercept("**/api/**", (req) => {
      req.continue((res) => {
        if (res.statusCode >= 400) {
          problems.add(`HTTP ${res.statusCode} ${req.method} ${req.url}`);
        }
      });
    });
    cy.on("uncaught:exception", (err) => {
      problems.add(`uncaught ${err?.name}: ${err?.message}`);
      return false;
    });
    cy.on("window:before:load", (win) => {
      const original = win.console.error.bind(win.console);
      win.console.error = (...args: unknown[]) => {
        problems.add(`console.error: ${args.map((a) => String(a)).join(" ").slice(0, 300)}`);
        original(...args);
      };
    });
  };

  const loginThroughUi = (user: string, pass: string) => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type(user);
    cy.get('input[type="password"]').type(pass);
    cy.get('button[type="submit"]').click();
    cy.get("aside", { timeout: 20000 }).should("exist");
  };

  const clickButton = (pattern: RegExp) =>
    cy
      .get("button", { timeout: 20000 })
      .filter((_, el) => pattern.test((el.textContent || "").trim()))
      .first()
      .click({ force: true });

  after(() => {
    if (createdDocIds.length === 0) return;

    // The batch endpoints take a plain id list and do not check custody, so a
    // single account holding `supprimer` (the bureau d'ordre) can purge folders
    // that were accepted by another service during the run.
    login("bureauordre", "bureauordre123").then((t) =>
      authed(t, "POST", `${API_URL}/api/Documents/supprimer-batch`, createdDocIds)
        .then(() =>
          authed(t, "POST", `${API_URL}/api/Documents/permanent-delete-batch`, createdDocIds),
        )
        .then(() => undefined),
    );
  });

  it("edits and saves the same folder five times", () => {
    const problems = new Problems();
    watchForProblems(problems);

    createMany(1, false)
      .then(() => loginThroughUi("bureauordre", "bureauordre123"))
      .then(() => {
        cy.get("aside").within(() => {
          cy.contains(/Mes entités|ملفاتي/).click();
        });
        cy.wait(1000);
      });

    for (let i = 0; i < 5; i++) {
      cy.get("tbody tr", { timeout: 20000 })
        .should("have.length.at.least", 1)
        .first()
        .find("button")
        .filter((_, el) => /^(Voir|عرض)$/.test((el.textContent || "").trim()))
        .first()
        .click({ force: true });

      // A custodian may edit: the Modifier button must be offered
      clickButton(/^(Modifier|تعديل)$/);
      cy.get("input, textarea", { timeout: 20000 }).should("have.length.at.least", 1);

      // The save button is disabled ("...") while a save is in flight, so wait
      // for it to be offered before clicking.
      cy.get("button", { timeout: 20000 })
        .filter((_, el) => /^(Enregistrer|حفظ)$/.test((el.textContent || "").trim()))
        .should("have.length.at.least", 1)
        .first()
        .click({ force: true });

      // The modification must reach the backend, not just close the editor
      cy.contains(/Enregistré avec succès|تم الحفظ بنجاح/, { timeout: 20000 }).should("exist");
      clickButton(/^(Fermer|إغلاق)$/);
      cy.wait(300);
    }

    cy.wrap(null).then(() => {
      expect(problems.list, `problems: ${problems.list.join(" | ")}`).to.have.length(0);
    });
  });

  it("deletes six folders in a row", () => {
    const problems = new Problems();
    watchForProblems(problems);

    createMany(6, false)
      .then(() => loginThroughUi("bureauordre", "bureauordre123"))
      .then(() => {
        cy.get("aside").within(() => {
          cy.contains(/Mes entités|ملفاتي/).click();
        });
        cy.wait(1000);
      });

    const deleteButtonInFirstRow = () =>
      cy
        .get("tbody tr", { timeout: 20000 })
        .should("have.length.at.least", 1)
        .first()
        .find("button")
        .filter((_, el) => /^(Supprimer|حذف)$/.test((el.textContent || "").trim()));

    for (let i = 0; i < 6; i++) {
      // Read the reference of the row we are about to delete (the row checkbox
      // carries it as its aria-label) and wait for that row to leave the table
      // afterwards. Deleting is a soft delete followed by a refetch; asserting
      // on the observable result makes the loop deterministic instead of racing
      // an in-flight request with a fixed sleep.
      cy.get("tbody tr", { timeout: 20000 })
        .should("have.length.at.least", 1)
        .first()
        .find("td")
        .eq(1) // objet column — unique per fixture, unlike the shared N° de bureau
        .invoke("text")
        .then((objet) => {
          const label = String(objet ?? "").trim();
          deleteButtonInFirstRow().first().click({ force: true });
          // Deleting asks for confirmation through the in-app dialog now
          cy.get('[data-testid="confirm-accept"]', { timeout: 20000 }).click();
          if (label) {
            cy.contains("tbody tr", label, { timeout: 20000 }).should("not.exist");
          } else {
            cy.wait(700);
          }
        });
    }

    cy.wrap(null).then(() => {
      expect(problems.list, `problems: ${problems.list.join(" | ")}`).to.have.length(0);
    });
  });

  it("accepts six incoming transfers in a row", () => {
    const problems = new Problems();
    watchForProblems(problems);

    createMany(6, true)
      .then(() => loginThroughUi("atabligh", "atabligh123"))
      .then(() => {
        cy.get("aside").within(() => {
          cy.contains(/Registre des transactions|سجل المعاملات/).click();
        });
        cy.wait(1000);
      });

    for (let i = 0; i < 6; i++) {
      clickButton(/^(Accepter|قبول)$/);
      cy.wait(600);
    }

    cy.wrap(null).then(() => {
      expect(problems.list, `problems: ${problems.list.join(" | ")}`).to.have.length(0);
    });
  });
});

// Keep this spec a module: without an import/export statement its top-level
// constants would live in the global scope and collide with the other specs'.
export {};
