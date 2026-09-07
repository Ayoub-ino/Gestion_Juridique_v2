// Permission-toggle lifecycle E2E tests
// Tests that toggling a permission off blocks access (API + UI),
// and toggling it back on restores access.
//
// Requires: backend on :5200 with seeded DB

describe("9. Permission Toggle Lifecycle", () => {
  const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

  // Re-seed the database before each test to ensure clean permission state
  beforeEach(() => {
    login("admin", "admin123").then((t) => {
      return authed(t, "POST", `${API_URL}/api/seed/run`).then((r) => {
        expect(r.status).to.eq(200);
      });
    });
  });

  /** Login via API and return the JWT token */
  const login = (user: string, pass: string) =>
    cy
      .request({
        method: "POST",
        url: `${API_URL}/api/auth/login`,
        body: { Login: user, Password: pass },
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        return r.body.token as string;
      });

  /** Authenticated API request helper */
  const authed = (
    token: string,
    method: Cypress.HttpMethod,
    url: string,
    body?: Record<string, unknown>,
  ) =>
    cy.request({
      method,
      url,
      headers: { Authorization: `Bearer ${token}` },
      body,
      failOnStatusCode: false,
    });

  /** Get bureauordre's serviceId via the matrix endpoint */
  const getBureauOrdreServiceId = (adminToken: string) =>
    authed(adminToken, "GET", `${API_URL}/api/rbac/permissions/matrix`).then((res) => {
      const services = (res.body as { services: { id: number; code: string }[] }).services;
      const svc = services.find((s) => s.code === "bureauordre");
      expect(svc, "bureauordre service should exist in the matrix").to.exist;
      return svc!.id;
    });

  /** Save a snapshot of a service's current permissions (call BEFORE any patches) */
  const snapshotPerms = (adminToken: string, serviceId: number) =>
    authed(adminToken, "GET", `${API_URL}/api/rbac/permissions/service/${serviceId}`).then(
      (res) => res.body.permissions as { key: string; enabled: boolean }[],
    );

  /**
   * Save permissions for a service. `overrides` is a partial map:
   * keys that appear will be set to the given value; others stay unchanged.
   */
  const patchServicePerms = (
    adminToken: string,
    serviceId: number,
    overrides: Record<string, boolean>,
  ) =>
    authed(adminToken, "GET", `${API_URL}/api/rbac/permissions/service/${serviceId}`).then(
      (res) => {
        const perms = res.body.permissions as { key: string; enabled: boolean }[];
        const updated = perms.map((p) => ({
          permissionKey: p.key,
          enabled: p.key in overrides ? overrides[p.key] : p.enabled,
        }));
        return authed(
          adminToken,
          "PUT",
          `${API_URL}/api/rbac/permissions/service/${serviceId}`,
          { permissions: updated },
        ).then((saveRes) => {
          expect(saveRes.status).to.eq(200);
        });
      },
    );

  /** Restore permissions from a previously-taken snapshot */
  const restorePermissions = (
    adminToken: string,
    serviceId: number,
    snapshot: { key: string; enabled: boolean }[],
  ) => {
    const restore = snapshot
      .filter((p) => p.key && p.key.trim() !== "")
      .map((p) => ({
        permissionKey: p.key,
        enabled: p.enabled,
      }));
    return authed(
      adminToken,
      "PUT",
      `${API_URL}/api/rbac/permissions/service/${serviceId}`,
      { permissions: restore },
    ).then((r) => {
      expect(r.status).to.eq(200);
    });
  };

  /** Get current admin overrides (returns array of { permissionKey, enabled }) */
  const getAdminOverrides = (adminToken: string) =>
    authed(adminToken, "GET", `${API_URL}/api/rbac/permissions/admin`).then(
      (res) => res.body.permissions as { permissionKey: string; enabled: boolean }[],
    );

  /** Save admin overrides from a snapshot (now that GET returns permissionKey, round-trip is direct) */
  const saveAdminOverrides = (
    adminToken: string,
    snapshot: { permissionKey: string; enabled: boolean }[],
  ) =>
    authed(adminToken, "PUT", `${API_URL}/api/rbac/permissions/admin`, {
      permissions: snapshot,
    }).then((r) => {
      expect(r.status).to.eq(200);
    });

  // ─────────────────────────────────────────────────
  //  Service-level permission toggle tests
  // ─────────────────────────────────────────────────

  it("export_excel: disable → not in /me, re-enable → restored", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { export_excel: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.not.include("export_excel");
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.include("export_excel");
        });
      });
  });

  it("supprimer: disable → DELETE returns 403, re-enable → restored", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { supprimer: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "DELETE", `${API_URL}/api/CourrierAdmin/1`).then((r) => {
          expect(r.status).to.eq(403);
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "DELETE", `${API_URL}/api/CourrierAdmin/1`).then((r) => {
          expect(r.status).to.not.eq(403);
        });
      });
  });

  it("archiver: disable → POST archive-batch returns 403, re-enable → restored", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { archiver: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/Documents/archive-batch`, { ids: [] }).then((r) => {
          expect(r.status).to.eq(403);
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/Documents/archive-batch`, { ids: [] }).then((r) => {
          expect(r.status).to.not.eq(403);
        });
      });
  });

  it("transferer: disable → POST Transfer returns 403, re-enable → restored", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { transferer: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/Transfer`, {
          documentId: 1,
          documentType: "entrant-admin",
          serviceDestination: "Archive",
        }).then((r) => {
          expect(r.status).to.eq(403);
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/Transfer`, {
          documentId: 1,
          documentType: "entrant-admin",
          serviceDestination: "Archive",
        }).then((r) => {
          expect(r.status).to.not.eq(403);
        });
      });
  });

  it("creer_courrier_admin: disable → POST CourrierAdmin returns 403, re-enable → restored", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { creer_courrier_admin: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/CourrierAdmin`, {}).then((r) => {
          expect(r.status).to.eq(403);
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/CourrierAdmin`, {}).then((r) => {
          expect(r.status).to.not.eq(403);
        });
      });
  });

  it("accepter: disable → PUT accepter returns 403, re-enable → restored via /me", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { accepter: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        // Verify permission removed from JWT
        authed(t, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.not.include("accepter");
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        // Verify permission restored (use /me — the endpoint also has ownership checks)
        authed(t, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.include("accepter");
        });
      });
  });

  it("refuser: disable → PUT refuser returns 403, re-enable → restored via /me", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { refuser: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.not.include("refuser");
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.include("refuser");
        });
      });
  });

  it("transferer_juridique: disable → POST juridique returns 403, re-enable → restored", () => {
    let adminToken: string;
    // fathmilafat has transferer_juridique
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return authed(t, "GET", `${API_URL}/api/rbac/permissions/matrix`).then((res) => {
          const svc = (res.body as { services: { id: number; code: string }[] }).services.find(
            (s) => s.code === "fathmilafat",
          );
          expect(svc, "fathmilafat service should exist").to.exist;
          return svc!.id;
        });
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { transferer_juridique: false });
      })
      .then(() => login("fathmilafat", "fathmilafat123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/juridique/1/TransactionJuridique`, {}).then((r) => {
          expect(r.status).to.eq(403);
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("fathmilafat", "fathmilafat123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/juridique/1/TransactionJuridique`, {}).then((r) => {
          expect(r.status).to.not.eq(403);
        });
      });
  });

  it("retrait_archive: disable → POST Retrait returns 403, re-enable → restored", () => {
    let adminToken: string;
    // archive has retrait_archive
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return authed(t, "GET", `${API_URL}/api/rbac/permissions/matrix`).then((res) => {
          const svc = (res.body as { services: { id: number; code: string }[] }).services.find(
            (s) => s.code === "archive",
          );
          expect(svc, "archive service should exist").to.exist;
          return svc!.id;
        });
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { retrait_archive: false });
      })
      .then(() => login("archive", "archive123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/Retrait`, { documentId: 1 }).then((r) => {
          expect(r.status).to.eq(403);
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("archive", "archive123"))
      .then((t) => {
        authed(t, "POST", `${API_URL}/api/Retrait`, { documentId: 1 }).then((r) => {
          expect(r.status).to.not.eq(403);
        });
      });
  });

  it("recherche_avancee: disable → no longer in /me, re-enable → restored via /me", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { recherche_avancee: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.not.include("recherche_avancee");
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        authed(t, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.include("recherche_avancee");
        });
      });
  });

  // ─────────────────────────────────────────────────
  //  Admin override toggle cycle
  // ─────────────────────────────────────────────────

  it("admin override: enable gerer_services for admin → access, disable → 403", () => {
    let adminToken: string;
    let adminSnapshot: { permissionKey: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getAdminOverrides(t);
      })
      .then((overrides) => {
        adminSnapshot = overrides;

        // Verify admin currently CAN access gerer_services (not overridden)
        const disabled = overrides.find((o) => o.permissionKey === "gerer_services" && !o.enabled);
        // gerer_services should NOT be in the disabled overrides (admin keeps it)
        expect(disabled, "gerer_services should not be disabled for admin").to.be.undefined;
      })
      .then(() => {
        // Now add gerer_services to admin overrides (disable it)
        const updated = [
          ...adminSnapshot,
          { permissionKey: "gerer_services", enabled: false },
        ];
        return authed(adminToken, "PUT", `${API_URL}/api/rbac/permissions/admin`, {
          permissions: updated,
        }).then((r) => expect(r.status).to.eq(200));
      })
      .then(() => {
        // Verify admin is NOW blocked
        return authed(adminToken, "POST", `${API_URL}/api/Services`, {}).then((r) => {
          expect(r.status).to.eq(403);
        });
      })
      .then(() => {
        // Restore original overrides
        return saveAdminOverrides(adminToken, adminSnapshot);
      })
      .then(() => {
        // Verify admin can access again
        return authed(adminToken, "POST", `${API_URL}/api/Services`, {}).then((r) => {
          expect(r.status).to.not.eq(403);
        });
      });
  });

  // ─────────────────────────────────────────────────
  //  Ownership layer: permission + wrong service → 403
  // ─────────────────────────────────────────────────

  it("ownership: cross-service accepter → 403 even with permission enabled", () => {
    // Create a courrier as bureauordre, then transfer to archive
    login("admin", "admin123")
      .then(() => login("bureauordre", "bureauordre123"))
      .then((boToken) => {
        authed(boToken, "POST", `${API_URL}/api/CourrierAdmin`, {
          NumeroOrdre: `OWNERSHIP-TEST-${Date.now()}`,
          Expediteur: "Test",
          Objet: "Ownership test",
        }).then((res) => {
          expect(res.status).to.eq(201);
          const docId = res.body.courrier?.id ?? res.body.id;
          // Transfer to archive service
          authed(boToken, "POST", `${API_URL}/api/Transfer`, {
            documentId: docId,
            documentType: "entrant-admin",
            serviceDestination: "Archive",
          }).then((txRes) => {
            const txId = txRes.body.transactionIds?.[0];
            expect(txId, "transaction should be created").to.exist;

            // Archive user (destination) should be able to accept
            login("archive", "archive123").then((archiveToken) => {
              authed(archiveToken, "PUT", `${API_URL}/api/Transactions/${txId}/accepter`, {
                commentaire: "accepted",
              }).then((r) => {
                expect(r.status).to.eq(200);
              });
            });
          });
        });
      })
      // Now test that a non-owner WITH accepter permission gets 403
      .then(() => login("bureauordre", "bureauordre123"))
      .then((boToken) => {
        // bureauordre has accepter permission but is not the destination service
        authed(boToken, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.include("accepter");
        });
        // Try to accept a transaction destined for archive
        authed(boToken, "PUT", `${API_URL}/api/Transactions/1/accepter`, {
          commentaire: "should fail",
        }).then((r) => {
          expect(r.status).to.eq(403);
        });
      });
  });

  it("ownership: cross-service refuser → 403 even with permission enabled", () => {
    login("admin", "admin123")
      .then(() => login("bureauordre", "bureauordre123"))
      .then((boToken) => {
        // bureauordre has refuser permission
        authed(boToken, "GET", `${API_URL}/api/auth/me`).then((me) => {
          expect(me.body.user.permissions).to.include("refuser");
        });
        // Create + transfer to archive, then try to refuser as bureauordre (non-owner)
        authed(boToken, "POST", `${API_URL}/api/CourrierAdmin`, {
          NumeroOrdre: `REFUS-TEST-${Date.now()}`,
          Expediteur: "Test",
          Objet: "Refuser ownership test",
        }).then((res) => {
          const docId = res.body.courrier?.id ?? res.body.id;
          authed(boToken, "POST", `${API_URL}/api/Transfer`, {
            documentId: docId,
            documentType: "entrant-admin",
            serviceDestination: "Archive",
          }).then((txRes) => {
            const txId = txRes.body.transactionIds?.[0];
            expect(txId, "transaction should be created").to.exist;
            // bureauordre has refuser but is NOT the destination → 403
            authed(boToken, "PUT", `${API_URL}/api/Transactions/${txId}/refuser`, {
              commentaire: "should fail",
            }).then((r) => {
              expect(r.status).to.eq(403);
            });
          });
        });
      });
  });

  // ─────────────────────────────────────────────────
  //  UI test
  // ─────────────────────────────────────────────────

  it("UI: export buttons hidden when export_excel disabled, visible when enabled", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        return patchServicePerms(adminToken, serviceId, { export_excel: false, export_word: false });
      })
      .then(() => {
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.visit("/");
        cy.waitForHydration();
        cy.get('input[type="text"]').first().type("bureauordre");
        cy.get('input[type="password"]').type("bureauordre123");
        cy.get('button[type="submit"]').click();

        cy.get("aside", { timeout: 10000 }).should("exist");

        cy.get("aside").within(() => {
          cy.contains(/Mes entités|وثائقي|ملفاتي/).click();
        });
        cy.wait(1000);

        cy.get("button").contains("export excel").should("not.exist");
        cy.get("button").contains("export word").should("not.exist");
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => {
        cy.get("aside").within(() => {
          cy.contains(/Déconnexion|تسجيل الخروج/).click();
        });
        cy.waitForHydration();
        cy.get('input[type="text"]').first().type("bureauordre");
        cy.get('input[type="password"]').type("bureauordre123");
        cy.get('button[type="submit"]').click();

        cy.get("aside", { timeout: 10000 }).should("exist");

        cy.get("aside").within(() => {
          cy.contains(/Mes entités|وثائقي|ملفاتي/).click();
        });
        cy.wait(1000);

        cy.get("button").contains("export excel").should("exist");
        cy.get("button").contains("export word").should("exist");
      });
  });

  // ─────────────────────────────────────────────────
  //  Admin panel access control tests
  // ─────────────────────────────────────────────────

  it("UI: non-admin user cannot see admin panels", () => {
    // secretarait has NO gerer_* permissions
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type("secretarait");
    cy.get('input[type="password"]').type("secretarait123");
    cy.get('button[type="submit"]').click();
    cy.get("aside", { timeout: 10000 }).should("exist");

    // None of the admin management buttons should exist
    cy.get("aside").within(() => {
      cy.contains(/Utilisateurs|المستخدمون/).should("not.exist");
      cy.contains(/Permissions\.\.\.|الصلاحيات/).should("not.exist");
      cy.contains(/Équipements|المعدات/).should("not.exist");
      cy.contains(/Listes dynamiques|اللوائح الديناميكية/).should("not.exist");
      cy.contains(/Services\.\.\.|المصالح/).should("not.exist");
    });
  });

  it("UI: admin user can see all admin panels", () => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit("/");
    cy.waitForHydration();
    cy.get('input[type="text"]').first().type("admin");
    cy.get('input[type="password"]').type("admin123");
    cy.get('button[type="submit"]').click();
    cy.get("aside", { timeout: 10000 }).should("exist");

    // All admin management buttons should be visible
    cy.get("aside").within(() => {
      cy.contains(/Utilisateurs|المستخدمون/).should("exist");
      cy.contains(/Permissions\.\.\.|الصلاحيات/).should("exist");
      cy.contains(/Équipements|المعدات/).should("exist");
      cy.contains(/Listes dynamiques|اللوائح الديناميكية/).should("exist");
      cy.contains(/Services\.\.\.|المصالح/).should("exist");
    });
  });

  it("UI: admin panel API returns 403 for non-admin user", () => {
    let adminToken: string;
    let serviceId: number;
    let snapshot: { key: string; enabled: boolean }[];

    // First, ensure bureauordre has gerer_utilisateurs disabled (default)
    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return getBureauOrdreServiceId(t);
      })
      .then((id) => {
        serviceId = id;
        return snapshotPerms(adminToken, id);
      })
      .then((s) => {
        snapshot = s;
        // Make sure gerer_utilisateurs is disabled for bureauordre
        return patchServicePerms(adminToken, serviceId, { gerer_utilisateurs: false });
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        // GET /api/Users should return 403 when gerer_utilisateurs is disabled
        authed(t, "GET", `${API_URL}/api/Users`).then((res) => {
          expect(res.status).to.eq(403);
        });
      })
      .then(() => restorePermissions(adminToken, serviceId, snapshot))
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        // After restoring, GET /api/Users should still be 403 (bureauordre has no gerer_utilisateurs)
        authed(t, "GET", `${API_URL}/api/Users`).then((res) => {
          expect(res.status).to.eq(403);
        });
      })
      .then(() => login("admin", "admin123"))
      .then((t) => {
        // Admin should always be able to access
        authed(t, "GET", `${API_URL}/api/Users`).then((res) => {
          expect(res.status).to.eq(200);
        });
      });
  });

  // ─────────────────────────────────────────────────
  //  Service soft-delete (archive / restore / permanent delete)
  // ─────────────────────────────────────────────────

  it("service soft-delete: archive → hidden from active list → appears in archived → restore → back", () => {
    let adminToken: string;
    let createdServiceId: number;

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        // Create a temporary service to archive
        return authed(t, "POST", `${API_URL}/api/rbac/services`, {
          nom: `Test Archive Service ${Date.now()}`,
          code: `test-archive-${Date.now()}`,
          description: "Temporary test service for archive E2E",
        });
      })
      .then((res) => {
        expect(res.status).to.eq(200);
        createdServiceId = res.body.id;

        // Verify it appears in the active list
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services`).then((r) => {
          const ids = (r.body as { id: number }[]).map((s) => s.id);
          expect(ids).to.include(createdServiceId);
        });
      })
      // Soft-delete (archive)
      .then(() => {
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${createdServiceId}`).then((r) => {
          expect(r.status).to.eq(200);
        });
      })
      // Verify it's hidden from the active list
      .then(() => {
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services`).then((r) => {
          const ids = (r.body as { id: number }[]).map((s) => s.id);
          expect(ids).to.not.include(createdServiceId);
        });
      })
      // Verify it appears in the archived list
      .then(() => {
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services?includeInactive=true`).then((r) => {
          const svc = (r.body as { id: number; isActive: boolean }[]).find((s) => s.id === createdServiceId);
          expect(svc, "archived service should appear with includeInactive").to.exist;
          expect(svc!.isActive).to.eq(false);
        });
      })
      // Restore the service
      .then(() => {
        return authed(adminToken, "POST", `${API_URL}/api/rbac/services/${createdServiceId}/restore`).then((r) => {
          expect(r.status).to.eq(200);
        });
      })
      // Verify it's back in the active list
      .then(() => {
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services`).then((r) => {
          const ids = (r.body as { id: number }[]).map((s) => s.id);
          expect(ids).to.include(createdServiceId);
        });
      })
      // Clean up: permanent delete
      .then(() => {
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${createdServiceId}/permanent`);
      });
  });

  it("service permanent delete: archive → permanent delete → gone from both lists", () => {
    let adminToken: string;
    let createdServiceId: number;

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return authed(t, "POST", `${API_URL}/api/rbac/services`, {
          nom: `Test Perm Delete ${Date.now()}`,
          code: `test-perm-delete-${Date.now()}`,
          description: "Temporary service for permanent delete test",
        });
      })
      .then((res) => {
        expect(res.status).to.eq(200);
        createdServiceId = res.body.id;

        // Archive first
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${createdServiceId}`).then((r) => {
          expect(r.status).to.eq(200);
        });
      })
      // Now permanently delete
      .then(() => {
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${createdServiceId}/permanent`).then((r) => {
          expect(r.status).to.eq(200);
        });
      })
      // Verify it's gone from both lists
      .then(() => {
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services?includeInactive=true`).then((r) => {
          const ids = (r.body as { id: number }[]).map((s) => s.id);
          expect(ids).to.not.include(createdServiceId);
        });
      });
  });

  it("service permanent delete blocked when users assigned", () => {
    let adminToken: string;
    let bureauOrdreId: number;

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        // Get bureauordre service ID
        return authed(t, "GET", `${API_URL}/api/rbac/permissions/matrix`).then((res) => {
          const svc = (res.body as { services: { id: number; code: string }[] }).services.find(
            (s) => s.code === "bureauordre",
          );
          bureauOrdreId = svc!.id;
        });
      })
      // Archive it
      .then(() => {
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${bureauOrdreId}`);
      })
      // Try to permanently delete (should fail because users are assigned)
      .then(() => {
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${bureauOrdreId}/permanent`).then((r) => {
          expect(r.status).to.eq(400);
          expect(r.body.error).to.include("utilisateur");
        });
      })
      // Restore it since we can't permanently delete
      .then(() => {
        return authed(adminToken, "POST", `${API_URL}/api/rbac/services/${bureauOrdreId}/restore`);
      });
  });

  // ─────────────────────────────────────────────────
  //  Active services filter (only active in dropdowns)
  // ─────────────────────────────────────────────────

  it("active services filter: GET /api/rbac/services returns only active by default", () => {
    let adminToken: string;
    let createdServiceId: number;

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return authed(t, "POST", `${API_URL}/api/rbac/services`, {
          nom: `Test Filter Service ${Date.now()}`,
          code: `test-filter-${Date.now()}`,
          description: "Temporary for filter test",
        });
      })
      .then((res) => {
        createdServiceId = res.body.id;
        // Archive it
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${createdServiceId}`);
      })
      // Without includeInactive, should NOT appear
      .then(() => {
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services`).then((r) => {
          const ids = (r.body as { id: number }[]).map((s) => s.id);
          expect(ids).to.not.include(createdServiceId);
        });
      })
      // With includeInactive=true, SHOULD appear
      .then(() => {
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services?includeInactive=true`).then((r) => {
          const ids = (r.body as { id: number }[]).map((s) => s.id);
          expect(ids).to.include(createdServiceId);
        });
      })
      // Clean up
      .then(() => {
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${createdServiceId}/permanent`);
      });
  });

  // ─────────────────────────────────────────────────
  //  Multi-user transfer routing
  // ─────────────────────────────────────────────────

  it("multi-user transfer: targetUserIds creates separate transactions per user", () => {
    let adminToken: string;
    let boToken: string;
    let archiveUserIds: number[];
    let docId: number;

    login("admin", "admin123")
      .then((t) => { adminToken = t; })
      // Get archive service users
      .then(() => {
        return authed(adminToken, "GET", `${API_URL}/api/Users/by-service/archive`).then((r) => {
          archiveUserIds = (r.body as { id: number }[]).map((u) => u.id);
          expect(archiveUserIds.length).to.be.greaterThan(0, "archive service should have users");
        });
      })
      // Login as bureauordre and create a doc
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => {
        boToken = t;
        return authed(boToken, "POST", `${API_URL}/api/CourrierAdmin`, {
          NumeroOrdre: `MULTI-USER-TEST-${Date.now()}`,
          Expediteur: "Test",
          Objet: "Multi-user transfer test",
        }).then((res) => {
          docId = res.body.courrier?.id ?? res.body.id;
        });
      })
      // Transfer with targetUserIds (pick first 2 users if available)
      .then(() => {
        const targetIds = archiveUserIds.slice(0, 2);
        return authed(boToken, "POST", `${API_URL}/api/Transfer`, {
          documentId: docId,
          documentType: "entrant-admin",
          serviceDestination: "Archive",
          targetUserIds: targetIds,
        }).then((r) => {
          expect(r.status).to.eq(200);
          // Should create one transaction per selected user
          expect(r.body.transactionIds).to.have.length(targetIds.length);
        });
      });
  });

  it("multi-user transfer: single targetUserId still works (backward compat)", () => {
    let boToken: string;
    let docId: number;

    login("bureauordre", "bureauordre123")
      .then((t) => {
        boToken = t;
        return authed(boToken, "POST", `${API_URL}/api/CourrierAdmin`, {
          NumeroOrdre: `SINGLE-USER-TEST-${Date.now()}`,
          Expediteur: "Test",
          Objet: "Single user transfer test",
        }).then((res) => {
          docId = res.body.courrier?.id ?? res.body.id;
        });
      })
      .then(() => {
        return authed(boToken, "POST", `${API_URL}/api/Transfer`, {
          documentId: docId,
          documentType: "entrant-admin",
          serviceDestination: "Archive",
          targetUserId: 1,
        }).then((r) => {
          expect(r.status).to.eq(200);
          expect(r.body.transactionIds).to.have.length(1);
        });
      });
  });

  // ─────────────────────────────────────────────────
  //  Archive API: archive → hidden → archived list → restore → back
  // ─────────────────────────────────────────────────

  it("UI: admin archive view — archive service, verify hidden, restore, verify back", () => {
    let adminToken: string;
    let svcId: number;
    const code = `e2e-archive-${Date.now()}`;

    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return authed(t, "POST", `${API_URL}/api/rbac/services`, {
          nom: `E2E Archive ${Date.now()}`,
          code,
          description: "test",
        });
      })
      .then((r) => {
        svcId = r.body.id;
        // Archive it
        return authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${svcId}`);
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        // Verify hidden from active list
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services`);
      })
      .then((r) => {
        const ids = (r.body as { id: number }[]).map((s) => s.id);
        expect(ids).to.not.include(svcId);
        // Verify visible in archived list with Restore/Delete available
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services?includeInactive=true`);
      })
      .then((r) => {
        const svc = (r.body as { id: number; isActive: boolean }[]).find((s) => s.id === svcId);
        expect(svc).to.exist;
        expect(svc!.isActive).to.eq(false);
      })
      // Restore
      .then(() => authed(adminToken, "POST", `${API_URL}/api/rbac/services/${svcId}/restore`))
      .then((r) => {
        expect(r.status).to.eq(200);
        // Verify back in active list
        return authed(adminToken, "GET", `${API_URL}/api/rbac/services`);
      })
      .then((r) => {
        const ids = (r.body as { id: number }[]).map((s) => s.id);
        expect(ids).to.include(svcId);
      })
      // Clean up
      .then(() => authed(adminToken, "DELETE", `${API_URL}/api/rbac/services/${svcId}/permanent`));
  });

});
