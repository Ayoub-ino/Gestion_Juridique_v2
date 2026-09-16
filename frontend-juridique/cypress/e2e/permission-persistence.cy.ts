// Regression spec: permission changes made in "Gestion des Permissions" must be
// written to the database and still be in place after a full page reload.
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";
const SERVICE_NAME = "Archive";
const PERMISSION_KEY = "transferer";

describe("Permission persistence", () => {
  let adminToken = "";
  let serviceId = 0;
  let originalEnabled = false;

  const authed = (
    method: Cypress.HttpMethod,
    url: string,
    body?: Record<string, unknown>,
  ) =>
    cy.request({
      method,
      url,
      headers: { Authorization: `Bearer ${adminToken}` },
      body,
      failOnStatusCode: false,
    });

  const readPermission = () =>
    authed("GET", `${API_URL}/api/rbac/permissions/service/${serviceId}`).then((res) => {
      expect(res.status).to.eq(200);
      const row = (res.body.permissions as { key: string; enabled: boolean }[]).find(
        (p) => p.key === PERMISSION_KEY,
      );
      expect(row, `permission ${PERMISSION_KEY} must exist`).to.exist;
      return row!.enabled as boolean;
    });

  const writePermission = (enabled: boolean) =>
    authed("GET", `${API_URL}/api/rbac/permissions/service/${serviceId}`)
      .then((res) => {
        const payload = res.body.permissions.map((p: { key: string; enabled: boolean }) => ({
          permissionKey: p.key,
          enabled: p.key === PERMISSION_KEY ? enabled : p.enabled,
        }));
        return authed("PUT", `${API_URL}/api/rbac/permissions/service/${serviceId}`, {
          permissions: payload,
        });
      })
      .then((res) => expect(res.status).to.eq(200));

  const openPermissionsPanel = () => {
    cy.get("aside", { timeout: 20000 }).should("exist");
    cy.get("aside").within(() => {
      // Force French so the assertions below are deterministic
      cy.contains("button", "FR").click();
      cy.contains(/Permissions|الصلاحيات/).click();
    });
    cy.contains(/Gestion des Permissions|إدارة الصلاحيات/, { timeout: 20000 }).should("exist");
  };

  const openServiceEditor = (name: string) => {
    // Matrix column headers render "<service name>\n<enabled>/<total>" — match the
    // whole label so the sidebar's "Archives juridiques" button is never hit.
    cy.get("button", { timeout: 20000 })
      .filter((_, el) => new RegExp(`^${name}\\s+\\d+\\/\\d+$`).test((el.innerText || "").trim()))
      .first()
      .click();
    cy.contains(/Cochez les permissions à accorder|حدد الصلاحيات الممنوحة/, {
      timeout: 20000,
    }).should("exist");
  };

  before(() => {
    cy.request({
      method: "POST",
      url: `${API_URL}/api/auth/login`,
      body: { Login: "admin", Password: "admin123" },
    }).then((r) => {
      adminToken = r.body.token;
      return authed("GET", `${API_URL}/api/rbac/services`);
    }).then((res) => {
      const svc = (res.body as { id: number; nom: string }[]).find((s) => s.nom === SERVICE_NAME);
      expect(svc, `service ${SERVICE_NAME} must exist`).to.exist;
      serviceId = svc!.id;
      return readPermission();
    }).then((enabled) => {
      originalEnabled = enabled;
    });
  });

  after(() => {
    if (serviceId) {
      writePermission(originalEnabled);
    }
  });

  it("keeps a service permission change after reloading the page", () => {
    const target = !originalEnabled;

    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type("admin");
    cy.get('input[type="password"]').type("admin123");
    cy.get('button[type="submit"]').click();

    openPermissionsPanel();
    openServiceEditor(SERVICE_NAME);

    // Toggle the permission under test, then save
    cy.get(`#perm-${PERMISSION_KEY}`, { timeout: 20000 }).should(
      "have.prop",
      "checked",
      originalEnabled,
    );
    cy.get(`#perm-${PERMISSION_KEY}`).click();
    cy.get(`#perm-${PERMISSION_KEY}`).should("have.prop", "checked", target);
    cy.contains("button", /Sauvegarder|حفظ/).click();

    // The save must have reached the database
    cy.wrap(null)
      .then(() => readPermission() as unknown as Cypress.Chainable<boolean>)
      .should("eq", target);

    // …and must survive a full reload
    cy.reload();
    cy.waitForHydration();
    openPermissionsPanel();
    openServiceEditor(SERVICE_NAME);
    cy.get(`#perm-${PERMISSION_KEY}`, { timeout: 20000 }).should("have.prop", "checked", target);
  });
});

// Keep this spec a module: without an import/export statement its top-level
// constants would live in the global scope and collide with the other specs'.
export {};
