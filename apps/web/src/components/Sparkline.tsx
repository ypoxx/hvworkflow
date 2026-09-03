/**
 * A trend in the space of a word — one accent line, one soft fill, no axes to read: for a console
 * that must stay dense without turning into a dashboard (docs/design-prinzipien.md, "Konsole, nicht
 * Dashboard").
 */
export interface SparklineProps {
  values: number[];
  /** Accessible name; the SVG carries no visible legend. */
  ariaLabel: string;
  className?: string;
}

const WIDTH = 100;
const HEIGHT = 28;

export function Sparkline({ values, ariaLabel, className }: SparklineProps) {
  if (values.length < 2) {
    return <svg role="img" aria-label={ariaLabel} className={className} width="100%" height={HEIGHT} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = WIDTH / (values.length - 1);
  const line = values
    .map((value, i) => `${i * step},${HEIGHT - ((value - min) / span) * HEIGHT}`)
    .join(' ');
  const area = `0,${HEIGHT} ${line} ${WIDTH},${HEIGHT}`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      className={className}
      width="100%"
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
    >
      <polygon points={area} fill="var(--color-accent-500)" fillOpacity="0.1" stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-accent-500)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
