/**
 * The TempTrack mark, redrawn as SVG.
 *
 * logo.png is a 200px raster on an opaque cream field, which would show a
 * visible box on any surface and cannot follow the theme. This redraws the same
 * shape — a map pin holding a thermometer — so it sits on the dark surface as
 * cleanly as the light one, and lets the wordmark inherit its color from the
 * page instead of being baked in.
 *
 * The pin stays the logo blue in both themes rather than lifting to --primary:
 * it is a filled shape, so it carries its own contrast, and shifting the brand
 * hue between themes would make the mark look like two different logos.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="TempTrack"
      className={className}
    >
      {/* Pin: a teardrop, circular through the shoulders and tapering to a point. */}
      <path
        d="M50 4
           C29.5 4 13 20.5 13 41
           C13 62 34 79 47.4 95.2
           a3.4 3.4 0 0 0 5.2 0
           C66 79 87 62 87 41
           C87 20.5 70.5 4 50 4 Z"
        fill="#257DA9"
      />
      {/* Thermometer: bulb, stem, and the mercury column, cut out of the pin. */}
      <g fill="none" stroke="#F8F7F3" strokeWidth="6.5" strokeLinecap="round">
        <path d="M50 20 v22" />
      </g>
      <circle cx="50" cy="53" r="11.5" fill="#F8F7F3" />
      <rect x="43.5" y="17" width="13" height="30" rx="6.5" fill="#F8F7F3" />
      <g fill="#D84838">
        <circle cx="50" cy="53" r="7" />
        <rect x="46.5" y="28" width="7" height="26" rx="3.5" />
      </g>
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[1.35rem] font-extrabold tracking-tight text-ink">TempTrack</span>
    </span>
  );
}
