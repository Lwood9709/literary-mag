/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /** Wipes and reseeds the three fixture pieces via the test server's reset route. */
      resetPieces(): Chainable<void>
      /** Unlocks /admin by typing the shared test password and submitting. */
      unlockAdmin(): Chainable<void>
    }
  }
}

Cypress.Commands.add('resetPieces', () => {
  cy.request('POST', '/__test__/reset')
})

Cypress.Commands.add('unlockAdmin', () => {
  cy.visit('/admin')
  cy.get('input[type="password"]').type(Cypress.env('ADMIN_PASSWORD') || 'cypress-test-password')
  cy.contains('button', 'Unlock').click()
})

export {}
