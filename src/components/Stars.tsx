/** 0–5 stars with half steps: grey stars underneath, gold ones clipped to the rating on top. */
export default function Stars({ value }: { value: number }) {
  return (
    <span className="relative inline-block whitespace-nowrap text-sm leading-none tracking-tight" aria-label={`${value} stars`}>
      <span className="text-slate-700">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${(value / 5) * 100}%` }}>
        ★★★★★
      </span>
    </span>
  );
}
