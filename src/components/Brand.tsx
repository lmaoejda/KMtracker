export function Brand({ size = 26 }: { size?: number }) {
  return (
    <span className="brand">
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 20c4-9 9-13 14-13s10 4 12 11" />
          <path d="M7 23c3-6 7-9 11-9s8 3 10 8" />
          <path d="M11 26c2-3 5-5 7-5s5 2 6 4" />
        </g>
        <circle cx="24" cy="9" r="2.6" fill="#F2A93B" />
      </svg>
      <span>
        KM<b>tracker</b>
      </span>
    </span>
  );
}
