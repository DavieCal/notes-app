export default function NotepadIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Notepad body */}
      <rect x="4" y="3" width="16" height="18" rx="2" fill="none" />
      {/* Spiral binding marks at top */}
      <path d="M9 3v3M15 3v3" stroke="currentColor" fill="none" />
      {/* Ruled lines */}
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="16" y2="15" />
      <line x1="8" y1="19" x2="13" y2="19" />
    </svg>
  )
}
