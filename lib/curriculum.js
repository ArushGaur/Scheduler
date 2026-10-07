// The whole class timetable lives here, in code. Nothing about classes is stored in the database:
// the database only remembers which elective a student picked, their routines and their attendance.
// Edit this file to change rooms or times. Rows are:
//   [code, subject, type, room, teacher, day, start, end]   (day: 0 = Sunday ... 6 = Saturday)
// Every class gets a stable id built from its code, type, day and start time (see classId below),
// so if you move a class to another day or time, attendance already saved for it will no longer match.

const [MON, TUE, WED, THU, FRI] = [1, 2, 3, 4, 5];

export const CORE_CLASSES = [
  // Fluid Mechanics
  ['CE2103', 'Fluid Mechanics', 'Lecture', 'R-104', 'OM', MON, '09:00', '09:55'],
  ['CE2103', 'Fluid Mechanics', 'Lecture', 'R-104', 'OM', TUE, '11:00', '11:55'],
  ['CE2103', 'Fluid Mechanics', 'Lecture', 'R-104', 'OM', WED, '09:00', '09:55'],
  ['CE2103', 'Fluid Mechanics', 'Tutorial', 'R-104', 'OM', TUE, '12:00', '12:55'],
  ['CE2103', 'Fluid Mechanics', 'Lab', '', 'OM', MON, '16:00', '18:00'],

  // Structural Mechanics
  ['CE2102', 'Structural Mechanics', 'Lecture', 'R-102', 'Nk / VS', MON, '15:00', '15:55'],
  ['CE2102', 'Structural Mechanics', 'Lecture', 'R-102', 'Nk / VS', TUE, '09:00', '09:55'],
  ['CE2102', 'Structural Mechanics', 'Lecture', 'R-104', 'Nk / VS', THU, '09:00', '09:55'],
  ['CE2102', 'Structural Mechanics', 'Tutorial', 'R-104', 'Nk / VS', THU, '10:00', '10:55'],

  // Geomatics Engineering
  ['CE2101', 'Geomatics Engineering', 'Lecture', 'R-102', 'AT', TUE, '15:00', '15:55'],
  ['CE2101', 'Geomatics Engineering', 'Lecture', 'LT-002', 'AT', WED, '10:00', '10:55'],
  ['CE2101', 'Geomatics Engineering', 'Lecture', 'R-104', 'AT', THU, '11:00', '11:55'],
  ['CE2101', 'Geomatics Engineering', 'Lab', '', 'AT', FRI, '08:00', '11:00'],

  // Geology for engineers
  ['CE2104', 'Geology for engineers', 'Lecture', 'R-104', 'AKV', MON, '11:00', '11:55'],
  ['CE2104', 'Geology for engineers', 'Lecture', 'R-104', 'AKV', WED, '11:00', '11:55'],
  ['CE2104', 'Geology for engineers', 'Lecture', 'R-104', 'AKV', FRI, '12:00', '12:55'],
  ['CE2104', 'Geology for engineers', 'Lab', '', 'AKV', TUE, '16:00', '18:00'],
];

// HSS electives. Each student picks exactly one.
export const ELECTIVES = {
  sociology: {
    key: 'sociology',
    name: 'Sociology',
    code: 'HS2111',
    classes: [
      ['HS2111', 'Sociology', 'HSS', 'LT001', '', TUE, '14:00', '15:00'],
      ['HS2111', 'Sociology', 'HSS', 'LT001', '', WED, '14:00', '15:00'],
      ['HS2111', 'Sociology', 'HSS', 'LT001', '', THU, '14:00', '15:00'],
    ],
  },
  language: {
    key: 'language',
    name: 'Language',
    code: 'HS2110',
    classes: [
      ['HS2110', 'Language', 'HSS', 'LT103', '', WED, '14:00', '15:00'],
      ['HS2110', 'Language', 'HSS', 'LT103', '', THU, '14:00', '15:00'],
      ['HS2110', 'Language', 'HSS', 'LT103', '', FRI, '14:00', '15:00'],
    ],
  },
  demography: {
    key: 'demography',
    name: 'Demography',
    code: 'HS2112',
    classes: [
      ['HS2112', 'Demography', 'HSS', 'LT103', '', TUE, '14:00', '15:00'],
      ['HS2112', 'Demography', 'HSS', 'LT003', '', WED, '14:00', '15:00'],
      ['HS2112', 'Demography', 'HSS', 'LT003', '', THU, '14:00', '15:00'],
    ],
  },
};

export const ELECTIVE_LIST = Object.values(ELECTIVES);
export const ELECTIVE_CODES = new Set(ELECTIVE_LIST.map((e) => e.code));

export const classId = (code, type, day, start) => `${code}_${String(type).toLowerCase().replace(/[^a-z0-9]/g, '')}_${day}_${start.replace(':', '')}`;

function toClass([code, subject, type, room, teacher, day, start, end]) {
  return {
    id: classId(code, type, day, start),
    code,
    subject,
    type,
    room: room || null,
    teacher: teacher || null,
    day_of_week: day,
    start_time: start,
    end_time: end,
  };
}

// Every class a student has: the shared timetable plus their elective (null if they have none yet).
export function classesFor(electiveKey) {
  const elective = ELECTIVES[electiveKey];
  return [...CORE_CLASSES, ...(elective ? elective.classes : [])]
    .map(toClass)
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
}

// Every built-in class for every elective (used by the owner tools to name and restore classes).
export function allBaseClasses() {
  return [...CORE_CLASSES, ...ELECTIVE_LIST.flatMap((e) => e.classes)].map(toClass);
}
