export default function LogoMark(props: { className?: string }) {
  const { className } = props;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 760 140"
      className={className}
      role="img"
      aria-label="syllab.ai"
    >
      <g transform="translate(0,88)">
        <text
          x="0"
          y="6"
          fontFamily="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
          fontWeight="700"
          fontSize="56"
          fill="currentColor"
          className="text-zinc-50"
        >
          syllab
        </text>
        <text
          x="330"
          y="6"
          fontFamily="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
          fontWeight="700"
          fontSize="56"
          fill="currentColor"
          className="text-cyan-300"
        >
          .ai
        </text>
        <rect
          x="0"
          y="12"
          width="200"
          height="6"
          rx="3"
          fill="currentColor"
          className="text-cyan-300"
          opacity="0.15"
        />
      </g>
    </svg>
  );
}
