// Saves a person's HSS elective, using the same rules and database as the app (Turso, or local.db
// when the Turso variables are empty). Classes and rooms are read from lib/curriculum.js, not stored.
//
//   npm run seed -- you@gmail.com [sociology | language | demography]
//
// Use the Gmail address you sign in with. Safe to run twice.
// Rooms, times and electives live in lib/curriculum.js.
import { startTimetable } from '../lib/actions.js';
import { ELECTIVES } from '../lib/curriculum.js';

const EMAIL = (process.argv[2] || '').trim().toLowerCase();
const ELECTIVE = (process.argv[3] || 'sociology').trim().toLowerCase();

if (!EMAIL.includes('@') || !ELECTIVES[ELECTIVE]) {
  console.error(`Usage:  npm run seed -- you@gmail.com [${Object.keys(ELECTIVES).join(' | ')}]`);
  process.exit(1);
}

startTimetable(EMAIL, ELECTIVE)
  .then(() => console.log(`Done. ${EMAIL} now has the elective ${ELECTIVES[ELECTIVE].name}.`))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
