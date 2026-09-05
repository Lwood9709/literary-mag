/**
 * The test server seeds 14 pieces: ten prose "Filler Piece NN" rows plus four
 * named ones. Searches below target words that appear in exactly one of the
 * named pieces, so a wrong result is unambiguous rather than plausible.
 */
describe('search', () => {
  beforeEach(() => {
    cy.resetPieces()
    cy.visit('/')
  })

  function search(term: string) {
    cy.get('input[type="search"]').clear().type(term)
    cy.contains('button', 'Search').click()
  }

  it('narrows the collection and records the query in the URL', () => {
    search('flour')

    cy.location('search').should('eq', '?q=flour')
    cy.get('main ul > li').should('have.length', 1)
    cy.contains('h2', 'A Note on Bread')
  })

  it('matches body text, not just titles', () => {
    // "Onion" appears only inside Winter Soup's list markup, never in a title.
    search('onion')
    cy.get('main ul > li').should('have.length', 1)
    cy.contains('h2', 'Winter Soup')
  })

  it('reports how many matched, and clears back to everything', () => {
    search('placeholder')
    cy.contains('10 pieces matching "placeholder"')

    cy.contains('button', 'clear').click()
    cy.location('search').should('eq', '')
    cy.get('main ul > li').should('have.length', 10)
    cy.contains('h2', 'A Note on Bread')
  })

  it('says so when nothing matches', () => {
    search('zzyzx')
    cy.contains('Nothing here matches')
    cy.get('main ul > li').should('have.length', 0)
  })

  /**
   * Every piece body is wrapped in <p>, and Winter Soup uses <ul> and <li>.
   * If the raw HTML were indexed instead of the stripped text, these would
   * match everything. This is the assertion that would catch that.
   */
  it('does not match HTML tag names', () => {
    for (const tag of ['p', 'ul', 'li']) {
      search(tag)
      cy.contains('Nothing here matches')
    }
  })

  it('survives a half-typed query instead of erroring', () => {
    for (const junk of ['"unbalanced', 'bread AND', '((']) {
      search(junk)
      cy.get('main').should('exist')
      cy.contains('Could not load the collection').should('not.exist')
    }
  })

  it('serves a search directly from the URL', () => {
    cy.visit('/?q=borrowed')
    cy.get('input[type="search"]').should('have.value', 'borrowed')
    cy.contains('h2', 'A Found Sonnet')
  })

  it('combines with the type filter', () => {
    cy.visit('/?q=placeholder')
    cy.get('main ul > li').should('have.length', 10)

    cy.contains('button', 'poem').click()
    cy.location('search').should('include', 'q=placeholder')
    cy.location('search').should('include', 'type=poem')
    cy.contains('Nothing here matches')
  })
})

describe('tag filtering', () => {
  beforeEach(() => {
    cy.resetPieces()
    cy.visit('/')
  })

  it('filters by a tag when its chip is clicked', () => {
    cy.contains('li', 'A Note on Bread').contains('button', 'food').click()

    cy.location('search').should('eq', '?tag=food')
    cy.get('main ul > li').should('have.length', 1)
    cy.contains('h2', 'A Note on Bread')
    cy.contains('1 piece tagged "food"')
  })

  it('clears back to the full collection', () => {
    cy.contains('li', 'Winter Soup').contains('button', 'dinner').click()
    cy.get('main ul > li').should('have.length', 1)

    cy.contains('button', 'clear').click()
    cy.location('search').should('eq', '')
    cy.get('main ul > li').should('have.length', 10)
  })
})
