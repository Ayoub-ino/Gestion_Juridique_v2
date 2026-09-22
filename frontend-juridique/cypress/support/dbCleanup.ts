/* eslint-disable @typescript-eslint/no-namespace */
// ***************************************************************
// Database cleanup for the E2E suite
// ***************************************************************
//
// The specs create real folders, services and users through the API. Without a
// purge they pile up in the developer's database on every run, so a global
// `after` hook (see ./e2e.ts) removes them once the spec has finished.
//
// Fixtures are recognised by their reference / code / login prefix — every
// fixture the suite creates is named with one of these, so the purge never
// touches hand-made data. It is a no-op when the backend is unreachable.

/** Reference prefixes used by the specs to mark their document fixtures. */
const TEST_REFERENCE_PREFIXES = [
  "TEST-",
  "DYN-",
  "REP-",
  "DBG-",
  "E2E-",
  "EXPORT-",
  "SHOULD-FAIL",
  "OWNERSHIP-TEST-",
  "REFUS-TEST-",
  "MULTI-USER-TEST-",
  "SINGLE-USER-TEST-",
  "CUSTODY-TEST-",
  "TRANSFER-CUSTODY-",
  "DELETE-CUSTODY-",
];

/** Service codes (and the logins of the users they own) created by the specs. */
const TEST_SERVICE_CODE_PREFIXES = [
  "e2edyn",
  "e2edlg",
  "test-archive-",
  "test-perm-delete-",
  "test-filter-",
  "e2e-archive-",
];

/** Lists that expose a reference for every document type (admin sees them all). */
const DOCUMENT_LISTS = [
  "/api/CourrierAdmin",
  "/api/CourrierJuridique",
  "/api/CourrierSortant",
];

/** The trash is a separate collection and also needs emptying. */
const TRASH_LIST = "/api/Documents/corbeille";

const SERVICES_LIST = "/api/rbac/services?includeInactive=true";
const USERS_LIST = "/api/Users?includeInactive=true";

// Compared case-insensitively: document references are upper-case ("DYN-…")
// while service codes are lower-case ("e2edyn…"), and both sides must agree.
const matchesPrefix = (prefixes: string[], value: unknown): boolean =>
  typeof value === "string" &&
  prefixes.some((prefix) => value.toLowerCase().startsWith(prefix.toLowerCase()));

interface RawDocument {
  id: number;
  numeroOrdre?: string;
  numeroReference?: string;
  reference?: string;
}

interface RawService {
  id: number;
  code?: string;
  nom?: string;
}

interface RawUser {
  id: number;
  login?: string;
  username?: string;
}

