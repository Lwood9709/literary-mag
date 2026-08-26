import { defineConfig } from 'cypress'
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Featured in the /colophon showcase: the fullest single flow (lock screen,
// a rejected password, unlocking, publishing, and deleting). Cypress records
// one video per spec file, not one for the whole run, so this picks the most
// representative recording rather than requiring ffmpeg just to concatenate
// clips for a cosmetic showcase.
const FEATURED_SPEC = 'admin.cy.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4173',
    video: true,
    videoCompression: 32,
    viewportWidth: 1280,
    viewportHeight: 800,
    setupNodeEvents(on) {
      // Writes a small summary the /colophon page reads to show real results,
      // not a hand-maintained list that could drift from what actually ran.
      on('after:run', (results) => {
        if (!('totalTests' in results)) return

        const summary = {
          generatedAt: new Date().toISOString(),
          totalTests: results.totalTests,
          totalPassed: results.totalPassed,
          totalFailed: results.totalFailed,
          totalDuration: results.totalDuration,
          specs: results.runs.map((run) => ({
            spec: run.spec.name,
            tests: run.tests.map((t) => ({
              title: t.title.join(' > '),
              state: t.state,
              duration: t.duration,
            })),
          })),
        }

        const outDir = path.join(__dirname, 'client', 'public', 'tests')
        mkdirSync(outDir, { recursive: true })
        writeFileSync(
          path.join(outDir, 'results.json'),
          JSON.stringify(summary, null, 2)
        )

        const featured =
          results.runs.find((r) => r.spec.name === FEATURED_SPEC) ??
          results.runs.find((r) => r.video)
        if (featured?.video) {
          copyFileSync(featured.video, path.join(outDir, 'suite.mp4'))
        }
      })
    },
  },
})
