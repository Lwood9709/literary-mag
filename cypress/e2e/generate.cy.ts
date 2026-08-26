/**
 * The browser's call to POST /api/generate is stubbed in every test here —
 * the real route's call to Claude happens server-side, invisible to
 * cy.intercept, so there is nothing to accidentally hit and no API key is
 * ever needed for this spec.
 */
describe('AI generation', () => {
  beforeEach(() => {
    cy.resetPieces()
    cy.unlockAdmin()
  })

  it('fills the editor, checks the AI box, and shows the badge once published', () => {
    cy.intercept('POST', '/api/generate', {
      statusCode: 200,
      body: {
        title: 'A Generated Piece',
        body: '<p>Written by the model, for now.</p>',
      },
    }).as('generateReq')

    cy.get('input[placeholder*="mood or theme"]').type('winter')
    cy.contains('button', 'Generate with AI').click()
    cy.wait('@generateReq')

    cy.get('input[placeholder="Title"]').should('have.value', 'A Generated Piece')
    cy.get('.ProseMirror').contains('Written by the model, for now.')
    cy.get('input[type="checkbox"]').should('be.checked')

    // The real /api/pieces write (not stubbed) — proves is_ai_generated
    // actually reaches the database and back out to the badge, the whole
    // point of this feature.
    cy.contains('button', 'Publish').click()
    cy.url().should('include', '/piece/')
    cy.contains('AI')

    cy.visit('/')
    cy.contains('A Generated Piece')
      .closest('li')
      .within(() => cy.contains('AI'))
  })

  it('shows the rate-limit message on a 429 without crashing', () => {
    cy.intercept('POST', '/api/generate', {
      statusCode: 429,
      body: { error: 'Daily generation limit reached' },
    }).as('generateReq')

    cy.contains('button', 'Generate with AI').click()
    cy.wait('@generateReq')

    cy.contains('Daily AI generation limit reached')
    cy.get('input[placeholder="Title"]').should('have.value', '')
  })

  it('disables generation for the found type, reserved for real imports', () => {
    cy.contains('button', 'found').click()
    cy.contains('button', 'Generate with AI').should('be.disabled')
  })

  it('lets the manual checkbox override the flag on its own', () => {
    cy.get('input[placeholder="Title"]').type('Hand-written piece')
    cy.get('.ProseMirror').type('No generation involved here.')
    cy.get('input[type="checkbox"]').check()
    cy.get('input[type="checkbox"]').should('be.checked')
    cy.get('input[type="checkbox"]').uncheck()
    cy.get('input[type="checkbox"]').should('not.be.checked')
  })
})
