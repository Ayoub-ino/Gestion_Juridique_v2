// Regression spec: absence delegations ("Mon profil") and exceptional
// withdrawals from the archive.
//
// The delegation used to be write-only: the row was stored but nothing read it,
// so a designated substitute could not reach the absent agent's folders, and
// saving one required an admin-only permission a plain agent never had. A
// withdrawal, meanwhile, could be filed with no requesting authority and with
// an "effectué par" value typed by the client.
//
// The spec creates its own service and users, named with the `e2edlg` prefix so
// the global fixture purge in support/dbCleanup.ts reclaims them (and, through
// the permanent-delete endpoint, the delegation rows they left behind). The
// withdrawal half uses the seeded `archive` agent, the only service seeded with
// retrait_archive.
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

describe("Absence delegation and archive withdrawal", () => {
  const stamp = Date.now();
  const serviceACode = `e2edlga${stamp}`; // holds the folder = the absent agent
  const serviceBCode = `e2edlgb${stamp}`; // the substitute's service
  const loginAbsent = `${serviceACode}u1`;
  const loginColleague = `${serviceACode}u2`;
  const loginSubstitute = `${serviceBCode}u1`;
  const password = "E2eDelg@12345";
  // The `E2E-` prefix lets the fixture purge recognise the folders too.
  const reference = `E2E-DLG-${stamp}`;
  const colleagueReference = `E2E-DLG-COL-${stamp}`;

  let adminToken = "";
  // Held across the chain: threading a token through `.then` is fragile, because
  // an inner `.then` that returns nothing passes `undefined` to the next step.
  let absentToken = "";
  let colleagueToken = "";
  let subToken = "";

  // Permissions resolve through the user's ServiceId, so it has to be carried
  // over from the service creation response.
  let serviceAId = 0;
  let serviceBId = 0;

  let absentId = 0;
  let colleagueId = 0;
  let substituteId = 0;
  let documentId = 0;
  let colleagueDocumentId = 0;
  let delegationId = 0;
  let retraitId = 0;

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
      headers: { Authorization: `Bearer ${token}` },
      url,
      body: body as Record<string, unknown> | undefined,
      failOnStatusCode: false,
    });

  /** Folders currently visible to the token (service-scoped on the backend). */
  const visibleRefs = (token: string) =>
    authed(token, "GET", `${API_URL}/api/CourrierAdmin`).then((r) => {
      expect(r.status).to.eq(200);
      return (r.body as Array<{ numeroReference: string }>).map((d) => d.numeroReference);
    });

  before(() => {
    login("admin", "admin123")
      .then((token) => {
        adminToken = token;
        return authed(token, "POST", `${API_URL}/api/rbac/services`, {
          nom: `E2E Delegation A ${stamp}`,
          code: serviceACode,
        });
      })
      .then((serviceA) => {
        expect(serviceA.status).to.eq(200);
        serviceAId = serviceA.body.id as number;
        // A new service is created with a default permission set; the folder has
        // to be created by the absent agent, which needs creer_courrier_admin.
        const permissions = [
          "creer_modifier",
          "creer_courrier_admin",
          "supprimer",
          "consulter",
          "accepter",
          "refuser",
          "annuler_transfert",
          "dashboard",
          "mes_entites",
          "transactions",
          "voir_historique",
          "voir_workspace",
          "telecharger_fichiers",
          "ajouter_notes",
          "profil",
        ];
        return authed(
          adminToken,
          "PUT",
          `${API_URL}/api/rbac/permissions/service/${serviceAId}`,
          { permissions: permissions.map((k) => ({ permissionKey: k, enabled: true })) },
        );
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        return login("admin", "admin123");
      })
      .then((token) =>
        authed(token, "POST", `${API_URL}/api/rbac/services`, {
          nom: `E2E Delegation B ${stamp}`,
          code: serviceBCode,
        }),
      )
      .then((serviceB) => {
        expect(serviceB.status).to.eq(200);
        serviceBId = serviceB.body.id as number;
        // The substitute needs creer_modifier + a service that holds neither the
        // folder nor any access to it.
        return login("admin", "admin123").then((token) =>
          authed(token, "POST", `${API_URL}/api/Users`, {
            Login: loginAbsent,
            Password: password,
            Nom: `Agent Absent ${stamp}`,
            Role: "User",
            Service: serviceACode,
            ServiceId: serviceAId,
          }).then((created) => {
            absentId = created.body.id as number;
            // A second agent in the SAME service as the absent one: their folders
            // must stay out of the substitute's reach.
            return authed(token, "POST", `${API_URL}/api/Users`, {
              Login: loginColleague,
              Password: password,
              Nom: `Collegue ${stamp}`,
              Role: "User",
              Service: serviceACode,
              ServiceId: serviceAId,
            });
          }),
        );
      })
      .then((created) => {
        expect(created.status).to.eq(200);
        colleagueId = created.body.id as number;
        return login("admin", "admin123").then((token) =>
          authed(token, "POST", `${API_URL}/api/Users`, {
            Login: loginSubstitute,
            Password: password,
            Nom: `Remplacant ${stamp}`,
            Role: "User",
            Service: serviceBCode,
            ServiceId: serviceBId,
          }),
        );
      })
      .then((created) => {
        expect(created.status).to.eq(200);
        substituteId = created.body.id as number;
        return login(loginAbsent, password);
      })
      .then((token) => {
        absentToken = token;
        return login(loginColleague, password);
      })
      .then((token) => {
        colleagueToken = token;
        return login(loginSubstitute, password);
      })
      .then((token) => {
        subToken = token;
        expect(absentId, "absent agent created").to.be.greaterThan(0);
        expect(colleagueId, "colleague created").to.be.greaterThan(0);
        expect(substituteId, "substitute created").to.be.greaterThan(0);
      });
  });

  it("lets an agent manage their own substitute and refuses to do it for someone else", () => {
    // A plain agent has no gerer_substituts permission: designating a substitute
    // for someone else must be refused...
    authed(subToken, "POST", `${API_URL}/api/Substitutes`, {
      userId: absentId,
      substituteUserId: substituteId,
    })
      .then((r) => {
        expect(r.status, "cannot act for another agent").to.eq(403);
        // ...but managing their OWN absence is self-service.
        return authed(absentToken, "POST", `${API_URL}/api/Substitutes`, {
          userId: absentId,
          substituteUserId: substituteId,
        });
      })
      .then((r) => {
        expect(r.status, "own substitute is allowed").to.eq(200);
        return authed(absentToken, "GET", `${API_URL}/api/Substitutes/history/${absentId}`);
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        const active = (r.body as Array<{ id: number; isActive: boolean }>).filter(
          (s) => s.isActive,
        );
        expect(active.length, "exactly one active delegation").to.eq(1);
        delegationId = active[0].id;
      });
  });

  it("gives the substitute the absent agent's scope and traces what they do", () => {
    // Start from a clean delegation state so this test does not depend on the
    // order the previous one left it in.
    authed(absentToken, "GET", `${API_URL}/api/Substitutes/history/${absentId}`)
      .then((r) => {
        const activeIds = (r.body as Array<{ id: number; isActive: boolean }>)
          .filter((s) => s.isActive)
          .map((s) => s.id);

        return activeIds.reduce(
          (chain: Cypress.Chainable, id: number) =>
            chain.then(() =>
              authed(absentToken, "DELETE", `${API_URL}/api/Substitutes/${id}`),
            ),
          cy.wrap(null) as Cypress.Chainable,
        );
      })
      // A folder entrusted to the absent agent...
      .then(() =>
        authed(absentToken, "POST", `${API_URL}/api/CourrierAdmin`, {
          NumeroReference: reference,
          Expediteur: "Delegation Test",
          Objet: `Delegation ${reference}`,
        }),
      )
      .then((r) => {
        expect(r.status).to.eq(201);
        documentId = (r.body.courrier?.id ?? r.body.id) as number;
        // ...and one held by a colleague of theirs, in the SAME service.
        return authed(colleagueToken, "POST", `${API_URL}/api/CourrierAdmin`, {
          NumeroReference: colleagueReference,
          Expediteur: "Delegation Test",
          Objet: `Delegation ${colleagueReference}`,
        });
      })
      .then((r) => {
        expect(r.status).to.eq(201);
        colleagueDocumentId = (r.body.courrier?.id ?? r.body.id) as number;
      })
      // Before covering anyone, the substitute must not see either folder.
      .then(() => visibleRefs(subToken))
      .then((refs) => {
        expect(refs, "hidden before the delegation").to.not.include(reference);
        expect(refs, "a colleague's folder is hidden too").to.not.include(
          colleagueReference,
        );
        return authed(absentToken, "POST", `${API_URL}/api/Substitutes`, {
          userId: absentId,
          substituteUserId: substituteId,
        });
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        return authed(absentToken, "GET", `${API_URL}/api/Substitutes/history/${absentId}`);
      })
      .then((h) => {
        delegationId = (h.body as Array<{ id: number; isActive: boolean }>).find(
          (s) => s.isActive,
        )!.id;
        // Now the substitute sees the covered agent's folder and can modify it.
        return visibleRefs(subToken);
      })
      .then((refs) => {
        expect(refs, "the entrusted folder is visible while covering").to.include(reference);
        // The whole point of the narrow scope: a delegation does NOT widen into
        // everything the absent agent's service happens to hold.
        expect(refs, "a colleague's folder stays out of reach").to.not.include(
          colleagueReference,
        );
        return authed(
          subToken,
          "PUT",
          `${API_URL}/api/Workspace/document/${colleagueDocumentId}`,
          { objet: "tentative interdite" },
        );
      })
      .then((r) => {
        expect(r.status, "cannot modify a colleague's folder").to.eq(403);
        return authed(
          subToken,
          "PUT",
          `${API_URL}/api/Workspace/document/${documentId}`,
          { objet: `Modifie par le remplacant ${stamp}` },
        );
      })
      .then((r) => {
        expect(r.status, "substitute can modify the covered folder").to.eq(200);
        // The action is traceable: who acted, for whom.
        return authed(absentToken, "GET", `${API_URL}/api/Substitutes/actions/${absentId}`);
      })
      .then((trace) => {
        expect(trace.status).to.eq(200);
        const modifications = (
          trace.body as Array<{ action: string; reference: string; pourNom: string }>
        ).filter((a) => a.action === "Modification" && a.reference === reference);
        expect(modifications.length, "the delegated change is traced").to.eq(1);
        expect(modifications[0].pourNom, "trace names the absent agent").to.exist;
        // Revoking closes the delegation and takes the scope away again.
        return authed(absentToken, "DELETE", `${API_URL}/api/Substitutes/${delegationId}`);
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        return visibleRefs(subToken);
      })
      .then((refs) => {
        expect(refs, "hidden again after revocation").to.not.include(reference);
        return authed(
          subToken,
          "PUT",
          `${API_URL}/api/Workspace/document/${documentId}`,
          { objet: "apres revocation" },
        );
      })
      .then((r) => {
        expect(r.status, "revoked substitute can no longer modify").to.eq(403);
        // The entrusted agent keeps full access to both folders of their service.
        return visibleRefs(absentToken);
      })
      .then((refs) => {
        expect(refs, "the agent keeps their own folders").to.include(reference);
        return cy.wrap(null, { log: false });
      })
      .then(() => undefined);
  });

  it("requires a requesting authority on an archive withdrawal", () => {
    // `archive` is the only seeded service with retrait_archive.
    login("archive", "archive123")
      .then((token) =>
        authed(token, "GET", `${API_URL}/api/Retrait/authorities`).then((r) => {
          expect(r.status).to.eq(200);
          expect(r.body, "the three entitled functions").to.have.members([
            "chef_greffe",
            "conseiller_rapporteur",
            "premier_president",
          ]);
          return token;
        }),
      )
      .then((token) =>
        authed(token, "POST", `${API_URL}/api/Retrait`, {
          documentId,
          reference,
          effectuePar: "X",
          motifRetrait: "Consultation",
        }).then((r) => {
          expect(r.status, "the authority is mandatory").to.eq(400);
          return authed(token, "POST", `${API_URL}/api/Retrait`, {
            documentId,
            reference,
            effectuePar: "X",
            autoriteDemandeuse: "quelqu_un",
            motifRetrait: "Consultation",
          });
        }),
      )
      .then((r) => {
        expect(r.status, "an unknown authority is refused").to.eq(400);
        // A service without retrait_archive is refused by RBAC even with a valid
        // payload — the backend decides, not the UI.
        return authed(absentToken, "POST", `${API_URL}/api/Retrait`, {
          documentId,
          reference,
          effectuePar: "X",
          autoriteDemandeuse: "chef_greffe",
          motifRetrait: "Consultation",
        });
      })
      .then((r) => {
        expect(r.status, "RBAC is enforced on the backend").to.eq(403);
        return login("archive", "archive123");
      })
      .then((token) =>
        authed(token, "POST", `${API_URL}/api/Retrait`, {
          documentId,
          reference,
          effectuePar: "PERSONNE SAISIE A LA MAIN",
          autoriteDemandeuse: "chef_greffe",
          motifRetrait: "Consultation du dossier",
          notes: "spec",
        }).then((r) => {
          expect(r.status).to.eq(200);
          retraitId = r.body.retrait?.id as number;
          return authed(token, "GET", `${API_URL}/api/Retrait/document/${documentId}`);
        }),
      )
      .then((r) => {
        expect(r.status).to.eq(200);
        const retrait = (r.body as Array<Record<string, string>>)[0];
        expect(retrait.autoriteDemandeuse).to.eq("chef_greffe");
        // The recording agent comes from the token, not from the form field.
        expect(retrait.saisiPar, "agent captured server-side").to.not.eq(
          "PERSONNE SAISIE A LA MAIN",
        );
        expect(retrait.saisiPar).to.be.a("string").and.not.be.empty;
      });
  });

  it("shows the delegation and trace sections on Mon profil", () => {
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type(loginAbsent);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();

    // The sidebar only renders once the session is established. The section
    // assertions use test ids so they do not depend on the active language.
    cy.get('[data-testid="nav-profil"]', { timeout: 20000 }).should("exist").click();
    cy.get('[data-testid="profil-infos"]', { timeout: 20000 }).should("be.visible");
    cy.get('[data-testid="profil-substitution"]').should("be.visible");
    cy.get('[data-testid="profil-historique"]').should("be.visible");
    cy.get('[data-testid="profil-trace"]').should("be.visible");
    // The substitute picker is fed from the live user list.
    cy.get("#substitute-select").should("exist");
  });

  after(() => {
    // Close what can be closed and hard-delete the folder this spec created.
    // The services and users are reclaimed by the global fixture purge, and the
    // permanent-delete endpoint drops their remaining delegation rows.
    cy.wrap(null)
      .then((): Cypress.Chainable<string> => login("archive", "archive123"))
      .then((token): Cypress.Chainable => {
        if (!retraitId) return cy.wrap(null);
        return authed(token, "DELETE", `${API_URL}/api/Retrait/${retraitId}`);
      })
      .then((): Cypress.Chainable<string> => login(loginAbsent, password))
      .then((token): Cypress.Chainable => {
        if (!delegationId) return cy.wrap(null);
        return authed(token, "DELETE", `${API_URL}/api/Substitutes/${delegationId}`);
      })
      .then((): Cypress.Chainable<string> => login(loginAbsent, password))
      .then((token): Cypress.Chainable => {
        if (!documentId) return cy.wrap(null);
        return authed(token, "DELETE", `${API_URL}/api/CourrierAdmin/${documentId}`).then(
          () => authed(token, "DELETE", `${API_URL}/api/Documents/corbeille`),
        );
      })
      .then(() => {
        expect(absentId, "spec actually ran").to.be.greaterThan(0);
      });
  });
});

// Keeps this file a module so its top-level bindings stay file-local.
export {};
