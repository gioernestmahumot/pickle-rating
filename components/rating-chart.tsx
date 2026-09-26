/** Rating over time as a small line chart (server-rendered SVG, no chart library). */
export function RatingChart({ points, label }: { points: { rating: number; at: string }[]; label: string }) {
  if (points.length < 2) {
    return <p className="muted py-6 text-center">Play a couple of rated matches to see a trend.</p>;
  }
  const width = 600;
  const height = 160;
  const pad = { top: 12, right: 8, bottom: 20, left: 40 };
  const ratings = points.map((p) => p.rating);
  const min = Math.floor((Math.min(...ratings) - 10) / 25) * 25;
  const max = Math.ceil((Math.max(...ratings) + 10) / 25) * 25;
  const x = (i: number) => pad.left + (i / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (rating: number) => pad.top + (1 - (rating - min) / (max - min)) * (height - pad.top - pad.bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const ticks = [min, Math.round((min + max) / 2), max];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: from ${points[0].rating} to ${last.rating} over ${points.length - 1} matches`} className="h-auto w-full">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeDasharray="3 4" />
          <text x={pad.left - 6} y={y(tick) + 4} textAnchor="end" fontSize="11" className="fill-ink-3">{tick}</text>
        </g>
      ))}
      <path d={line} fill="none" className="stroke-link" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.rating)} r="4.5" className="fill-accent stroke-link" strokeWidth="2" />
      <text x={pad.left} y={height - 4} fontSize="11" className="fill-ink-3">first match</text>
      <text x={width - pad.right} y={height - 4} fontSize="11" className="fill-ink-3" textAnchor="end">latest</text>
    </svg>
  );
}
