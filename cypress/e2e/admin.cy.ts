describe('admin', () => {
  beforeEach(() => {
    cy.resetPieces()
  })

  it('shows the lock screen at /admin', () => {
    cy.visit('/admin')
    cy.contains('h1', 'Admin')
    cy.contains('Publishing needs the password')
    cy.get('input[type="password"]').should('be.visible')
  })

  it('rejects a wrong password when attempting to publish', () => {
    cy.visit('/admin')
    cy.get('input[type="password"]').type('totally-wrong-password')
    cy.contains('button', 'Unlock').click()

    // Entering any password unlocks the local editor UI — the server only
    // checks the password when a write is actually attempted.
    cy.get('input[placeholder="Title"]').type('Should Not Save')
    cy.get('.ProseMirror').type('This will be rejected.')
    cy.contains('button', 'Publish').click()

    cy.contains('That password was not accepted.')
    cy.get('input[type="password"]').should('be.visible')
  })

  it('publishes a new piece with the correct password', () => {
    cy.unlockAdmin()

    cy.get('input[placeholder="Title"]').type('A Brand New Piece')
    cy.get('.ProseMirror').type('Written during the test run.')
    cy.contains('button', 'Publish').click()

    cy.url().should('include', '/piece/')
    cy.contains('h1', 'A Brand New Piece')

    cy.visit('/')
    cy.contains('A Brand New Piece')
  })

  it('deletes the piece being edited, from the editor itself', () => {
    cy.unlockAdmin()
    cy.contains('aside a', 'Winter Soup').click()
    cy.get('input[placeholder="Title"]').should('have.value', 'Winter Soup')

    cy.contains('button', 'Delete this piece').click()

    cy.location('search').should('eq', '')
    cy.contains('aside', 'Winter Soup').should('not.exist')
    cy.visit('/')
    cy.contains('Winter Soup').should('not.exist')
  })

  it('offers no delete control on a new draft', () => {
    cy.unlockAdmin()
    cy.contains('button', 'Delete this piece').should('not.exist')
  })

  it('deletes a piece from the sidebar', () => {
    cy.unlockAdmin()
    // No { force: true }: the delete button used to be invisible, and clicking
    // it unforced is what proves it is actually reachable.
    cy.contains('li', 'Winter Soup').find('button').click()
    cy.contains('Winter Soup').should('not.exist')

    cy.visit('/')
    cy.contains('Winter Soup').should('not.exist')
  })
})
