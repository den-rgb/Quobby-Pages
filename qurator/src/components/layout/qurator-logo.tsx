export function QuratorLogo({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* Left page */}
      <path
        d="M5 6.2c0-1.2 1-2.2 2.2-2.2H16v18.4c-1.7-.6-3.5-.9-5.8-.9-2.2 0-4.4.5-5.2 1.3V6.2Z"
        fill="#b8ff6b"
        stroke="#a1306b"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* Right page */}
      <path
        d="M27 6.2c0-1.2-1-2.2-2.2-2.2H16v18.4c1.7-.6 3.5-.9 5.8-.9 2.2 0 4.4.5 5.2 1.3V6.2Z"
        fill="#b8ff6b"
        stroke="#a1306b"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* Spine */}
      <path
        d="M16 4.2v18.2"
        stroke="#a1306b"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Notepad lines */}
      <path
        d="M19.2 9.2h6.2M19.2 12.6h6.2M19.2 16h4.6"
        stroke="#a1306b"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Eyes */}
      <circle cx="9.4" cy="13.1" r="1.65" fill="#a1306b" />
      <circle cx="13.1" cy="13.1" r="1.65" fill="#a1306b" />
      <circle cx="9.75" cy="12.7" r="0.5" fill="#fff" />
      <circle cx="13.45" cy="12.7" r="0.5" fill="#fff" />
    </svg>
  );
}
