export function PickleballLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Ball */}
      <circle cx="14" cy="14" r="13" fill="#a3e635" />
      <circle cx="14" cy="14" r="13" stroke="#84cc16" strokeWidth="0.8" />

      {/* Holes — scattered in a realistic pickleball pattern */}
      <circle cx="9"  cy="9"  r="1.4" fill="#65a30d" />
      <circle cx="14" cy="8"  r="1.4" fill="#65a30d" />
      <circle cx="19" cy="9"  r="1.4" fill="#65a30d" />
      <circle cx="7"  cy="14" r="1.4" fill="#65a30d" />
      <circle cx="12" cy="13" r="1.4" fill="#65a30d" />
      <circle cx="17" cy="14" r="1.4" fill="#65a30d" />
      <circle cx="21" cy="14" r="1.4" fill="#65a30d" />
      <circle cx="9"  cy="19" r="1.4" fill="#65a30d" />
      <circle cx="14" cy="20" r="1.4" fill="#65a30d" />
      <circle cx="19" cy="19" r="1.4" fill="#65a30d" />
    </svg>
  );
}
