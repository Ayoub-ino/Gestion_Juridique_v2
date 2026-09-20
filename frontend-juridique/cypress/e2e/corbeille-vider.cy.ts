// Regression spec: "Vider la corbeille" (empty the trash in one action).
//
// Two things must hold:
//   1. The purge is scoped to the caller's own service — emptying your trash
//      must never reach another service's deleted folders.
//   2. The backend enforces the `supprimer` permission, not the UI.
//
// The corbeille lives in the "Mes dossiers" tab (it was moved out of Archive).
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

describe("Vider la corbeille", () => {
  const stamp = Date.now();
  let refCounter = 0;
  const nextReference = () => `VIDER-${stamp}-${++refCounter}`;

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

  /** Creates an admin courrier, then soft-deletes it so it lands in the trash. */
  const trashOne = (token: string) => {
    const reference = nextReference();
    return authed(token, "POST", `${API_URL}/api/CourrierAdmin`, {
      NumeroOrdre: reference,
      NumeroReference: reference,
      Expediteur: "Corbeille Test",
      Objet: `Corbeille test ${reference}`,
    }).then((res) => {
      expect(res.status).to.eq(201);
      const id = (res.body.courrier?.id ?? res.body.id) as number;
      return authed(token, "DELETE", `${API_URL}/api/CourrierAdmin/${id}`).then(
        () => ({ id, reference }),
      );
    });
  };

  const corbeilleRefs = (token: string) =>
    authed(token, "GET", `${API_URL}/api/Documents/corbeille`).then((r) => {
      expect(r.status).to.eq(200);
      return (r.body as Array<{ reference: string }>).map((d) => d.reference);
    });

  it("purges only the caller's own trash and leaves another service's intact", () => {
    const bureauTrash: string[] = [];
    let archivedRef = "";

    // A: created and trashed by bureauordre.
    login("bureauordre", "bureauordre123")
      .then((token) => trashOne(token))
      .then((created) => {
        bureauTrash.push(created.reference);
        // B: created by bureauordre, handed to `archive`, trashed by `archive`.
        return login("bureauordre", "bureauordre123").then((token) => {
          const reference = nextReference();
          archivedRef = reference;
          return authed(token, "POST", `${API_URL}/api/CourrierAdmin`, {
            NumeroOrdre: reference,
            NumeroReference: reference,
            Expediteur: "Corbeille Test",
            Objet: `Corbeille test ${reference}`,
          }).then((res) => {
            const id = (res.body.courrier?.id ?? res.body.id) as number;
            return authed(token, "POST", `${API_URL}/api/Transfer`, {
              documentId: id,
              documentType: "entrant-admin",
              serviceDestination: "archive",
              message: "corbeille scope check",
            }).then(() => id);
          });
        });
      })
      .then((handedOverId) => {
        // `archive` accepts custody, then throws it in its own trash.
        return login("archive", "archive123").then((token) =>
          authed(token, "GET", `${API_URL}/api/Transactions/all`).then((res) => {
            const pending = (
              res.body as Array<{ id: number; documentId: number; statut: string }>
            ).find((t) => t.documentId === handedOverId && t.statut === "EnAttente");
            expect(pending, "archive should see the pending transfer").to.exist;
            return authed(
              token,
              "PUT",
              `${API_URL}/api/Transactions/${pending!.id}/accepter`,
              { Commentaire: "ok" },
            ).then(() =>
              authed(token, "DELETE", `${API_URL}/api/CourrierAdmin/${handedOverId}`),
            );
          }),
        );
      })
      .then(() =>
        login("bureauordre", "bureauordre123").then((token) =>
          corbeilleRefs(token).then((refs) => {
            expect(refs).to.include(bureauTrash[0]);
            expect(refs, "bureauordre must not see archive's trash").to.not.include(
              archivedRef,
            );
            // Empty bureauordre's trash. The purge must remove exactly the rows
            // bureauordre could see — never a row owned by another service.
            return authed(token, "DELETE", `${API_URL}/api/Documents/corbeille`).then(
              (res) => {
                expect(res.status).to.eq(200);
                expect(res.body.count, "purges exactly what was visible").to.eq(
                  refs.length,
                );
                return corbeilleRefs(token);
              },
            );
          }),
        ),
      )
      .then((refs) => {
        expect(refs).to.not.include(bureauTrash[0]);
        // The archive service keeps its own trashed folder.
        return login("archive", "archive123").then((token) =>
          corbeilleRefs(token).then((archiveRefs) => {
            expect(archiveRefs, "archive's trash survived").to.include(archivedRef);
            // Cleanup.
            return authed(token, "DELETE", `${API_URL}/api/Documents/corbeille`);
          }),
        );
      })
      .then((res) => {
        expect(res.status).to.eq(200);
      });
  });

  it("returns 200 with count 0 for an already empty trash", () => {
    login("bureauordre", "bureauordre123")
      // Empty once so the trash is guaranteed empty, then empty it again.
      .then((token) => authed(token, "DELETE", `${API_URL}/api/Documents/corbeille`))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((token) =>
        authed(token, "DELETE", `${API_URL}/api/Documents/corbeille`).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.count).to.eq(0);
        }),
      );
  });

  it("is refused (403) for a service without the supprimer permission", () => {
    login("khibra", "khibra123").then((token) =>
      authed(token, "DELETE", `${API_URL}/api/Documents/corbeille`).then((res) => {
        expect(res.status, "RBAC is enforced on the backend").to.eq(403);
      }),
    );
  });

  it("exposes the action in the Mes dossiers corbeille tab", () => {
    login("bureauordre", "bureauordre123")
      .then((token) => trashOne(token))
      .then(() => {
        cy.visit("/");
        cy.waitForHydration();
        cy.get('input[type="text"]').first().type("bureauordre");
        cy.get('input[type="password"]').type("bureauordre123");
        cy.get('button[type="submit"]').click();

        // Sidebar → Mes dossiers → Corbeille
        cy.get('[data-testid="nav-mes-dossiers"]', { timeout: 20000 }).should("exist");
        cy.get('[data-testid="nav-mes-dossiers"]').click();
        cy.get('[data-testid="mes-dossiers-tab"]', { timeout: 10000 }).should("exist");
        cy.get('[data-testid="corbeille-tab"]').click();
        cy.get('[data-testid="empty-corbeille"]', { timeout: 10000 }).should("be.visible");

        // Emptying asks for confirmation (irreversible action).
        cy.get('[data-testid="empty-corbeille"]').click();
        cy.get('[data-testid="confirm-dialog"]').should("be.visible");
        cy.get('[data-testid="confirm-accept"]').click();

        // The trash is now empty, so the action disappears.
        cy.get('[data-testid="empty-corbeille"]').should("not.exist");
      });
  });
});

// Makes this file a module so its top-level `const API_URL` stays file-local
// (the sibling specs share one global scope otherwise).
export {};
