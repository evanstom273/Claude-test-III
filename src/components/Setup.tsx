import { PLAYERS, POSITION_LABELS, statModifier } from "../game/config";
import type { Attributes, Position } from "../game/types";

const STAT_LABELS: Record<keyof Attributes, string> = {
  shooting: "Shooting",
  passing: "Passing",
  dribbling: "Dribbling",
  tackling: "Tackling",
  goalkeeping: "Goalkeeping",
};

export default function Setup({ onPick }: { onPick: (position: Position) => void }) {
  return (
    <div>
      <h1 className="text-3xl font-bold">Football Dice</h1>
      <p className="mt-1 text-slate-400">Pick who you're playing as.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(Object.keys(PLAYERS) as Position[]).map((position) => {
          const attrs = PLAYERS[position].attributes;
          return (
            <button
              key={position}
              onClick={() => onPick(position)}
              className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-left transition hover:border-emerald-500 hover:bg-slate-800"
            >
              <div className="text-lg font-semibold">{POSITION_LABELS[position]}</div>
              <dl className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-sm">
                {(Object.keys(attrs) as (keyof Attributes)[]).map((stat) => {
                  const mod = statModifier(attrs[stat]);
                  return (
                    <div key={stat} className="contents">
                      <dt className="text-slate-400">{STAT_LABELS[stat]}</dt>
                      <dd className="tabular-nums">{attrs[stat]}</dd>
                      <dd className={`tabular-nums ${mod > 0 ? "text-emerald-400" : mod < 0 ? "text-rose-400" : "text-slate-500"}`}>
                        {mod > 0 ? `+${mod}` : mod}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </button>
          );
        })}
      </div>
    </div>
  );
}
