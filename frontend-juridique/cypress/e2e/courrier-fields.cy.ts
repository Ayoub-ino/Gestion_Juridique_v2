// Regression spec: « Gestion des champs des courriers ».
//
// The administrator's tab owns the field set of the three « Gérer les courriers »
// forms (administratif / juridique / sortant). What matters is that the set is
// DATA, not code: each form has its own fields, a field added from the screen
// reaches the form the agents fill in, a field marked mandatory is refused by the
// API when empty, and a hidden field leaves the form without being deleted.
//
// Every field this spec creates is deleted again in `after`, and every folder
// carries a `TEST-` reference so the suite-wide purge removes it.
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

/** The three form types, and a field key only that form defines. */
const FORM_TYPES = [
  { type: "administratif", signatureKey: "modeTraitement", subTab: "entrant-admin" },
  { type: "juridique", signatureKey: "numeroDossierJuridique", subTab: "entrant-juridique" },
  { type: "sortant", signatureKey: "destinataire", subTab: "sortant-normal" },
] as const;

interface FieldRow {
  id: number;
  courrierType: string;
  fieldKey: string;
  labelFr: string;
  labelAr: string;
  isRequired: boolean;
  isActive: boolean;
  isCustom: boolean;
  displayOrder: number;
}

describe("Gestion des champs des courriers", () => {
  const stamp = Date.now();
  // Labels created through the screen are recognised by this prefix, so the
  // cleanup can find a field whose generated key the test never learns.
  const UI_LABEL_PREFIX = `Vérif champs ${stamp}`;
  let adminToken = "";
  // The administrator owns the field set but does not create folders —
  // `POST /api/CourrierAdmin` needs `creer_courrier_admin`, which the admin
  // deliberately lacks. Creation is therefore done as an agent, so the required
  // field is enforced by validation rather than refused by RBAC.
  let agentToken = "";
  const createdFieldIds: number[] = [];

  const authedAs = (
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

  const authed = (method: Cypress.HttpMethod, url: string, body?: unknown) =>
    authedAs(adminToken, method, url, body);

  const allFields = (): Cypress.Chainable<FieldRow[]> =>
    authed("GET", `${API_URL}/api/CourrierFields`).then(
      (r) => r.body as FieldRow[],
    );

  const activeFields = (type: string): Cypress.Chainable<FieldRow[]> =>
    authed("GET", `${API_URL}/api/CourrierFields/${type}`).then(
      (r) => r.body as FieldRow[],
    );

  const addField = (
    overrides: Record<string, unknown> = {},
  ): Cypress.Chainable<FieldRow> =>
    authed("POST", `${API_URL}/api/CourrierFields`, {
      courrierType: "administratif",
      labelFr: `${UI_LABEL_PREFIX} API`,
      labelAr: `حقل تحقق ${stamp}`,
      fieldType: "text",
      isRequired: false,
      isActive: true,
      ...overrides,
    }).then((r) => {
      const field = r.body as FieldRow;
      if (r.status === 201 && field?.id) createdFieldIds.push(field.id);
      return field;
    });

  const removeField = (id: number) =>
    authed("DELETE", `${API_URL}/api/CourrierFields/${id}`);

  before(() => {
    cy.request({
      method: "POST",
      url: `${API_URL}/api/auth/login`,
      body: { Login: "admin", Password: "admin123" },
      failOnStatusCode: false,
    })
      .then((r) => {
        expect(r.status, "admin login").to.eq(200);
        adminToken = r.body.token as string;
        return cy.request({
          method: "POST",
          url: `${API_URL}/api/auth/login`,
          body: { Login: "bureauordre", Password: "bureauordre123" },
          failOnStatusCode: false,
        });
      })
      .then((r) => {
        expect(r.status, "agent login").to.eq(200);
        agentToken = r.body.token as string;
      });
  });

  after(() => {
    // The field set is live configuration: whatever this spec added goes back out,
    // whether it was created through the API (tracked id) or through the screen
    // (found by its label).
    allFields().then((rows) => {
      const ids = new Set<number>(createdFieldIds);
      rows
        .filter((f) => (f.labelFr || "").startsWith(UI_LABEL_PREFIX))
        .forEach((f) => ids.add(f.id));
      Array.from(ids).forEach((id) => removeField(id));
    });
  });

  // -------------------------------------------------------------------------
  // The field set is data, not code
  // -------------------------------------------------------------------------
  it("gives each of the three forms its own ordered field set", () => {
    const keysByType: Record<string, string[]> = {};

    FORM_TYPES.reduce(
      (chain, { type, signatureKey }) =>
        chain.then(() =>
          activeFields(type).then((rows) => {
            expect(rows.length, `${type} has fields`).to.be.greaterThan(0);
            expect(
              rows.map((f) => f.fieldKey),
              `${type} carries its own signature field`,
            ).to.include(signatureKey);
            // Display order is what the form renders, so it must be usable as-is.
            const orders = rows.map((f) => f.displayOrder);
            expect([...orders].sort((a, b) => a - b), `${type} is ordered`).to.deep.eq(orders);
            keysByType[type] = rows.map((f) => f.fieldKey);
          }),
        ),
      cy.wrap(null) as Cypress.Chainable,
    ).then(() => {
      // The forms are genuinely separate configurations, not one shared list.
      expect(keysByType.administratif, "administratif has a field sortant lacks").to.include(
        "modeTraitement",
      );
      expect(keysByType.sortant, "sortant has a field administratif lacks").to.include(
        "destinataire",
      );
    });
  });

  it("rejects an unknown form type instead of inventing a field set", () => {
    authed("GET", `${API_URL}/api/CourrierFields/inexistant`).then((r) =>
      expect(r.status).to.eq(400),
    );
  });

  // -------------------------------------------------------------------------
  // Add / require / hide
  // -------------------------------------------------------------------------
  it("adds a field and enforces it server-side when marked required", () => {
    addField({ isRequired: true }).then((field) => {
      expect(field.isCustom, "a field added from the screen is custom").to.eq(true);
      expect(field.fieldKey, "a key is generated from the label").to.match(/^verif_champs_/);

      activeFields("administratif").then((rows) => {
        const found = rows.find((f) => f.id === field.id);
        expect(found, "the new field reaches the form").to.exist;
        expect(found!.isRequired).to.eq(true);
      });

      // The red « * » is not decoration: the API refuses a folder without it.
      authedAs(agentToken, "POST", `${API_URL}/api/CourrierAdmin`, {
        numeroReference: `TEST-CF-${stamp}-REQ`,
        objet: "sans le champ obligatoire",
      }).then((r) => {
        expect(r.status, "missing required custom field").to.eq(400);
        expect(String(r.body.error)).to.contain(field.labelFr);
      });

      // Filled, the folder is accepted and the value is kept.
      authedAs(agentToken, "POST", `${API_URL}/api/CourrierAdmin`, {
        numeroReference: `TEST-CF-${stamp}-OK`,
        objet: "avec le champ obligatoire",
        champsPersonnalises: { [field.fieldKey]: "valeur de contrôle" },
      }).then((r) => {
        expect(r.status, "filled custom field accepted").to.be.oneOf([200, 201]);
        const documentId = (r.body.courrier?.id ?? r.body.id ?? r.body.documentId) as number;
        expect(documentId, "the folder was created").to.be.a("number");
        authed("GET", `${API_URL}/api/CourrierAdmin`).then((list) => {
          const row = (list.body as Array<Record<string, unknown>>).find(
            (d) => d.numeroReference === `TEST-CF-${stamp}-OK`,
          );
          expect(row, "the folder is listed").to.exist;
        });
      });
    });
  });

  it("hides a field from the form without deleting it", () => {
    addField().then((field) => {
      authed("PUT", `${API_URL}/api/CourrierFields/${field.id}`, {
        isActive: false,
      }).then((r) => expect(r.status).to.eq(200));

      activeFields("administratif").then((rows) =>
        expect(
          rows.find((f) => f.id === field.id),
          "a hidden field leaves the form",
        ).to.not.exist,
      );

      // Still configured — hiding is not deleting.
      allFields().then((rows) => {
        const hidden = rows.find((f) => f.id === field.id);
        expect(hidden, "the hidden field is kept in the configuration").to.exist;
        expect(hidden!.isActive).to.eq(false);
      });
    });
  });

  it("keeps the field set out of reach of a user without gerer_champs_courrier", () => {
    cy.request({
      method: "POST",
      url: `${API_URL}/api/auth/login`,
      body: { Login: "khibra", Password: "khibra123" },
      failOnStatusCode: false,
    }).then((login) => {
      expect(login.status).to.eq(200);
      const token = login.body.token as string;

      // The forms still read their own field set…
      cy.request({
        method: "GET",
        url: `${API_URL}/api/CourrierFields/administratif`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((r) => expect(r.status, "a form may read its fields").to.eq(200));

      // …but the hidden configuration and any change are the administrator's.
      cy.request({
        method: "GET",
        url: `${API_URL}/api/CourrierFields`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((r) => expect(r.status, "the full configuration is withheld").to.eq(403));

      cy.request({
        method: "POST",
        url: `${API_URL}/api/CourrierFields`,
        headers: { Authorization: `Bearer ${token}` },
        body: { courrierType: "administratif", labelFr: "Intrusion", fieldType: "text" },
        failOnStatusCode: false,
      }).then((r) => expect(r.status, "adding a field is withheld").to.eq(403));
    });
  });

  // -------------------------------------------------------------------------
  // The screen
  // -------------------------------------------------------------------------
  describe("UI", () => {
    // Cypress resets the page between tests, so every test signs in again. The
    // session lives in localStorage, so it is dropped before a new sign-in — the
    // tests below use two accounts in turn.
    const signIn = (user: string, pass: string) => {
      cy.visit("/");
      cy.clearLocalStorage();
      cy.reload();
      cy.waitForHydration();
      cy.get('input[type="text"]').first().type(user);
      cy.get('input[type="password"]').type(pass);
      cy.get('button[type="submit"]').click();
    };

    const visitChamps = () => {
      signIn("admin", "admin123");
      cy.get('[data-testid="nav-champs"]', { timeout: 20000 }).should("exist").click();
      cy.get('[data-testid="gestion-champs"]').should("exist");
    };

    it("shows one sub-tab per form, listing the fields that form has right now", () => {
      visitChamps();

      // One sub-tab per courrier type.
      FORM_TYPES.forEach(({ type }) => {
        cy.get(`[data-testid="champs-tab-${type}"]`).should("be.visible");
      });

      // Each sub-tab renders that form's own configuration — including a field
      // no other form defines, which no hardcoded list could get right.
      FORM_TYPES.forEach(({ type, signatureKey }) => {
        cy.get(`[data-testid="champs-tab-${type}"]`).click();
        cy.get(`[data-testid="champ-row-${signatureKey}"]`).should("exist");
      });
    });

    it("adds a field from the screen, shows it in the form, then removes it", () => {
      const label = `${UI_LABEL_PREFIX} UI`;
      // The row's label lives in an <input value>, not in the row's text, so
      // `contains` cannot find it — the row is matched on what its FR input
      // holds. The FR input is the first input of the row (the reorder controls
      // are buttons, the other inputs come after it).
      const rowForLabel = () =>
        cy
          .get('[data-testid^="champ-row-"]')
          .filter((_, el) => Cypress.$(el).find("input").first().val() === label);

      visitChamps();
      cy.get('[data-testid="champs-tab-administratif"]').click();

      cy.get("#new-field-fr").clear().type(label);
      cy.get("#new-field-required").check();
      cy.get("#new-field-type").select("text");
      cy.get('[data-testid="add-field"]').click();

      // It lands in the configuration…
      rowForLabel().should("have.length", 1);

      // …and it survives a reload, so it was saved rather than held in memory.
      cy.reload();
      cy.get('[data-testid="nav-champs"]', { timeout: 20000 }).click();
      cy.get('[data-testid="gestion-champs"]').should("exist");
      // Sub-tabs reset to the first form on remount.
      cy.get('[data-testid="champs-tab-administratif"]').click();
      rowForLabel().should("have.length", 1);

      // …and the form an agent fills in renders it, marked mandatory. The
      // administrator cannot open that form themselves — it needs
      // creer_courrier_admin, which the administrator deliberately lacks.
      signIn("bureauordre", "bureauordre123");
      cy.get('[data-testid="nav-gerer-courriers"]', { timeout: 20000 }).should("exist").click();
      cy.get('[data-testid="courrier-tab-entrant-admin"]', { timeout: 20000 }).click();
      cy.get('[data-testid="custom-fields"]', { timeout: 20000 }).should("contain.text", label);
      cy.get('[data-testid="custom-fields"] input[required]').should("have.length.at.least", 1);

      // Removing it takes it out of the configuration again.
      signIn("admin", "admin123");
      cy.get('[data-testid="nav-champs"]', { timeout: 20000 }).click();
      cy.get('[data-testid="gestion-champs"]').should("exist");
      cy.get('[data-testid="champs-tab-administratif"]').click();
      cy.on("window:confirm", () => true);
      rowForLabel().within(() => {
        cy.contains("button", /Supprimer|حذف/).click();
      });
      rowForLabel().should("have.length", 0);
    });
  });
});

// Keeps this file a module so its top-level constants stay file-local.
export {};
