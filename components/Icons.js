const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const make = (children) =>
  function Icon({ size, ...rest }) {
    return (
      <svg {...base} {...(size ? { width: size, height: size } : {})} {...rest}>
        {children}
      </svg>
    );
  };

export const IconDay = make(
  <>
    <rect x="4" y="5" width="16" height="15" rx="3.5" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </>
);
export const IconExam = make(
  <>
    <path d="M7 3.5h8l3.5 3.5v13a1 1 0 01-1 1h-10.5a1 1 0 01-1-1v-15.5a1 1 0 011-1z" />
    <path d="M14.5 3.5V7.5h4M9 12h6M9 15.5h6" />
  </>
);
export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>
);
export const IconPin = make(
  <>
    <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 10-13 0c0 5.4 6.5 11 6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </>
);
export const IconChart = make(<path d="M5 20v-9M12 20V5M19 20v-6" />);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconCheck = make(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IconX = make(<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />);
export const IconLeft = make(<path d="M14.5 6l-6 6 6 6" />);
export const IconRight = make(<path d="M9.5 6l6 6-6 6" />);
export const IconTrash = make(<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />);
export const IconInstall = make(<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />);
export const IconPencil = make(<path d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17z" />);

export function Brand({ size = 40 }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="brand-mark" src="/mark.png" alt="Timetable" width={size} height={size} />;
}
