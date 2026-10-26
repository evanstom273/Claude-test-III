import type { CheckResult } from "../game/types";

export default function RollDisplay({ roll }: { roll: CheckResult }) {
  const success = roll.total >= roll.target;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {roll.dice.map((d, i) => (
        <span
          key={i}
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-500 bg-slate-100 font-bold text-slate-900"
        >
          {d}
        </span>
      ))}
      {roll.modifiers.map((m) => (
        <span key={m.label} className={m.value > 0 ? "text-emerald-400" : "text-rose-400"}>
          {m.value > 0 ? "+" : "−"}
          {Math.abs(m.value)} {m.label}
        </span>
      ))}
      <span className="text-slate-400">=</span>
      <span className="font-bold tabular-nums">{roll.total}</span>
      <span className="text-slate-400">vs {roll.target}</span>
      <span className={success ? "text-emerald-400" : "text-rose-400"}>{success ? "✓" : "✗"}</span>
    </div>
  );
}
