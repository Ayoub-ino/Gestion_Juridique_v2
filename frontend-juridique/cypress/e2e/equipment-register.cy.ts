// Regression spec: « Gestion des équipements ».
//
// The register collects exactly five things — numéro de série, informations
// supplémentaires, type, état, service — and drives a two-state treatment:
// an item is chargé or déchargé, and the discharge date is stamped on the way
// out. Type and état are codes into the managed lists `types_equipement` /
// `etats_equipement`, so the drop-downs must be fed by those lists, a list
// change must show through with no code change, and the import must accept the
// labels those lists carry.
//
// The old register carried three extra free-text fields (`Code`,
// `Numéro d'inventaire`, `Bureau`); this spec pins that they are gone.
//
// Requires: backend on :5200 with seeded DB.

const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

describe("Gestion des équipements", () => {
  const stamp = Date.now();
  let serialCounter = 0;
  const nextSerial = () => `EQP-${stamp}-${++serialCounter}`;

  let adminToken = "";
  let typeCode = "";
  let etatCode = "";
  let serviceCode = "";
  // Labels, for the import path — a sheet built from the template carries labels.
  let typeLabel = "";
  let etatLabel = "";
  const createdIds: number[] = [];
  const createdListIds: number[] = [];

  const authed = (method: Cypress.HttpMethod, url: string, body?: unknown) =>
    cy.request({
      method,
      url,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: body as Record<string, unknown> | undefined,
      failOnStatusCode: false,
    });

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
        return authed("GET", `${API_URL}/api/Equipment/lists`);
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        expect(r.body.types, "types list is seeded").to.have.length.greaterThan(0);
        expect(r.body.etats, "états list is seeded").to.have.length.greaterThan(0);
        typeCode = r.body.types[0].code;
        typeLabel = r.body.types[0].valueFr;
        etatCode = r.body.etats[0].code;
        etatLabel = r.body.etats[0].valueFr;
        return authed("GET", `${API_URL}/api/rbac/services`);
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        serviceCode = r.body[0].code;
      });
  });

  after(() => {
    // The register and its lists are real data — leave both exactly as found.
    createdIds.forEach((id) => {
      authed("DELETE", `${API_URL}/api/Equipment/${id}`);
    });
    createdListIds.forEach((id) => {
      authed("DELETE", `${API_URL}/api/ListItems/${id}`);
    });
  });

  const create = (overrides: Record<string, unknown> = {}) => {
    const serial = nextSerial();
    return authed("POST", `${API_URL}/api/Equipment`, {
      serial,
      type: typeCode,
      etat: etatCode,
      service: serviceCode,
      additionalInfo: "spec fixture",
      ...overrides,
    }).then((r) => {
      if (r.status === 200 && r.body?.id) createdIds.push(r.body.id as number);
      return { status: r.status, id: r.body?.id as number, serial };
    });
  };

  const fetchById = (id: number) =>
    authed("GET", `${API_URL}/api/Equipment`).then((r) => {
      const row = (r.body as Array<Record<string, unknown>>).find((e) => e.id === id);
      expect(row, `equipment ${id} exists`).to.exist;
      return row!;
    });

  it("feeds Type and État from the managed lists, with FR and AR labels", () => {
    authed("GET", `${API_URL}/api/Equipment/lists`).then((r) => {
      // At least the seeded four — the administrator may have added more, and
      // that must not turn this into a false failure.
      expect(r.body.types.length, "seeded types").to.be.at.least(4);
      expect(r.body.etats.length, "seeded états").to.be.at.least(4);
      (r.body.types as Array<Record<string, string>>).forEach((t) => {
        expect(t.valueFr, "type has a French label").to.be.a("string").and.not.be.empty;
        expect(t.valueAr, "type has an Arabic label").to.be.a("string").and.not.be.empty;
      });
      (r.body.etats as Array<Record<string, string>>).forEach((e) => {
        expect(e.valueFr, "état has a French label").to.be.a("string").and.not.be.empty;
        expect(e.valueAr, "état has an Arabic label").to.be.a("string").and.not.be.empty;
      });
    });
  });

  it("persists the five entry fields and drops the retired ones", () => {
    create().then(({ id, serial }) =>
      fetchById(id).then((row) => {
        expect(row.serial).to.eq(serial);
        expect(row.type).to.eq(typeCode);
        expect(row.etat).to.eq(etatCode);
        expect(row.service).to.eq(serviceCode);
        expect(row.additionalInfo).to.eq("spec fixture");

        // The retired free-text fields must not come back.
        expect(row).to.not.have.property("code");
        expect(row).to.not.have.property("numeroInventaire");
        expect(row).to.not.have.property("bureau");
      }),
    );
  });

  it("creates every item charged, and never asks the form for the charge state", () => {
    create()
      .then(({ id }) => fetchById(id))
      .then((row) => {
        expect(row.estCharge, "new items start chargé").to.eq(true);
        expect(row.dateDechargement, "no discharge date yet").to.eq(null);
      });
  });

  it("décharger stamps the date; charger clears it again", () => {
    create()
      .then(({ id }) => {
        return authed("POST", `${API_URL}/api/Equipment/${id}/decharger`, {}).then((r) => {
          expect(r.status).to.eq(200);
          return fetchById(id);
        });
      })
      .then((row) => {
        expect(row.estCharge, "décharger clears the flag").to.eq(false);
        expect(row.dateDechargement, "décharger stamps a date").to.not.eq(null);
        return authed("POST", `${API_URL}/api/Equipment/${row.id as number}/charger`, {}).then(
          (r) => {
            expect(r.status).to.eq(200);
            return fetchById(row.id as number);
          },
        );
      })
      .then((row) => {
        expect(row.estCharge, "charger restores the flag").to.eq(true);
        expect(row.dateDechargement, "charger clears the date").to.eq(null);
      });
  });

  it("accepts an explicit discharge date", () => {
    create()
      .then(({ id }) =>
        authed("POST", `${API_URL}/api/Equipment/${id}/decharger`, {
          dateDechargement: "2026-01-15T09:30:00",
        }).then(() => fetchById(id)),
      )
      .then((row) => {
        expect(String(row.dateDechargement)).to.contain("2026-01-15");
      });
  });

  it("enforces the entry rules on the backend", () => {
    create().then(({ serial }) => {
      // Serial is the register's natural key.
      authed("POST", `${API_URL}/api/Equipment`, {
        serial,
        type: typeCode,
        etat: etatCode,
        service: serviceCode,
      }).then((r) => expect(r.status, "duplicate serial").to.eq(409));

      authed("POST", `${API_URL}/api/Equipment`, {
        serial: nextSerial(),
        type: "",
        etat: etatCode,
        service: serviceCode,
      }).then((r) => expect(r.status, "missing type").to.eq(400));

      authed("POST", `${API_URL}/api/Equipment`, {
        serial: nextSerial(),
        type: typeCode,
        etat: etatCode,
        service: "",
      }).then((r) => expect(r.status, "missing service").to.eq(400));
    });
  });

  it("keeps the charge state out of an edit", () => {
    create()
      .then(({ id, serial }) =>
        authed("POST", `${API_URL}/api/Equipment/${id}/decharger`, {})
          .then(() =>
            authed("PUT", `${API_URL}/api/Equipment/${id}`, {
              serial,
              type: typeCode,
              etat: etatCode,
              service: serviceCode,
              additionalInfo: "modifié",
            }),
          )
          .then(() => fetchById(id)),
      )
      .then((row) => {
        expect(row.additionalInfo).to.eq("modifié");
        expect(row.estCharge, "an edit must not silently re-charge").to.eq(false);
      });
  });

  it("is refused (403) for a user without gerer_equipements", () => {
    cy.request({
      method: "POST",
      url: `${API_URL}/api/auth/login`,
      body: { Login: "khibra", Password: "khibra123" },
      failOnStatusCode: false,
    }).then((r) => {
      expect(r.status).to.eq(200);
      cy.request({
        method: "POST",
        url: `${API_URL}/api/Equipment`,
        headers: { Authorization: `Bearer ${r.body.token as string}` },
        body: { serial: nextSerial(), type: typeCode, etat: etatCode, service: serviceCode },
        failOnStatusCode: false,
      }).then((res) => expect(res.status, "RBAC enforced on the backend").to.eq(403));
    });
  });

  // -------------------------------------------------------------------------
  // The two lists the register depends on
  // -------------------------------------------------------------------------
  // Type and État are the register's own configuration — without them an item
  // cannot be entered — so a change to a list must reach the choices with no
  // code change and no restart.
  it("follows the catalogue when a Type is added, renamed, deactivated, deleted", () => {
    const code = `verif${stamp}`;
    const entry = {
      listName: "types_equipement",
      code,
      valueFr: "Vérif FR",
      valueAr: "تحقق",
      displayOrder: 99,
      isActive: true,
    };
    const listedCodes = () =>
      authed("GET", `${API_URL}/api/Equipment/lists`).then((r) =>
        (r.body.types as Array<{ code: string }>).map((t) => t.code),
      );

    authed("POST", `${API_URL}/api/ListItems`, entry)
      .then((r) => {
        expect(r.status, "admin may maintain the list").to.eq(200);
        createdListIds.push(r.body.id as number);
        return listedCodes();
      })
      .then((codes) => {
        expect(codes, "a new Type is offered immediately").to.include(code);
        return authed("PUT", `${API_URL}/api/ListItems/${createdListIds[0]}`, {
          ...entry,
          valueFr: "Vérif renommé",
        });
      })
      .then(() => authed("GET", `${API_URL}/api/Equipment/lists`))
      .then((r) => {
        const item = (r.body.types as Array<Record<string, string>>).find((t) => t.code === code);
        expect(item?.valueFr, "a rename shows through").to.eq("Vérif renommé");
        return authed("PUT", `${API_URL}/api/ListItems/${createdListIds[0]}`, {
          ...entry,
          valueFr: "Vérif renommé",
          isActive: false,
        });
      })
      .then(() => listedCodes())
      .then((codes) => {
        expect(codes, "a deactivated Type is no longer offered").to.not.include(code);
        return authed("DELETE", `${API_URL}/api/ListItems/${createdListIds[0]}`);
      })
      .then((r) => {
        expect(r.status).to.eq(200);
        // Deleted by the test itself — drop it so the cleanup does not re-delete.
        createdListIds.length = 0;
        return listedCodes();
      })
      .then((codes) => expect(codes).to.not.include(code));
  });

  describe("UI", () => {
    // Cypress resets the page between tests, so every UI test walks in from the
    // login screen rather than relying on the previous test's session.
    const visitEquipements = (french = false) => {
      cy.visit("/");
      cy.waitForHydration();
      cy.get('input[type="text"]').first().type("admin");
      cy.get('input[type="password"]').type("admin123");
      cy.get('button[type="submit"]').click();
      if (french) cy.switchLanguage("fr");
      cy.get('[data-testid="nav-equipements"]', { timeout: 20000 }).should("exist");
      cy.get('[data-testid="nav-equipements"]').click();
    };

    it("offers exactly the five entry fields, with Type and État as lists", () => {
      visitEquipements();
      cy.get('[data-testid="equip-add"]', { timeout: 10000 }).click();
      cy.get('[data-testid="equip-form"]').should("be.visible");

      // Free text where the reference has free text…
      cy.get('[data-testid="equip-serial"]').should("have.attr", "type", "text");
      cy.get('[data-testid="equip-additional-info"]').should("have.attr", "type", "text");

      // …and a list where the reference has a list, fed by the managed lists.
      cy.get('[data-testid="equip-type"]').should("be.visible").and("match", "select");
      cy.get('[data-testid="equip-etat"]').should("be.visible").and("match", "select");
      cy.get('[data-testid="equip-service"]').should("be.visible").and("match", "select");

      cy.get('[data-testid="equip-type"] option').should("have.length.greaterThan", 4);
      cy.get('[data-testid="equip-etat"] option').should("have.length.greaterThan", 4);

      // The retired fields are gone from the form for good.
      cy.get('[data-testid="equip-code"]').should("not.exist");
      cy.get('[data-testid="equip-inventaire"]').should("not.exist");
      cy.get('[data-testid="equip-bureau"]').should("not.exist");

      cy.get('[data-testid="equip-add"]').click();
    });

    it("creates an item and drives it through décharger then charger", () => {
      visitEquipements();
      const serial = nextSerial();
      cy.get('[data-testid="equip-add"]', { timeout: 10000 }).click();
      cy.get('[data-testid="equip-serial"]').clear().type(serial);
      cy.get('[data-testid="equip-type"]').select(1);
      cy.get('[data-testid="equip-etat"]').select(1);
      cy.get('[data-testid="equip-service"]').select(1);
      cy.get('[data-testid="equip-submit"]').click();

      cy.contains("tr", serial, { timeout: 15000 }).within(() => {
        // A fresh item is charged, so the only charge action on offer is décharger.
        cy.get('[data-testid="equip-charger"]').should("not.exist");
        cy.get('[data-testid="equip-decharger"]').should("be.visible").click();
      });

      cy.contains("tr", serial).within(() => {
        cy.get('[data-testid="equip-charger"]', { timeout: 10000 }).should("be.visible").click();
      });

      cy.contains("tr", serial).within(() => {
        cy.get('[data-testid="equip-decharger"]', { timeout: 10000 }).should("be.visible");
      });

      // Cleanup through the API so the fixture never lingers in the register.
      authed("GET", `${API_URL}/api/Equipment`).then((r) => {
        const row = (r.body as Array<Record<string, unknown>>).find((e) => e.serial === serial);
        if (row) authed("DELETE", `${API_URL}/api/Equipment/${row.id as number}`);
      });
    });

    it("imports a sheet: maps the columns, keeps the valid rows, reports the bad ones", () => {
      visitEquipements(true);
      const goodSerial = nextSerial();
      const badSerial = nextSerial();

      // All values quoted, so a label containing a separator cannot break it.
      const csv = [
        '"Série","Informations supplémentaires","Type","État","Service"',
        `"${goodSerial}","import ok","${typeLabel}","${etatLabel}","${serviceCode}"`,
        `"${badSerial}","import ko","ZZZ-inconnu","${etatLabel}","${serviceCode}"`,
      ].join("\n");

      cy.get('[data-testid="equip-import-toggle"]', { timeout: 10000 }).click();
      cy.get('[data-testid="equip-import-file"]').selectFile(
        { contents: Cypress.Buffer.from(csv), fileName: "equipements.csv", mimeType: "text/csv" },
        { force: true },
      );

      // The header row and the five columns are picked up without being told.
      cy.get('[data-testid="equip-map-serial"]').should("have.value", "Série");
      cy.get('[data-testid="equip-map-type"]').should("have.value", "Type");
      cy.get('[data-testid="equip-map-etat"]').should("have.value", "État");
      cy.get('[data-testid="equip-map-service"]').should("have.value", "Service");
      cy.get('[data-testid="equip-map-additionalInfo"]').should(
        "have.value",
        "Informations supplémentaires",
      );

      cy.get('[data-testid="equip-import-run"]').click();

      // One row lands, the other is rejected and explained rather than swallowed.
      cy.get('[data-testid="equip-import-summary"]', { timeout: 20000 })
        .should("be.visible")
        .and("contain.text", "1");
      cy.get('[data-testid="equip-import-errors"]').should("be.visible");
      cy.get('[data-testid="equip-import-errors"]').should("contain.text", "Ligne 3");

      // The good row is in the register; the bad one never was.
      cy.contains("tr", goodSerial, { timeout: 15000 }).should("exist");
      cy.contains("tr", badSerial).should("not.exist");

      authed("GET", `${API_URL}/api/Equipment`).then((r) => {
        const rows = r.body as Array<Record<string, unknown>>;
        const good = rows.find((e) => e.serial === goodSerial);
        expect(good, "the valid row was imported").to.exist;
        expect(good!.type).to.eq(typeCode);
        expect(good!.additionalInfo).to.eq("import ok");
        expect(rows.find((e) => e.serial === badSerial)).to.not.exist;
        if (good) authed("DELETE", `${API_URL}/api/Equipment/${good.id as number}`);
      });
    });

    it("runs the export pipeline over the rows on screen", () => {
      // A fixture of its own, so the assertion does not lean on the developer's data.
      create().then(({ serial }) => {
        visitEquipements();
        cy.contains("tr", serial, { timeout: 15000 }).should("exist");

        // The export resolves codes to labels and hands a Blob to the browser;
        // the blob hand-off is the observable end of that pipeline.
        cy.window().then((win) => {
          cy.stub(win.URL, "createObjectURL").as("createObjectURL").returns("blob:stub");
        });
        cy.get('[data-testid="export-excel"]').click();
        cy.get("@createObjectURL").should("have.been.called");
      });
    });

    it("opens the list manager scoped to the equipment lists only", () => {
      visitEquipements();
      cy.get('[data-testid="equip-lists-toggle"]', { timeout: 10000 }).click();
      cy.get('[data-testid="equip-lists-panel"]').should("exist");

      // Only the two equipment lists — not the whole catalogue.
      cy.get('[data-testid="equip-lists-panel"]').within(() => {
        cy.contains(/Types d'équipement|أنواع المعدات/).should("exist");
        cy.contains(/États d'équipement|حالات المعدات/).should("exist");
        cy.contains(/Tribunaux|المحاكم/).should("not.exist");
        cy.contains(/Direction|الاتجاه/).should("not.exist");
      });
    });
  });
});

// Keeps this file a module so its top-level constants stay file-local.
export {};
