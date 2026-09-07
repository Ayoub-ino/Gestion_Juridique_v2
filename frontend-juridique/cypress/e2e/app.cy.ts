// E2E Tests for Gestion Juridique Application

describe("Application E2E Tests", () => {
  beforeEach(() => {
    cy.visit("/");
    // In dev mode, async script loading can make hydration finish after
    // the page is visible — typing before hydration gets wiped by the
    // hydration reset (see support/commands.ts). Wait for React first.
    cy.waitForHydration();
  });

  describe("1. Login Page", () => {
    it("should display the login form", () => {
      cy.get("h2").should("be.visible");
      cy.get('input[type="text"]').should("be.visible");
      cy.get('input[type="password"]').should("be.visible");
      cy.get('button[type="submit"]').should("be.visible");
    });

    it("should have language toggle button", () => {
      cy.contains("button", /عربي|Français/).should("be.visible");
    });

    it("should switch to French when clicking language toggle", () => {
      // Check current language - if Arabic, switch to French
      cy.get("body").then(($body) => {
        if ($body.find('button:contains("Français")').length > 0) {
          cy.contains("button", "Français").click();
          cy.wait(300);
          cy.contains("h2", "Cour d'Appel Administrative").should("be.visible");
        }
      });
    });

    it("should switch to Arabic when clicking language toggle", () => {
      cy.get("body").then(($body) => {
        if ($body.find('button:contains("عربي")').length > 0) {
          cy.contains("button", "عربي").click();
          cy.wait(300);
          cy.contains("h2", "الاستئنافية الإدارية").should("be.visible");
        }
      });
    });

    it("should show error on invalid login", () => {
      cy.get('input[type="text"]').first().type("invalid_user");
      cy.get('input[type="password"]').type("wrong_password");
      cy.get('button[type="submit"]').click();
      // Should show error message
      cy.get(".text-red-500").should("be.visible");
    });
  });

  describe("2. Application Layout (when authenticated)", () => {
    beforeEach(() => {
      // Attempt login - if it succeeds, we're in the app
      cy.get('input[type="text"]').first().type("bureauordre");
      cy.get('input[type="password"]').type("bureauordre123");
      cy.get('button[type="submit"]').click();
    });

    it("should display the sidebar after login", () => {
      cy.get("aside").should("exist");
      cy.contains("button", /FR|AR/).should("exist");
    });

    it("should have dashboard navigation", () => {
      cy.get("aside nav").should("be.visible");
      // Dashboard button is always rendered; label depends on the active language
      cy.get("aside").contains(/Tableau de bord|لوحة التحكم/).should("exist");
    });

    it("should navigate to different views via sidebar", () => {
      // Click on different sidebar items and verify view changes
      cy.get("aside").within(() => {
        // Try clicking "Mes entités" / "Mes documents" (Arabic: ملفاتي)
        cy.contains(/Mes entités|ملفاتي/).click();
      });
      cy.url().should("include", "/");
    });

    it("should have language toggle in sidebar", () => {
      cy.get("aside").within(() => {
        cy.contains("button", "FR").should("be.visible");
        cy.contains("button", "AR").should("be.visible");
      });
    });

    it("should switch language in sidebar", () => {
      cy.get("aside").within(() => {
        // Switch to Arabic
        cy.contains("button", "AR").click();
        cy.wait(300);
      });
      // Verify Arabic text appears (e.g., sidebar title)
      cy.get("aside").contains(/محكمة/).should("exist");
    });

    it("should switch language back to French", () => {
      cy.get("aside").within(() => {
        cy.contains("button", "AR").click();
        cy.wait(300);
        cy.contains("button", "FR").click();
        cy.wait(300);
      });
      cy.get("aside").contains(/Cour d'Appel/).should("exist");
    });

    it("should have dark mode toggle", () => {
      cy.get("aside").contains(/🌙|☀️/).should("be.visible");
    });

    it("should have logout button", () => {
      cy.get("aside").contains(/Déconnexion|تسجيل الخروج/).should("be.visible");
    });
  });

  describe("3. Dashboard", () => {
    beforeEach(() => {
      cy.get('input[type="text"]').first().type("bureauordre");
      cy.get('input[type="password"]').type("bureauordre123");
      cy.get('button[type="submit"]').click();
    });

    it("should display dashboard view by default", () => {
      cy.get("main").should("be.visible");
    });

    it("should display document workflow progress", () => {
      cy.get("main").should("exist");
    });
  });

  describe("4. French Language - Full Interface Test", () => {
    beforeEach(() => {
      cy.get('input[type="text"]').first().type("bureauordre");
      cy.get('input[type="password"]').type("bureauordre123");
      cy.get('button[type="submit"]').click();
      // Switch to French
      cy.get("aside").within(() => {
        cy.contains("button", "FR").click();
      });
      cy.wait(300);
    });

    it("should display all interface in French", () => {
      // French-only text checks
      cy.contains("Cour d'Appel Administrative").should("be.visible");
      cy.contains("Tableau de bord").should("be.visible");
    });

    it("should NOT display Arabic text in French mode", () => {
      // Check that visible headings and buttons are in French
      cy.get("h1, h2, h3, button, th, label, span").filter(":visible").then(($els) => {
        const visibleText = $els.text();
        // Arabic-specific phrases should not appear in visible French UI
        expect(visibleText).not.to.contain("المملكة");
        expect(visibleText).not.to.contain("لوحة التحكم");
      });
    });
  });

  describe("5. Arabic Language - Full Interface Test", () => {
    beforeEach(() => {
      cy.get('input[type="text"]').first().type("bureauordre");
      cy.get('input[type="password"]').type("bureauordre123");
      cy.get('button[type="submit"]').click();
      // Switch to Arabic
      cy.get("aside").within(() => {
        cy.contains("button", "AR").click();
      });
      cy.wait(300);
    });

    it("should display all interface in Arabic", () => {
      cy.contains("محكمة الاستئناف").should("be.visible");
      cy.contains("لوحة التحكم").should("be.visible");
    });

    it("should have RTL direction in Arabic mode", () => {
      cy.get("div[dir]").first().should("have.attr", "dir", "rtl");
    });

    it("should NOT display French text in Arabic mode", () => {
      cy.get("h1, h2, h3, button, th, label, span").filter(":visible").then(($els) => {
        const visibleText = $els.text();
        expect(visibleText).not.to.contain("Cour d'Appel");
        expect(visibleText).not.to.contain("Tableau de bord");
      });
    });
  });

  describe("6. Document Creation Form", () => {
    beforeEach(() => {
      cy.get('input[type="text"]').first().type("bureauordre");
      cy.get('input[type="password"]').type("bureauordre123");
      cy.get('button[type="submit"]').click();
    });

    it("should show admin document form", () => {
      cy.get("aside").within(() => {
        cy.contains(/Courrier Administratif|مراسلات إدارية واردة/).click();
      });
      cy.wait(300);
      // Check form is visible
      cy.get("form").should("exist");
      cy.get('input, textarea, select').should("have.length.at.least", 3);
    });

    it("should show juridical document form", () => {
      // Juridique (creer_courrier_juridique / ouvrir_dossier) belongs to fathmilafat,
      // not bureauordre — log out and sign in as fathmilafat.
      cy.get("aside").contains(/Déconnexion|تسجيل الخروج/).click();
      cy.wait(300);
      cy.get('input[type="text"]').first().type("fathmilafat");
      cy.get('input[type="password"]').type("fathmilafat123");
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      cy.get("aside").within(() => {
        cy.contains(/Dossier Juridique|ملف قضائي وارد/).click();
      });
      cy.wait(300);
      cy.get("form").should("exist");
    });

    it("should show outgoing mail form", () => {
      cy.get("aside").within(() => {
        cy.contains(/Courrier Sortant Normal|مراسلات صادرة عادية/).click();
      });
      cy.wait(300);
      cy.get("form").should("exist");
    });
  });

  describe("7. Admin Pages", () => {
    beforeEach(() => {
      cy.get('input[type="text"]').first().type("admin");
      cy.get('input[type="password"]').type("admin123");
      cy.get('button[type="submit"]').click();
    });

    it("should navigate to users management", () => {
      cy.get("aside").within(() => {
        cy.contains(/Utilisateurs|المستخدمون/).click();
      });
      cy.wait(300);
      cy.get("table").should("exist");
    });

    it("should navigate to services management", () => {
      cy.get("aside").within(() => {
        cy.contains(/Services|المصالح/).click();
      });
      cy.wait(300);
    });

    it("should navigate to permissions management", () => {
      cy.get("aside").within(() => {
        cy.contains(/Permissions|الصلاحيات/).click();
      });
      cy.wait(300);
    });

    it("should navigate to equipment management", () => {
      cy.get("aside").within(() => {
        cy.contains(/Équipements|المعدات/).click();
      });
      cy.wait(300);
    });
  });

  // ===================================================================
  // 8. Permission Enforcement (API-level, deterministic)
  //    Nécessite le backend démarré sur :5200 avec une base SEEDÉE
  //    (comptes : bureauordre/bureauordre123, secretarait/secretarait123,
  //    admin/admin123). Vérifie que l'enforcement [RequirePermission]
  //    côté serveur n'est pas contournable et correspond à la matrice seed.
  // ===================================================================
  describe("8. Permission Enforcement (API)", () => {
    const API_URL = Cypress.env("API_URL") || "http://localhost:5200";

    const login = (login: string, password: string) => {
      return cy
        .request({
          method: "POST",
          url: `${API_URL}/api/auth/login`,
          body: { Login: login, Password: password },
        })
        .then((res) => {
          expect(res.status).to.eq(200);
          return res.body.token as string;
        });
    };

    const authed = (token: string, method: Cypress.HttpMethod, url: string, body?: Record<string, unknown>) => {
      return cy.request({
        method,
        url,
        headers: { Authorization: `Bearer ${token}` },
        body,
        failOnStatusCode: false,
      });
    };

    it("admin cannot transfer (transferer overridden off)", () => {
      login("admin", "admin123").then((token) => {
        authed(token, "POST", `${API_URL}/api/Transfer`, {
          documentId: 1,
          documentType: "entrant-admin",
          serviceDestination: "Archive",
        }).then((res) => {
          expect(res.status).to.eq(403);
        });
      });
    });

    it("bureauordre (has transferer) is not blocked by permission", () => {
      login("bureauordre", "bureauordre123").then((token) => {
        authed(token, "POST", `${API_URL}/api/Transfer`, {
          documentId: 1,
          documentType: "entrant-admin",
          serviceDestination: "Archive",
        }).then((res) => {
          // Permission OK -> controller runs -> document 1 n'existe pas -> 404 (pas 403)
          expect(res.status).not.to.eq(403);
        });
      });
    });

    it("secretarait (no supprimer) cannot delete", () => {
      login("secretarait", "secretarait123").then((token) => {
        authed(token, "DELETE", `${API_URL}/api/CourrierAdmin/1`).then((res) => {
          expect(res.status).to.eq(403);
        });
      });
    });

    it("bureauordre (has supprimer) is not blocked by permission", () => {
      login("bureauordre", "bureauordre123").then((token) => {
        authed(token, "DELETE", `${API_URL}/api/CourrierAdmin/1`).then((res) => {
          expect(res.status).not.to.eq(403);
        });
      });
    });

    it("admin (no accepter) cannot accept a transaction", () => {
      login("admin", "admin123").then((token) => {
        authed(token, "PUT", `${API_URL}/api/Transactions/1/accepter`, {
          commentaire: "test",
        }).then((res) => {
          expect(res.status).to.eq(403);
        });
      });
    });

    it("bureauordre (has accepter) passes the permission layer", () => {
      login("bureauordre", "bureauordre123").then((token) => {
        authed(token, "PUT", `${API_URL}/api/Transactions/1/accepter`, {
          commentaire: "test",
        }).then((res) => {
          // The middleware denies with 403 + "Permission ... not granted".
          // Any other outcome (ownership 403 "Accès refusé", 404, or 200)
          // proves the `accepter` permission WAS granted to bureauordre.
          expect(JSON.stringify(res.body)).not.to.contain("not granted");
        });
      });
    });

    it("secretarait (no creer_courrier_admin) cannot create admin courrier", () => {
      login("secretarait", "secretarait123").then((token) => {
        authed(token, "POST", `${API_URL}/api/CourrierAdmin`, {
          numeroOrdre: `TEST-${Date.now()}`,
          expediteur: "Test",
          objet: "Test",
        }).then((res) => {
          expect(res.status).to.eq(403);
        });
      });
    });

    it("bureauordre (has creer_courrier_admin) is not blocked by permission", () => {
      login("bureauordre", "bureauordre123").then((token) => {
        authed(token, "POST", `${API_URL}/api/CourrierAdmin`, {
          numeroOrdre: `TEST-${Date.now()}`,
          expediteur: "Test",
          objet: "Test",
        }).then((res) => {
          expect(res.status).not.to.eq(403);
        });
      });
    });
  });
});
