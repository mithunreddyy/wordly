import type { SVGProps } from 'react';

// One stroke weight and square caps, drawn to sit beside 15px semibold labels.
function Glyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const RulesIcon = () => (
  <Glyph>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14" />
    <path d="M12 17.5v.5" />
  </Glyph>
);

export const ArchiveIcon = () => (
  <Glyph>
    <rect x="3.5" y="5" width="17" height="15" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M8 14h2M14 14h2M8 17h2" />
  </Glyph>
);

export const StatsIcon = () => (
  <Glyph>
    <path d="M5 20V12M12 20V5M19 20v-5" />
    <path d="M3 20h18" />
  </Glyph>
);

export const SettingsIcon = () => (
  <Glyph>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <path d="M14 5v4h4V5zM8 15v4h4v-4z" />
  </Glyph>
);

export const ChevronLeft = () => (
  <Glyph width="18" height="18">
    <path d="M15 5l-7 7 7 7" />
  </Glyph>
);

export const ChevronRight = () => (
  <Glyph width="18" height="18">
    <path d="M9 5l7 7-7 7" />
  </Glyph>
);
