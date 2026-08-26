/**
 * PoetryDB is always stubbed here — the real API is never hit in this spec,
 * so CI never depends on a third-party service being up.
 */
describe('poetry import', () => {
  beforeEach(() => {
    cy.resetPieces()
    cy.unlockAdmin()
  })

  it('fills the editor with an imported poem', () => {
    cy.intercept('GET', 'https://poetrydb.org/lines,random/*', {
      statusCode: 200,
      body: [
        {
          title: 'A Stubbed Sonnet',
          author: 'Some, Comma Author',
          lines: ['First line', 'Second line', '', 'Third line'],
          linecount: '3',
        },
      ],
    }).as('poetryReq')

    cy.get('input[placeholder*="mood or theme"]').type('moon')
    cy.contains('button', 'Find a poem').click()
    cy.wait('@poetryReq')

    cy.get('input[placeholder="Title"]').should('have.value', 'A Stubbed Sonnet')
    cy.contains('button', 'found').should('have.class', 'bg-sage')

    // Author name has a comma; it must not split into two tags.
    cy.get('input[placeholder="Tags (comma separated)"]')
      .invoke('val')
      .should('eq', 'Some Comma Author, poetrydb')

    cy.get('.ProseMirror').contains('First line')
    cy.get('.ProseMirror').contains('Third line')
  })

  it('shows an inline error when PoetryDB has no match, without crashing', () => {
    // PoetryDB's real "not found" response is HTTP 200 with a status:404
    // body, not a 404 status — the client must not treat 200 as success here.
    cy.intercept('GET', 'https://poetrydb.org/lines,random/*', {
      statusCode: 200,
      body: { status: 404, reason: 'Not found' },
    }).as('poetryReq')

    cy.get('input[placeholder*="mood or theme"]').type('zzzqqxnonsense')
    cy.contains('button', 'Find a poem').click()
    cy.wait('@poetryReq')

    cy.contains('No poems found for "zzzqqxnonsense"')
    cy.get('input[placeholder="Title"]').should('have.value', '')
  })
})
