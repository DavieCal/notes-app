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
      {/* Spiral binding holes */}
      <circle cx="8"  cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="3" r="1" fill="currentColor" stroke="none" />
      {/* Notepad body */}
      <rect x="3" y="3" width="18" height="19" rx="2" />
      {/* Ruled lines */}
      <line x1="7" y1="9"  x2="17" y2="9"  />
      <line x1="7" y1="13" x2="17" y2="13" />
      <line x1="7" y1="17" x2="13" y2="17" />
    </svg>
  )
}
