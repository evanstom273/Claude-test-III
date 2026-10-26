import type { CheckResult } from "../game/types";
import { passed } from "../game/dice";

export default function RollDisplay({ roll }: { roll: CheckResult }) {
  const success = passed(roll);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="text-slate-500">{roll.roller === "You" ? "You roll" : `${roll.roller} rolls`}</span>
      {roll.dice.map((d, i) => (
        <span
          key={i}
          className="grid h-7 w-7 place-items-center rounded-md border border-slate-500 bg-slate-100 font-bold text-slate-900"
        >
          {d}
        </span>
      ))}
      {roll.modifiers.map((m) => (
        <span key={m.label} className={m.value > 0 ? "text-emerald-400" : "text-rose-400"}>
          {m.value > 0 ? "+" : "−"}
          {Math.abs(m.value)} <span className="opacity-80">{m.label}</span>
        </span>
      ))}
      <span className="text-slate-400">=</span>
      <span className="font-bold tabular-nums">{roll.total}</span>
      <span className="text-slate-400">vs {roll.target}</span>
      {roll.crit && (
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${roll.crit === "success" ? "bg-emerald-700" : "bg-rose-800"}`}>
          {roll.crit === "success" ? "Double six!" : "Snake eyes!"}
        </span>
      )}
      <span className={success ? "text-emerald-400" : "text-rose-400"}>{success ? "✓" : "✗"}</span>
    </div>
  );
}
