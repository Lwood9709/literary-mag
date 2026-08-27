/**
 * /demo is public — no password, no lock screen. Its "Generate with AI" is
 * mocked client-side (never calls /api/generate) and "Publish" never calls
 * POST /api/pieces. Both intercepts below are stubbed rather than left as
 * passthrough, so even a regression that accidentally wires up a real call
 * can't spend money or touch real data — it would just get a fake response.
 */
describe('public editor demo', () => {
  beforeEach(() => {
    cy.resetPieces()

    cy.intercept('POST', '/api/generate', {
      statusCode: 500,
      body: { error: 'the demo must never call this' },
    }).as('generateSpy')

    cy.intercept('POST', '/api/pieces', {
      statusCode: 500,
      body: { error: 'the demo must never call this' },
    }).as('publishSpy')
  })

  it('is usable immediately, with no password prompt', () => {
    cy.visit('/demo')
    cy.get('input[type="password"]').should('not.exist')
    cy.get('input[placeholder="Title"]').should('be.visible')
    cy.contains('button', 'Publish (demo)').should('be.visible')
  })

  it('generates a mocked piece without ever calling /api/generate', () => {
    const knownTitles = ['Six A.M.', 'A Note on Patience', 'Directions to the Lake', 'Small Repairs']

    cy.visit('/demo')
    cy.contains('button', 'Generate with AI').click()

    // A real generation, not the trivially-passing default TipTap paragraph:
    // match one of the known canned titles, and check the body actually has
    // text (ProseMirror keeps an empty <p> even with nothing typed).
    cy.get('input[placeholder="Title"]', { timeout: 3000 })
      .invoke('val')
      .should((val) => expect(knownTitles).to.include(val))
    cy.get('.ProseMirror').invoke('text').should('have.length.greaterThan', 10)
    cy.get('@generateSpy.all').should('have.length', 0)
  })

  it('still runs the real PoetryDB flow, unaffected by the mock', () => {
    cy.intercept('GET', 'https://poetrydb.org/lines,random/*', {
      statusCode: 200,
      body: [{ title: 'A Stubbed Sonnet', author: 'Test Author', lines: ['One line'], linecount: '1' }],
    }).as('poetryReq')

    cy.visit('/demo')
    cy.get('input[placeholder*="mood or theme"]').type('winter')
    cy.contains('button', 'Find a poem').click()
    cy.wait('@poetryReq')
    cy.get('input[placeholder="Title"]').should('have.value', 'A Stubbed Sonnet')
  })

  it('publishing shows a preview and never calls POST /api/pieces', () => {
    cy.visit('/demo')
    cy.get('input[placeholder="Title"]').type('A Demo Draft')
    cy.get('.ProseMirror').type('Written just to look around.')
    cy.contains('button', 'Publish (demo)').click()

    cy.contains('Demo preview — nothing was published')
    cy.contains('h2', 'A Demo Draft')
    cy.get('@publishSpy.all').should('have.length', 0)
  })

  it('links back to the real magazine', () => {
    cy.visit('/demo')
    cy.contains('a', 'See the real magazine').click()
    cy.location('pathname').should('eq', '/')
  })

  it('is reachable from the home page footer', () => {
    cy.visit('/')
    cy.contains('a', 'Try the editor').click()
    cy.location('pathname').should('eq', '/demo')
  })
})
