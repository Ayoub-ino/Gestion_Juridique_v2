// Regression spec: the juridique form's destination picker.
//
// The old "Circuit du dossier" / "Nature du circuit initial" blocks were replaced
// by a destination SERVICE read live from the catalog, plus a recipients group
// that appears once a service is chosen. This spec pins three things:
//   1. The list is dynamic — a service created at runtime is selectable.
//   2. The recipients group is scoped to the chosen service.
//   3. The choice actually reaches the backend: choosing a user targets only that
//      user, choosing nobody sends to the whole service.
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

describe("Juridique destination picker", () => {
  const stamp = Date.now();
  const serviceCode = `e2edyn${stamp}`;
  const serviceName = `E2E Destination ${stamp}`;
  const loginOne = `${serviceCode}u1`;
  const loginTwo = `${serviceCode}u2`;
  const password = "E2eDest@12345";

  let adminToken = "";
  let serviceId = 0;

  /** Documents created through the UI, removed in `after`. */
  const createdReferences: string[] = [];

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

  /** Signs in through the real UI and opens Gérer les courriers → Juridique. */
  const openJuridiqueForm = () => {
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type("bureauordre");
    cy.get('input[type="password"]').type("bureauordre123");
    cy.get('button[type="submit"]').click();

    cy.get('[data-testid="nav-gerer-courriers"]', { timeout: 20000 }).click();
    cy.get('[data-testid="courrier-tab-entrant-juridique"]', { timeout: 20000 }).click();
    cy.get('[data-testid="jur-service-destination"]', { timeout: 20000 }).should("exist");
  };

  /** Fills the mandatory juridique fields and returns the reference used. */
  const fillMandatoryFields = (suffix: string) => {
    const reference = `DYN-DEST-${stamp}-${suffix}`;
    createdReferences.push(reference);

    cy.get("#jur-objet").clear().type(`Destination check ${suffix}`);
    cy.get("#jur-tribunal option").then(($options) => {
      const value = $options.eq(1).val() as string;
      cy.get("#jur-tribunal").select(value);
    });
    cy.get("#jur-date").type("2026-09-20");
    cy.get("#jur-num-dossier").clear().type(reference);
    cy.get("#jur-num-appel").clear().type(`APP-${stamp}-${suffix}`);
    return reference;
  };

  /** Pending requests of a user, reduced to the document ids they cover. */
  const pendingDocIds = (token: string) =>
    authed(token, "GET", `${API_URL}/api/Transactions/pending`).then((r) => {
      expect(r.status).to.eq(200);
      return (r.body as Array<{ documentId: number }>).map((p) => p.documentId);
    });

  /** The id of a juridical folder the given token can see, by reference. */
  const documentIdOf = (token: string, reference: string) =>
    authed(token, "GET", `${API_URL}/api/CourrierJuridique`).then((r) => {
      expect(r.status).to.eq(200);
      const row = (r.body as Array<{ id: number; numeroReference: string }>).find(
        (d) => d.numeroReference === reference,
      );
      expect(row, `folder ${reference} should be visible to its creator`).to.exist;
      return row!.id;
    });

  before(() => {
    login("admin", "admin123")
      .then((token) => {
        adminToken = token;
        return authed(token, "POST", `${API_URL}/api/rbac/services`, {
          nom: serviceName,
          code: serviceCode,
          description: "Temporary service created by the destination-picker spec",
        });
      })
      .then((res) => {
        expect(res.status).to.eq(200);
        serviceId = res.body.id;
        return authed(adminToken, "POST", `${API_URL}/api/Users`, {
          Login: loginOne,
          Password: password,
          Nom: `Destination One ${stamp}`,
          Role: "User",
          Service: serviceCode,
          ServiceId: serviceId,
        });
      })
      .then((res) => {
        expect(res.status).to.eq(200);
        return authed(adminToken, "POST", `${API_URL}/api/Users`, {
          Login: loginTwo,
          Password: password,
          Nom: `Destination Two ${stamp}`,
          Role: "User",
          Service: serviceCode,
          ServiceId: serviceId,
        });
      })
      .then((res) => {
        expect(res.status).to.eq(200);
      });
  });

  after(() => {
    // Documents first (they belong to bureauordre until accepted), then users,
    // then the service — a service cannot go while a user still references it.
    login("bureauordre", "bureauordre123")
      .then((token) =>
        authed(token, "GET", `${API_URL}/api/CourrierJuridique`).then((r) => {
          const ids = (r.body as Array<{ id: number; numeroReference: string }>)
            .filter((d) => createdReferences.includes(d.numeroReference))
            .map((d) => d.id);
          if (ids.length === 0) return cy.wrap(null);
          return authed(token, "POST", `${API_URL}/api/Documents/supprimer-batch`, ids).then(
            () =>
              authed(token, "POST", `${API_URL}/api/Documents/permanent-delete-batch`, ids),
          );
        }),
      )
      .then(() => authed(adminToken, "GET", `${API_URL}/api/Users?includeInactive=true`))
      .then((res) => {
        const ids = (res.body as Array<{ id: number; login?: string }>)
          .filter((u) => [loginOne, loginTwo].includes(u.login ?? ""))
          .map((u) => u.id);
        return ids.reduce(
          (chain, id) =>
            chain
              .then(() => authed(adminToken, "DELETE", `${API_URL}/api/Users/${id}`))
              .then(() => authed(adminToken, "DELETE", `${API_URL}/api/Users/${id}/permanent`)),
          cy.wrap(null) as Cypress.Chainable,
        );
      })
      .then(() => authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${serviceId}`))
      .then(() => {
        if (serviceId) {
          return authed(
            adminToken,
            "DELETE",
            `${API_URL}/api/rbac/services/${serviceId}/permanent`,
          );
        }
        return cy.wrap(null);
      });
  });

  it("lists services dynamically and reveals that service's users once chosen", () => {
    openJuridiqueForm();

    // The circuit pickers are gone for good.
    cy.get('input[name="circuitJuridique"]').should("not.exist");
    cy.get('input[name="typeException"]').should("not.exist");

    // The destination list is read live: a service that did not exist before this
    // run is already selectable.
    cy.get('[data-testid="jur-service-destination"] option')
      .contains(serviceName)
      .should("exist");

    // No service chosen yet → no recipients group.
    cy.get('[data-testid="jur-recipients-group"]').should("not.exist");

    cy.get('[data-testid="jur-service-destination"]').select(serviceCode);

    // The group appears and is scoped to that service only.
    cy.get('[data-testid="jur-recipients-group"]').should("be.visible");
    cy.get('[data-testid="jur-recipients-group"]').contains(`Destination One ${stamp}`);
    cy.get('[data-testid="jur-recipients-group"]').contains(`Destination Two ${stamp}`);

    // Switching service clears the previously chosen recipients.
    cy.get('[data-testid="jur-recipients-group"] [data-testid="jur-recipient-user"]')
      .first()
      .check();
    cy.get('[data-testid="jur-service-destination"]').select("");
    cy.get('[data-testid="jur-recipients-group"]').should("not.exist");
  });

  it("sends to a single chosen user only", () => {
    openJuridiqueForm();

    const reference = fillMandatoryFields("one");
    cy.get('[data-testid="jur-service-destination"]').select(serviceCode);
    cy.get('[data-testid="jur-recipients-group"] [data-testid="jur-recipient-user"]')
      .first()
      .check();
    cy.get('[data-testid="submit-courrier"]').click();

    cy.then(() => login("bureauordre", "bureauordre123"))
      .then((token) => documentIdOf(token, reference))
      .then((documentId) =>
        login(loginOne, password)
          .then((token) => pendingDocIds(token))
          .then((ids) => {
            expect(ids, "the chosen user received the request").to.include(documentId);
            return login(loginTwo, password);
          })
          .then((token) => pendingDocIds(token))
          .then((ids) => {
            expect(
              ids,
              "the user who was NOT chosen must not be asked to accept it",
            ).to.not.include(documentId);
          }),
      );
  });

  it("sends to the whole service when no user is chosen", () => {
    openJuridiqueForm();

    const reference = fillMandatoryFields("whole");
    cy.get('[data-testid="jur-service-destination"]').select(serviceCode);
    // Leave "Tout le service" selected and submit.
    cy.get('[data-testid="submit-courrier"]').click();

    cy.then(() => login("bureauordre", "bureauordre123"))
      .then((token) => documentIdOf(token, reference))
      .then((documentId) =>
        login(loginOne, password)
          .then((token) => pendingDocIds(token))
          .then((ids) => {
            expect(ids, "the first member of the service sees it").to.include(documentId);
            return login(loginTwo, password);
          })
          .then((token) => pendingDocIds(token))
          .then((ids) => {
            expect(ids, "so does the second member").to.include(documentId);
          }),
      );
  });
});

// Keeps this file a module so its top-level `const` declarations stay file-local.
export {};
