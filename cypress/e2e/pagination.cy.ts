/**
 * The test server seeds 14 pieces and the API pages at 10, so page 1 is full
 * and page 2 holds the remainder. Counting <li> elements rather than trusting
 * the "Page 1 of 2" label means a broken LIMIT fails here even if the label
 * still renders correctly.
 */
describe('pagination', () => {
  beforeEach(() => {
    cy.resetPieces()
    cy.visit('/')
  })

  it('shows one page worth of pieces and reports the page count', () => {
    cy.get('main ul > li').should('have.length', 10)
    cy.contains('Page 1 of 2')
  })

  it('cannot go back from the first page', () => {
    cy.contains('button', 'Newer').should('be.disabled')
    cy.contains('button', 'Older').should('not.be.disabled')
  })

  it('advances to the second page and back', () => {
    cy.contains('button', 'Older').click()

    cy.location('search').should('eq', '?page=2')
    cy.contains('Page 2 of 2')
    cy.get('main ul > li').should('have.length', 4)
    cy.contains('button', 'Older').should('be.disabled')

    cy.contains('button', 'Newer').click()
    cy.location('search').should('eq', '')
    cy.get('main ul > li').should('have.length', 10)
  })

  it('serves page 2 directly from the URL', () => {
    cy.visit('/?page=2')
    cy.contains('Page 2 of 2')
    cy.get('main ul > li').should('have.length', 4)
  })

  it('no piece appears on both pages', () => {
    const seen: string[] = []
    cy.get('main ul > li h2').each(($h) => { seen.push($h.text()) })

    cy.contains('button', 'Older').click()
    cy.get('main ul > li h2').each(($h) => {
      expect(seen, `"${$h.text()}" already appeared on page 1`).not.to.include($h.text())
    })
  })

  it('drops the page when the filter changes', () => {
    cy.visit('/?page=2')
    cy.contains('button', 'poem').click()

    cy.location('search').should('eq', '?type=poem')
    cy.contains('The Quiet Hour')
  })

  it('hides the controls when a filter fits on one page', () => {
    cy.contains('button', 'poem').click()
    cy.contains('Page 1 of').should('not.exist')
  })
})
