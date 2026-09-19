// Dynamic service transfer & refusal-notification E2E tests
//
// Folders must route by the RBAC service CODE, not by the fixed ServiceTribunal
// enum. That is what makes services created from the admin panel able to receive
// folders, refuse them, and have the sender notified with the refusal reason.
//
// Requires: backend on :5200 with seeded DB

describe("10. Dynamic Service Transfer & Refusal Notification", () => {
  const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

  // Unique per run so repeated runs never collide on service code / reference
  const stamp = Date.now();
  const serviceCode = `e2edyn${stamp}`;
  const serviceName = `E2E Dynamic ${stamp}`;
  const loginName = `e2edyn${stamp}`;
  const password = "E2eDyn@12345";

  let adminToken: string;
  let serviceId: number;
  let userId: number;
  let refCounter = 0;
  const nextReference = () => `DYN-${stamp}-${++refCounter}`;

  // Documents created by this spec, removed again in `after`
  const createdDocIds: number[] = [];

  /** Login request that never fails the chain (used by the cleanup hook) */
  const loginRequest = (user: string, pass: string) =>
    cy.request({
      method: "POST",
      url: `${API_URL}/api/auth/login`,
      body: { Login: user, Password: pass },
      failOnStatusCode: false,
    });

  /** Login via API and return the JWT token */
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

  /** Create a courrier as bureauordre and return its id + reference */
  const createCourrier = () =>
    login("bureauordre", "bureauordre123").then((t) => {
      const reference = nextReference();
      return authed(t, "POST", `${API_URL}/api/CourrierAdmin`, {
        NumeroOrdre: reference,
        NumeroReference: reference,
        Expediteur: "E2E Dynamic",
        Objet: `Dynamic routing ${reference}`,
      }).then((res) => {
        expect(res.status).to.eq(201);
        const id = (res.body.courrier?.id ?? res.body.id) as number;
        createdDocIds.push(id);
        return { id, reference };
      });
    });

  before(() => {
    login("admin", "admin123")
      .then((t) => {
        adminToken = t;
        return authed(t, "POST", `${API_URL}/api/rbac/services`, {
          nom: serviceName,
          code: serviceCode,
          description: "Temporary service created by E2E dynamic routing spec",
        });
      })
      .then((res) => {
        expect(res.status).to.eq(200);
        serviceId = res.body.id;
        return authed(adminToken, "POST", `${API_URL}/api/Users`, {
          Login: loginName,
          Password: password,
          Nom: `${serviceName} User`,
          Role: "User",
          Service: serviceCode,
          ServiceId: serviceId,
        });
      })
      .then((res) => {
        expect(res.status).to.eq(200);
        userId = res.body.id;
      });
  });

  after(() => {
    let boToken = "";
    let dynToken: string | null = null;

    // Tokens are captured with plain requests here so the hook stays type-safe
    // (the login helper throws on failure, which is undesirable in cleanup).
    loginRequest("bureauordre", "bureauordre123")
      .then((res) => {
        boToken = (res.body?.token as string) ?? "";
        // The destination user may already be archived by an earlier run — tolerate that
        return loginRequest(loginName, password);
      })
      .then((res) => {
        dynToken = (res.body?.token as string) ?? null;
      })
      // 1. Remove the sample courriers this spec created. Whoever currently holds
      //    custody may delete, so try bureauordre (refused transfers return there)
      //    and fall back to the destination service's own user.
      .then(() => {
        // Sequential so each custody check sees the previous deletion
        return createdDocIds.reduce(
          (chain: Cypress.Chainable, id) =>
            chain.then(() =>
              authed(boToken, "DELETE", `${API_URL}/api/CourrierAdmin/${id}`).then((res) => {
                if (res.status === 200 || !dynToken) return;
                return authed(
                  dynToken,
                  "DELETE",
                  `${API_URL}/api/CourrierAdmin/${id}`,
                ).then(() => undefined);
              }),
            ),
          cy.wrap(null) as Cypress.Chainable,
        );
      })
      // 2. Archive the test user and service. The user references transactions, which
      //    the audit trail protects from hard deletion, so archiving is the supported
      //    cleanup — it removes both from the active lists and the transfer destinations.
      .then(() => {
        if (!serviceId) return;
        return loginRequest("admin", "admin123").then((res) =>
          authed((res.body?.token as string) ?? "", "DELETE", `${API_URL}/api/Users/${userId}`).then(
            () =>
              authed(
                (res.body?.token as string) ?? "",
                "DELETE",
                `${API_URL}/api/rbac/services/${serviceId}`,
              ),
          ),
        );
      });
  });

  it("lists the dynamically-created service in the transfer destinations", () => {
    login("bureauordre", "bureauordre123")
      .then((t) => authed(t, "GET", `${API_URL}/api/rbac/services`))
      .then((res) => {
        expect(res.status).to.eq(200);
        const codes = (res.body as { code: string }[]).map((s) => s.code);
        expect(codes, "newly-created service must be selectable").to.include(serviceCode);
      })
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => authed(t, "GET", `${API_URL}/api/historical-services`))
      .then((res) => {
        // Historical services must be readable by regular users (transfer form),
        // not only by admin managers.
        expect(res.status).to.eq(200);
      });
  });

  it("routes a folder to the dynamic service and reports its real sender service", () => {
    let docId = 0;
    let txId = 0;

    createCourrier()
      .then(({ id }) => {
        docId = id;
        return login("bureauordre", "bureauordre123");
      })
      .then((t) =>
        authed(t, "POST", `${API_URL}/api/Transfer`, {
          documentId: docId,
          documentType: "entrant-admin",
          serviceDestination: serviceCode,
          message: "Transfert vers service dynamique",
        }),
      )
      .then((res) => {
        expect(res.status).to.eq(200);
        // Routed to the dynamic code — NOT collapsed onto a hardcoded service
        expect(res.body.destinations).to.deep.eq([serviceCode]);
        txId = res.body.transactionIds[0];
      })
      .then(() => login(loginName, password))
      .then((t) => authed(t, "GET", `${API_URL}/api/Transactions/pending`))
      .then((res) => {
        expect(res.status).to.eq(200);
        const notice = (res.body as Record<string, unknown>[]).find((n) => n.id === txId);
        expect(notice, "the dynamic service must receive the transfer").to.exist;
        expect(notice!.sourceServiceId).to.eq("bureauordre");
        expect(notice!.destinationServiceId).to.eq(serviceCode);
        expect(notice!.statut).to.eq("EnAttente");
      });
  });

  it("keeps folder with sender until receiver accepts", () => {
    let docId = 0;
    let txId = 0;

    createCourrier()
      .then(({ id }) => {
        docId = id;
        return login("bureauordre", "bureauordre123");
      })
      .then((t) =>
        authed(t, "POST", `${API_URL}/api/Transfer`, {
          documentId: docId,
          documentType: "entrant-admin",
          serviceDestination: serviceCode,
        }),
      )
      .then((res) => {
        expect(res.status).to.eq(200);
        txId = res.body.transactionIds[0];
      })
      // Sender still sees it (folder stays with sender until accepted)
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => authed(t, "GET", `${API_URL}/api/CourrierAdmin`))
      .then((res) => {
        const doc = (res.body as { id: number; serviceActuelCode?: string }[]).find(
          (c) => c.id === docId,
        );
        expect(doc, "sender must still hold custody before acceptance").to.exist;
        expect(doc!.serviceActuelCode).to.eq("bureauordre");
      })
      // Receiver does NOT see the folder yet
      .then(() => login(loginName, password))
      .then((t) => authed(t, "GET", `${API_URL}/api/CourrierAdmin`))
      .then((res) => {
        const ids = (res.body as { id: number }[]).map((c) => c.id);
        expect(ids, "receiver must NOT see folder before acceptance").to.not.include(docId);
      })
      // Receiver accepts the transaction
      .then(() => login(loginName, password))
      .then((t) =>
        authed(t, "PUT", `${API_URL}/api/Transactions/${txId}/accepter`, {}),
      )
      .then((res) => expect(res.status).to.eq(200))
      // NOW the receiver sees the folder
      .then(() => login(loginName, password))
      .then((t) => authed(t, "GET", `${API_URL}/api/CourrierAdmin`))
      .then((res) => {
        const doc = (res.body as { id: number; serviceActuelCode?: string }[]).find(
          (c) => c.id === docId,
        );
        expect(doc, "receiver must see folder after acceptance").to.exist;
        expect(doc!.serviceActuelCode).to.eq(serviceCode);
      })
      // Sender no longer sees it after acceptance
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => authed(t, "GET", `${API_URL}/api/CourrierAdmin`))
      .then((res) => {
        const ids = (res.body as { id: number }[]).map((c) => c.id);
        expect(ids, "sender must no longer hold custody after acceptance").to.not.include(docId);
      });
  });

  it("shows every service and the historical services in the transfer modal", () => {
    createCourrier().then(({ reference }) => {
      cy.clearCookies();
      cy.clearLocalStorage();
      cy.visit("/");
      cy.waitForHydration();
      cy.get('input[type="text"]').first().type("bureauordre");
      cy.get('input[type="password"]').type("bureauordre123");
      cy.get('button[type="submit"]').click();

      cy.get("aside", { timeout: 15000 }).should("exist");
      cy.get("aside").within(() => {
        cy.contains(/Mes dossiers|وثائقي|ملفاتي/).click();
      });
      cy.wait(800);

      // Open the transfer modal from the row of the document we just created
      cy.contains("tr", reference, { timeout: 15000 })
        .within(() => {
          cy.contains(/Transférer au service suivant|إحالة إلى المصلحة الموالية/).click();
        });

      cy.contains(/Transférer le dossier|تحويل الملف/, { timeout: 15000 }).should("be.visible");

      // The destination list is fetched from the live catalog
      cy.contains(/Chargement des services|جاري تحميل الخدمات/).should("not.exist");

      cy.get("body").invoke("text").then((bodyText) => {
        // The service created at runtime is selectable as a destination...
        expect(bodyText, "dynamically-created service must be offered").to.contain(serviceName);
        // ...and historical (record-only) services are offered too
        expect(bodyText).to.match(/Services historiques|الخدمات التاريخية/);
      });
    });
  });

  it("notifies the sender with the refusal reason when the receiver refuses", () => {
    const reason = "Dossier incomplet : piece jointe n2 manquante";
    let docId = 0;
    let txId = 0;

    createCourrier()
      .then(({ id }) => {
        docId = id;
        return login("bureauordre", "bureauordre123");
      })
      .then((t) =>
        authed(t, "POST", `${API_URL}/api/Transfer`, {
          documentId: docId,
          documentType: "entrant-admin",
          serviceDestination: serviceCode,
        }),
      )
      .then((res) => {
        expect(res.status).to.eq(200);
        txId = res.body.transactionIds[0];
      })
      // The dynamic service can refuse (this is what was broken before)
      .then(() => login(loginName, password))
      .then((t) =>
        authed(t, "PUT", `${API_URL}/api/Transactions/${txId}/refuser`, {
          commentaire: reason,
          doitRevenir: true,
        }),
      )
      .then((res) => expect(res.status).to.eq(200))
      // The sender is notified, with the reason they typed
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => authed(t, "GET", `${API_URL}/api/Transactions/pending`))
      .then((res) => {
        expect(res.status).to.eq(200);
        const notice = (res.body as Record<string, unknown>[]).find(
          (n) => n.commentaire === "[REFUS]" && n.documentId === docId,
        );
        expect(notice, "sender must receive a refusal notification").to.exist;
        expect(notice!.message).to.eq(reason);
        expect(notice!.sourceServiceId).to.eq(serviceCode);
        expect(notice!.destinationServiceId).to.eq("bureauordre");
      })
      // Acknowledging the notice closes it without moving the folder again
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) =>
        authed(t, "GET", `${API_URL}/api/Transactions/pending`).then((res) => {
          const notice = (res.body as { id: number; commentaire?: string; documentId: number }[]).find(
            (n) => n.commentaire === "[REFUS]" && n.documentId === docId,
          );
          expect(notice, "refusal notice should still be pending").to.exist;
          return authed(t, "PUT", `${API_URL}/api/Transactions/${notice!.id}/accepter`, {
            commentaire: "acknowledged",
          });
        }),
      )
      .then((res) => expect(res.status).to.eq(200))
      // Folder is back with the sender and still editable by them
      .then(() => login("bureauordre", "bureauordre123"))
      .then((t) => authed(t, "GET", `${API_URL}/api/CourrierAdmin/${docId}`))
      .then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.serviceActuelCode).to.eq("bureauordre");
      });
  });

  it("a second refusal notifies the sender again with the new reason", () => {
    const firstReason = "Premier refus : piece manquante";
    const secondReason = "Second refus : signature du president absente";
    let docId = 0;

    /** Refuse whatever transfer is currently pending for this document */
    const refusePending = (reason: string) =>
      login(loginName, password)
        .then((t) =>
          authed(t, "GET", `${API_URL}/api/Transactions/pending`).then((res) => {
            const pending = (res.body as { id: number; documentId: number }[]).find(
              (n) => n.documentId === docId,
            );
            expect(pending, "a transfer should be pending for the receiver").to.exist;
            return authed(t, "PUT", `${API_URL}/api/Transactions/${pending!.id}/refuser`, {
              commentaire: reason,
              doitRevenir: true,
            });
          }),
        )
        .then((res) => expect(res.status).to.eq(200));

    const transferToDynamicService = () =>
      login("bureauordre", "bureauordre123")
        .then((t) =>
          authed(t, "POST", `${API_URL}/api/Transfer`, {
            documentId: docId,
            documentType: "entrant-admin",
            serviceDestination: serviceCode,
          }),
        )
        .then((res) => expect(res.status).to.eq(200));

    /** All refusal notices the sender currently holds for this document */
    const senderRefusalNotices = () =>
      login("bureauordre", "bureauordre123")
        .then((t) => authed(t, "GET", `${API_URL}/api/Transactions/pending`))
        .then((res) =>
          (res.body as { commentaire?: string; message: string; documentId: number }[]).filter(
            (n) => n.commentaire === "[REFUS]" && n.documentId === docId,
          ),
        );

    createCourrier()
      .then(({ id }) => {
        docId = id;
        return transferToDynamicService();
      })
      .then(() => refusePending(firstReason))
      // A second transfer + refusal must ADD a notice, not lose or duplicate the first
      .then(() => transferToDynamicService())
      .then(() => refusePending(secondReason))
      .then(() => senderRefusalNotices())
      .then((notices) => {
        expect(notices, "one notice per refusal — no duplicates").to.have.length(2);
        const messages = notices.map((n) => n.message);
        expect(messages).to.include(firstReason);
        expect(messages).to.include(secondReason);
      });
  });
});
