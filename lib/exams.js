// End-semester exam schedule. Edit this file to add or change exams.
// Rows are: [code, date (YYYY-MM-DD), session, location]
// Leave the location as '' until you know it; the app shows "Location to be announced".
// Only exams for courses on the student's own timetable are shown (their elective included).

export const SESSIONS = {
  morning: { label: 'Morning', start: '09:30', end: '12:30' },
  evening: { label: 'Evening', start: '15:00', end: '18:00' },
};

// Rows: [code, date, session, location, type]
//   date: 'YYYY-MM-DD', or '' if not announced yet
//   session: 'morning' | 'evening', or '' if the time is not announced yet
//   type: 'Theory' or 'Lab'
export const EXAMS = [
  // Lab exams
  ['CE2104', '2026-11-03', '', '', 'Lab'], // Geology for engineers
  ['CE2101', '2026-11-12', '', '', 'Lab'], // Geomatics Engineering
  ['CE2103', '', '', '', 'Lab'], // Fluid Mechanics (date to be announced)

  // Theory exams
  ['CE2101', '2026-11-22', 'morning', '', 'Theory'], // Geomatics Engineering
  ['HS2110', '2026-11-23', 'morning', '', 'Theory'], // Language
  ['HS2111', '2026-11-23', 'morning', '', 'Theory'], // Sociology
  ['HS2112', '2026-11-23', 'morning', '', 'Theory'], // Demography
  ['CE2102', '2026-11-25', 'morning', '', 'Theory'], // Structural Mechanics
  ['CE2103', '2026-11-27', 'morning', '', 'Theory'], // Fluid Mechanics
  ['CE2104', '2026-11-28', 'morning', '', 'Theory'], // Geology for engineers
];

// Dates the institute is closed during the exam period (kept for reference).
export const EXAM_HOLIDAYS = { '2026-11-24': 'Guru Nanak Jayanti' };

// subjects: [{ code, subject }] from the student's timetable.
// Exams without a date yet go last.
export function examsFor(subjects) {
  const byCode = new Map(subjects.map((s) => [s.code, s.subject]));
  return EXAMS.filter(([code]) => byCode.has(code))
    .map(([code, date, session, location, type]) => ({
      id: `${code}_${type}_${date || 'tba'}`,
      code,
      type: type || 'Theory',
      subject: byCode.get(code),
      date: date || null,
      session: session || null,
      start_time: session ? SESSIONS[session].start : null,
      end_time: session ? SESSIONS[session].end : null,
      location: location || null,
    }))
    .sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || ''));
}
