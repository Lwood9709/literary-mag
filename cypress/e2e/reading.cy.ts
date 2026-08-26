describe('reading the magazine', () => {
  beforeEach(() => {
    cy.resetPieces()
    cy.visit('/')
  })

  it('lists pieces on load', () => {
    cy.contains('h1', 'Literary Mag')
    cy.contains('The Quiet Hour')
    cy.contains('A Note on Bread')
    cy.contains('Winter Soup')
    cy.contains('A Found Sonnet')
  })

  it('filters by type and updates the URL', () => {
    cy.contains('button', 'poem').click()
    cy.location('search').should('eq', '?type=poem')
    cy.contains('The Quiet Hour')
    cy.contains('A Note on Bread').should('not.exist')

    // clicking the active filter again clears it
    cy.contains('button', 'poem').click()
    cy.location('search').should('eq', '')
    cy.contains('A Note on Bread')
  })

  it('opens a piece and renders its body', () => {
    cy.contains('The Quiet Hour').click()
    cy.url().should('include', '/piece/')
    cy.contains('h1', 'The Quiet Hour')
    cy.contains('Light moves slowly across the floor.')
  })

  it('shows attribution on a found piece', () => {
    cy.contains('button', 'found').click()
    cy.contains('A Found Sonnet').click()
    cy.contains('Borrowed lines, kept whole.')
    cy.contains('Test Author, via PoetryDB')
  })
})
