/* eslint-disable @typescript-eslint/no-namespace */
// ***************************************************************
// Custom Cypress commands
// ***************************************************************

/**
 * Waits until React has hydrated the page.
 *
 * In `next dev`, script execution is asynchronous, so the page can be
 * visible and the `load` event can have fired while React is still
 * hydrating. Typing into a controlled input before hydration completes
 * is a race: hydration resets the input value to the component state
 * (empty), which then silently blocks native `required` form validation
 * (no submit, no request, no error). Waiting for the React fiber to be
 * attached to a DOM node guarantees hydration has committed before we
 * interact.
 */
Cypress.Commands.add("waitForHydration", () => {
  cy.get("form, aside, main, button", { timeout: 20000 }).should(($els) => {
    const el = $els[0] as unknown as Record<string, unknown>;
    expect(
      Object.keys(el).some((k) => k.startsWith("__reactFiber")),
      "React should be hydrated (fiber attached to the DOM)"
    ).to.be.true;
  });
});

// Login command for E2E tests
Cypress.Commands.add("login", (username: string, password: string) => {
  cy.visit("/");
  cy.waitForHydration();
  cy.get('input[type="text"]').first().type(username);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
});

// Switch language
Cypress.Commands.add("switchLanguage", (lang: "fr" | "ar") => {
  cy.contains("button", lang === "fr" ? "FR" : "AR").click();
  cy.wait(500);
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(username: string, password: string): Chainable<void>;
      switchLanguage(lang: "fr" | "ar"): Chainable<void>;
      waitForHydration(): Chainable<void>;
    }
  }
}

export {};
