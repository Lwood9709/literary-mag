/**
 * Regression test for the `ignore`-flag cleanup in client/src/pages/Home.tsx.
 * Forces the "poem" request to resolve AFTER the "essay" request, then
 * asserts the essay response wins — proving the stale "poem" response was
 * correctly gated shut, not just that both requests eventually complete.
 *
 * This spec fails against the pre-fix code (see MISSION.md / lesson 0001):
 * remove the ignore flag from Home.tsx's effect and this test goes red.
 */
describe('race condition guard', () => {
  beforeEach(() => {
    cy.resetPieces()

    // Dynamic aliasing so each request is unambiguous, regardless of the
    // unfiltered request Home.tsx also fires on initial mount.
    cy.intercept('GET', '/api/pieces*', (req) => {
      if (req.query.type === 'poem') {
        req.alias = 'poemReq'
        req.continue((res) => { res.delay = 1500 })
      } else if (req.query.type === 'essay') {
        req.alias = 'essayReq'
        req.continue((res) => { res.delay = 50 })
      } else {
        req.alias = 'initialReq'
        req.continue()
      }
    })
  })

  it('a slow earlier response cannot overwrite a faster later one', () => {
    cy.visit('/')
    cy.wait('@initialReq')

    cy.contains('button', 'poem').click()
    // Click essay before the slow poem response has landed.
    cy.contains('button', 'essay').click()

    cy.wait('@essayReq')
    cy.wait('@poemReq', { timeout: 3000 })

    cy.contains('A Note on Bread')
    cy.contains('The Quiet Hour').should('not.exist')
    cy.location('search').should('eq', '?type=essay')
  })
})
