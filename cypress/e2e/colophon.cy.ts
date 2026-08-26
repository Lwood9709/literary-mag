describe('colophon', () => {
  it('is reachable from the home page footer', () => {
    cy.resetPieces()
    cy.visit('/')
    cy.contains('a', 'Colophon').click()
    cy.url().should('include', '/colophon')
  })

  it('renders real test results and the recording', () => {
    cy.visit('/colophon')
    cy.contains('h1', 'Colophon')

    // Renders from the committed results.json, not hand-typed content.
    cy.contains(/\d+ of \d+ browser tests passing/)
    cy.contains('admin.cy.ts')
    cy.contains('reading the magazine')

    cy.get('video source, video[src]').should(($video) => {
      const src = $video.attr('src') ?? $video.find('source').attr('src')
      expect(src).to.include('/tests/suite.mp4')
    })
  })
})
