/**
 * Canned example output for the public /demo sandbox's "Generate with AI"
 * button. Never calls the real Claude API — a public, password-free button
 * hitting a costed endpoint would share the site's daily generation cap with
 * every visitor. See README.md's "Try the editor" section for the reasoning.
 */
export type DemoPiece = { title: string; body: string }

export const DEMO_PIECES: DemoPiece[] = [
  {
    title: 'Six A.M.',
    body: '<p>The kettle clicks off before it whistles.</p><p>Outside, the streetlight is still arguing with the sun about whose turn it is.</p><p>I choose neither and go back to bed.</p>',
  },
  {
    title: 'A Note on Patience',
    body: '<p>Bread needs time more than it needs you. Flour, water, salt — the rest is waiting, and waiting is a skill nobody teaches directly.</p><p>You learn it the way you learn most things: by ruining a few loaves first.</p>',
  },
  {
    title: 'Directions to the Lake',
    body: "<p>Turn left where the fence gives up.</p><p>Keep the tall pine on your right until you stop being able to see your own footprints behind you.</p><p>That's the lake. You'll know it by the quiet.</p>",
  },
  {
    title: 'Small Repairs',
    body: '<ul><li><p>Tighten the hinge before it starts singing.</p></li><li><p>Replace what rusts. Repaint what fades.</p></li><li><p>Some things you fix so they last. Some things you fix so you remember how.</p></li></ul>',
  },
]

/** Picks one at random, never the same as `exclude` when there's a choice. */
export function pickRandomDemoPiece(exclude?: string): DemoPiece {
  const candidates = DEMO_PIECES.filter((p) => p.title !== exclude)
  const pool = candidates.length > 0 ? candidates : DEMO_PIECES
  return pool[Math.floor(Math.random() * pool.length)]
}