export function registerDatabaseCleanupCommands(): void {
  /**
   * Deletes every document, service and user the specs created, including
   * their transactions, access rows and physical files. Safe to call at any
   * time: it is a no-op when the backend is unreachable or nothing matches.
   */
  Cypress.Commands.add("purgeTestFixtures", () => {
    const apiUrl = Cypress.env("API_URL") || "http://localhost:5200";

    const documentIds: number[] = [];
    const serviceIds: number[] = [];
    const userIds: number[] = [];

    const login = (loginName: string, password: string): Cypress.Chainable<string> =>
      cy
        .request({
          method: "POST",
          url: `${apiUrl}/api/auth/login`,
          body: { Login: loginName, Password: password },
          failOnStatusCode: false,
        })
        .then((response) => (response.body?.token as string) ?? "");

    const collect = (path: string, token: string): Cypress.Chainable =>
      cy
        .request({
          method: "GET",
          url: `${apiUrl}${path}`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        })
        .then((response) => {
          if (!Array.isArray(response.body)) return;

          for (const doc of response.body as RawDocument[]) {
            // Inspect every candidate field instead of the first truthy one:
            // `numeroOrdre` holds the system-assigned bureau id (e.g. "2/2026")
            // while the unique fixture reference lives in `numeroReference`, so
            // short-circuiting here would silently skip every fixture.
            const references = [doc.numeroReference, doc.reference, doc.numeroOrdre];
            if (references.some((r) => matchesPrefix(TEST_REFERENCE_PREFIXES, r)) && !documentIds.includes(doc.id)) {
              documentIds.push(doc.id);
            }
          }
        });

    const collectFixtures = (
      path: string,
      token: string,
      pick: (item: never) => unknown,
      into: number[],
    ): Cypress.Chainable =>
      cy
        .request({
          method: "GET",
          url: `${apiUrl}${path}`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        })
        .then((response) => {
          if (!Array.isArray(response.body)) return;
          for (const item of response.body) {
            const id = (item as { id: number }).id;
            if (matchesPrefix(TEST_SERVICE_CODE_PREFIXES, pick(item as never)) && !into.includes(id)) {
              into.push(id);
            }
          }
        });

    /**
     * Archived then permanently removed, in that order, because the permanent
     * endpoints assume an archived row. Failures are tolerated: a row that is
     * already gone must not fail the cleanup.
     */
    const purgeEach = (
      token: string,
      basePath: string,
      ids: number[],
    ): Cypress.Chainable => {
      const headers = { Authorization: `Bearer ${token}` };
      return ids.reduce(
        (chain: Cypress.Chainable, id) =>
          chain
            .then(() =>
              cy.request({
                method: "DELETE",
                url: `${apiUrl}${basePath}/${id}`,
                headers,
                failOnStatusCode: false,
              }),
            )
            .then(() =>
              cy.request({
                method: "DELETE",
                url: `${apiUrl}${basePath}/${id}/permanent`,
                headers,
                failOnStatusCode: false,
              }),
            ),
        cy.wrap(null) as Cypress.Chainable,
      );
    };

    // Documents need `supprimer`, which the admin intentionally does not have —
    // so they are listed as admin and deleted as the bureau d'ordre account.
    // Services and users belong to the admin's own panel, so the admin token
    // handles those.
    let adminToken = "";
    let deleterToken = "";

    cy.wrap(null)
      .then((): Cypress.Chainable<string> => login("admin", "admin123"))
      .then((token): Cypress.Chainable => {
        adminToken = token;
        if (!adminToken) return cy.wrap(null);
        const paths = [...DOCUMENT_LISTS, TRASH_LIST];
        return paths.reduce(
          (chain: Cypress.Chainable, path) => chain.then(() => collect(path, adminToken)),
          cy.wrap(null) as Cypress.Chainable,
        );
      })
      .then(() =>
        collectFixtures(SERVICES_LIST, adminToken, (s: RawService) => s.code, serviceIds),
      )
      .then(() =>
        collectFixtures(USERS_LIST, adminToken, (u: RawUser) => u.login ?? u.username, userIds),
      )
      .then((): Cypress.Chainable<string> => login("bureauordre", "bureauordre123"))
      .then((token): Cypress.Chainable => {
        deleterToken = token;
        if (!deleterToken || documentIds.length === 0) return cy.wrap(null);
        const headers = { Authorization: `Bearer ${deleterToken}` };
        // Soft delete first: the batch hard delete only removes trashed rows.
        return cy
          .request({
            method: "POST",
            url: `${apiUrl}/api/Documents/supprimer-batch`,
            headers,
            body: documentIds,
            failOnStatusCode: false,
          })
          .then(() =>
            cy.request({
              method: "POST",
              url: `${apiUrl}/api/Documents/permanent-delete-batch`,
              headers,
              body: documentIds,
              failOnStatusCode: false,
            }),
          );
      })
      // Users go before services: a service cannot be permanently deleted while
      // any user still references it.
      .then(() => purgeEach(adminToken, "/api/Users", userIds))
      .then(() => purgeEach(adminToken, "/api/rbac/services", serviceIds))
      .then(() => undefined);
  });
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Removes every document, service and user the specs created (matched by
       * reference / code / login prefix). Never fails the run.
       */
      purgeTestFixtures(): Chainable<void>;
    }
  }
}
