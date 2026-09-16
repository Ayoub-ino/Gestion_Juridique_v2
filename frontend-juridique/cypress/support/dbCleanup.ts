/* eslint-disable @typescript-eslint/no-namespace */
// ***************************************************************
// Database cleanup for the E2E suite
// ***************************************************************
//
// The specs create real folders through the API. Without a purge they pile up in
// the developer's database on every run, so a global `after` hook (see ./e2e.ts)
// removes them once the spec has finished.
//
// Test fixtures are recognised by their reference (N° d'ordre / N° de référence)
// prefix — every fixture the suite creates is named with one of these, so the
// purge never touches hand-made data.

/** Reference prefixes used by the specs to mark their fixtures. */
const TEST_REFERENCE_PREFIXES = [
  "TEST-",
  "DYN-",
  "REP-",
  "DBG-",
  "E2E-",
  "SHOULD-FAIL",
  "OWNERSHIP-TEST-",
  "REFUS-TEST-",
  "MULTI-USER-TEST-",
  "SINGLE-USER-TEST-",
  "CUSTODY-TEST-",
  "TRANSFER-CUSTODY-",
  "DELETE-CUSTODY-",
];

/** Lists that expose a reference for every document type (admin sees them all). */
const DOCUMENT_LISTS = [
  "/api/CourrierAdmin",
  "/api/CourrierJuridique",
  "/api/CourrierSortant",
];

/** The trash is a separate collection and also needs emptying. */
const TRASH_LIST = "/api/Documents/corbeille";

const isTestReference = (value: unknown): boolean =>
  typeof value === "string" && TEST_REFERENCE_PREFIXES.some((prefix) => value.startsWith(prefix));

interface RawDocument {
  id: number;
  numeroOrdre?: string;
  numeroReference?: string;
  reference?: string;
}

export function registerDatabaseCleanupCommands(): void {
  /**
   * Deletes every document created by the specs, together with its transactions,
   * access rows and physical file. Safe to call at any time: it is a no-op when
   * the backend is unreachable or nothing matches.
   */
  Cypress.Commands.add("purgeTestDocuments", () => {
    const apiUrl = Cypress.env("API_URL") || "http://localhost:5200";
    const ids: number[] = [];

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
            const reference = doc.numeroOrdre ?? doc.numeroReference ?? doc.reference;
            if (isTestReference(reference)) ids.push(doc.id);
          }
        });

    // Reading every document (and the trash) needs the admin account; deleting
    // needs `supprimer`, which the admin intentionally does not have — so the
    // purge lists as admin and deletes as the bureau d'ordre account.
    cy.wrap(null)
      .then((): Cypress.Chainable<string> => login("admin", "admin123"))
      .then((adminToken): Cypress.Chainable => {
        if (!adminToken) return cy.wrap(null);
        const paths = [...DOCUMENT_LISTS, TRASH_LIST];
        return paths.reduce(
          (chain: Cypress.Chainable, path) => chain.then(() => collect(path, adminToken)),
          cy.wrap(null) as Cypress.Chainable,
        );
      })
      .then((): Cypress.Chainable<string> => login("bureauordre", "bureauordre123"))
      .then((deleterToken): Cypress.Chainable => {
        if (!deleterToken || ids.length === 0) return cy.wrap(null);
        const headers = { Authorization: `Bearer ${deleterToken}` };
        // Soft delete first: the batch hard delete only removes trashed rows.
        return cy
          .request({
            method: "POST",
            url: `${apiUrl}/api/Documents/supprimer-batch`,
            headers,
            body: ids,
            failOnStatusCode: false,
          })
          .then(() =>
            cy.request({
              method: "POST",
              url: `${apiUrl}/api/Documents/permanent-delete-batch`,
              headers,
              body: ids,
              failOnStatusCode: false,
            }),
          );
      })
      .then(() => undefined);
  });
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Removes every document the specs created (matched by reference prefix),
       * including their trashed entries. Never fails the run.
       */
      purgeTestDocuments(): Chainable<void>;
    }
  }
}
