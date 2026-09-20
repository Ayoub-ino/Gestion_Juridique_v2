// Regression spec: the dashboard workflow pipeline is the live service catalog.
//
// The pipeline used to be a hardcoded six-step list, so a service created from
// the admin panel could never appear in it. It is now built from
// `/api/rbac/services`, which means:
//   1. creating a service adds a stage,
//   2. renaming it relabels that stage,
//   3. archiving it removes the stage again.
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

describe("Workflow pipeline follows the live catalog", () => {
  const stamp = Date.now();
  const serviceCode = `e2edyn${stamp}`;
  const serviceName = `E2E Pipeline ${stamp}`;
  const renamedService = `E2E Pipeline ${stamp} (renamed)`;

  let adminToken = "";
  let serviceId = 0;
  /** Extra services used by the hierarchy test, removed in `after`. */
  const extraServiceIds: number[] = [];

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

  /** Opens the dashboard as a normal user (the pipeline lives there). */
  const openDashboard = () => {
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type("bureauordre");
    cy.get('input[type="password"]').type("bureauordre123");
    cy.get('button[type="submit"]').click();
    cy.get('[data-testid="workflow-steps"]', { timeout: 20000 }).should("exist");
  };

  /**
   * The stage names in pipeline order. Read from the label element rather than the
   * whole step button, whose text also carries the stage number and the count of
   * folders sitting there.
   */
  const stepLabels = () =>
    cy.get('[data-testid="workflow-step-label"]').then(($labels) =>
      $labels.toArray().map((el) => (el.textContent ?? "").trim()),
    );

  before(() => {
    login("admin", "admin123").then((token) => {
      adminToken = token;
      return authed(token, "POST", `${API_URL}/api/rbac/services`, {
        nom: serviceName,
        code: serviceCode,
        description: "Temporary service created by the workflow-pipeline spec",
      });
    }).then((res) => {
      expect(res.status).to.eq(200);
      serviceId = res.body.id;
    });
  });

  after(() => {
    // The `it` blocks archive the service; this makes sure of it on failure too,
    // then removes the row for good (archive, then permanent delete).
    [...extraServiceIds, serviceId].reduce(
      (chain: Cypress.Chainable, id) =>
        chain
          .then(() => authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${id}`))
          .then(() =>
            authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${id}/permanent`),
          ),
      cy.wrap(null) as Cypress.Chainable,
    );
  });

  it("shows a service created at runtime as a pipeline stage", () => {
    openDashboard();

    // The pipeline renders real stages, not a fixed six-step list.
    cy.get('[data-testid="workflow-step"]').should("have.length.greaterThan", 0);
    stepLabels().should((labels) => {
      expect(labels.join(" | "), "a service created at runtime must be a stage").to.include(
        serviceName,
      );
    });
  });

  it("relabels the stage when the service is renamed", () => {
    cy.then(() =>
      authed(adminToken, "PUT", `${API_URL}/api/rbac/services/${serviceId}`, {
        nom: renamedService,
        code: serviceCode,
      }),
    )
      .then((res) => expect(res.status).to.eq(200))
      .then(() => {
        openDashboard();
        stepLabels().should((labels) => {
          const joined = labels.join(" | ");
          expect(joined, "the renamed label must be shown").to.include(renamedService);
        });
      });
  });

  it("keeps a sub-service next to its parent stage", () => {
    const parentName = `E2E Parent ${stamp}`;
    const childName = `E2E Child ${stamp}`;

    cy.then(() =>
      authed(adminToken, "POST", `${API_URL}/api/rbac/services`, {
        nom: parentName,
        code: `${serviceCode}p`,
        description: "Temporary parent service",
      }),
    )
      .then((res) => {
        expect(res.status).to.eq(200);
        extraServiceIds.push(res.body.id);
        return authed(adminToken, "POST", `${API_URL}/api/rbac/services`, {
          nom: childName,
          code: `${serviceCode}c`,
          description: "Temporary sub-service",
          parentId: res.body.id,
        });
      })
      .then((res) => {
        expect(res.status).to.eq(200);
        extraServiceIds.push(res.body.id);
      })
      .then(() => {
        openDashboard();
        stepLabels().should((labels) => {
          const parentAt = labels.indexOf(parentName);
          const childAt = labels.indexOf(childName);
          expect(parentAt, "the parent must be a stage").to.be.greaterThan(-1);
          expect(childAt, "its sub-service must be a stage").to.be.greaterThan(-1);
          expect(childAt, "a sub-service sits right after its parent").to.eq(parentAt + 1);
        });
      });
  });

  it("drops the stage again once the service is archived", () => {
    cy.then(() =>
      authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${serviceId}`),
    )
      .then((res) => expect(res.status).to.eq(200))
      .then(() => {
        openDashboard();
        stepLabels().should((labels) => {
          const joined = labels.join(" | ");
          expect(joined, "an archived service must leave the pipeline").to.not.include(
            renamedService,
          );
          // The seeded services are still there, so the pipeline is not empty.
          expect(labels.length).to.be.greaterThan(0);
        });
      });
  });
});

// Keeps this file a module so its top-level `const` declarations stay file-local.
export {};
