const ExportIcon = ({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.5,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-label="Save to file"
    role="img"
    {...props}
  >
    <path d="M2 22V2h7l4 4v16H2z" />
    <path d="M9 2v4h4" />
    <path d="M14 12h8" />
    <path d="M19 9l3 3-3 3" />
  </svg>
)

export default ExportIcon
