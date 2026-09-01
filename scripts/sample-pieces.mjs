/**
 * The sample pieces used by seed-samples.mjs. Kept in their own file so the
 * seeder and the undo path read the same list, and so removing an entry here
 * can never orphan a row the undo pass no longer knows to delete.
 */
export const SAMPLE_PIECES = [
  {
    title: 'Six A.M.',
    type: 'poem',
    tags: 'morning, quiet',
    body: '<p>The kettle ticks itself awake.<br>Outside, the street is still deciding.</p><p>I have nothing to say yet.<br>Neither does the light.</p>',
  },
  {
    title: 'A Note on Patience',
    type: 'essay',
    tags: 'craft',
    body: '<p>Everything worth reading was rewritten. The first version exists to be argued with, and the argument is the work.</p><p>This is inconvenient, because the first version always feels finished.</p>',
  },
  {
    title: 'Directions to the Lake',
    type: 'prose',
    tags: 'summer, memory',
    body: '<p>Past the mailbox with no name. Left where the road gives up on being paved.</p><p>You will know it because the trees stop arguing and the noise turns into water.</p>',
  },
  {
    title: 'Small Repairs',
    type: 'prose',
    tags: 'house, hands',
    body: '<p>A hinge, a hem, a handle that had come loose in the spring. None of it urgent. All of it waiting.</p><p>Saturday is for the things that were never going to fix themselves.</p>',
  },
  {
    title: 'Winter Stock',
    type: 'recipe',
    tags: 'dinner, slow',
    body: '<p>Onion, carrot, celery, the ends of things you were going to throw away.</p><ul><li><p>Cover with cold water.</p></li><li><p>Bring it just short of a boil.</p></li><li><p>Leave it alone for four hours.</p></li></ul><p>Salt at the end, never at the start.</p>',
  },
  {
    title: 'The Second Cup',
    type: 'poem',
    tags: 'morning',
    body: '<p>The first is for waking.<br>The second is for meaning it.</p>',
  },
  {
    title: 'What the House Keeps',
    type: 'story',
    tags: 'family',
    body: '<p>The drawer nobody opens holds three keys, none of which fit anything still standing.</p><p>My grandmother could have told you which door each one belonged to. That was the whole inheritance, and nobody thought to write it down.</p>',
  },
  {
    title: 'On Rereading',
    type: 'essay',
    tags: 'reading',
    body: '<p>A book you loved at nineteen is a letter from someone who no longer exists, and you are the only one who can still read the handwriting.</p>',
  },
  {
    title: 'Bread, Again',
    type: 'recipe',
    tags: 'food, slow',
    body: '<p>Flour, water, salt, and time. The time is the ingredient people skip.</p><ul><li><p>Mix until shaggy. Rest twenty minutes.</p></li><li><p>Fold four times, an hour apart.</p></li><li><p>Overnight in the cold.</p></li></ul>',
  },
  {
    title: 'Inventory',
    type: 'poem',
    tags: 'autumn',
    body: '<p>Two pears going soft.<br>A radio nobody tunes.<br>The good scissors, finally found.</p>',
  },
  {
    title: 'The Long Way Round',
    type: 'story',
    tags: 'travel',
    body: '<p>He missed the turn on purpose, which is different from getting lost, though the map cannot tell them apart.</p><p>By the time the road came back to itself it was dark, and he had stopped counting the difference.</p>',
  },
  {
    title: 'Against Tidiness',
    type: 'essay',
    tags: 'craft',
    body: '<p>A finished room tells you nothing about the person. A desk mid-argument tells you everything.</p>',
  },
  {
    title: 'Rain, Thursday',
    type: 'poem',
    tags: 'weather',
    body: '<p>It started without announcing itself,<br>the way most things do.</p><p>By noon the gutters were speaking in full sentences.</p>',
  },
  {
    title: 'A Loaf for the Neighbours',
    type: 'prose',
    tags: 'food, kindness',
    body: '<p>You do not knock. You leave it on the step, still warm, and let them decide what it means.</p>',
  },
  {
    title: 'Notes Toward a Kitchen',
    type: 'essay',
    tags: 'food',
    body: '<p>Every good kitchen is organised around one person\u2019s laziness. Find out which drawer they open first and you will understand the whole room.</p>',
  },
  {
    title: 'Closing Up',
    type: 'story',
    tags: 'work, evening',
    body: '<p>The last hour of a shift is longer than the other seven put together, and everyone who has worked one knows it is not a figure of speech.</p>',
  },
]
