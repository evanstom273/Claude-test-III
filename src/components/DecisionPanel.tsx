import { SHOT_ZONES } from "../game/config";
import { choices, describe } from "../game/match";
import type { Action, GoalZone, Situation } from "../game/types";

const GOAL_GRID: GoalZone[] = ["topLeft", "topCentre", "topRight", "bottomLeft", "bottomCentre", "bottomRight"];

export default function DecisionPanel({ situation, onAct }: { situation: Situation; onAct: (a: Action) => void }) {
  return (
    <div className="rounded-xl border-2 border-amber-400/70 bg-slate-900 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">Clock stopped — your call</div>
      <p className="mt-2">{describe(situation)}</p>

      {situation.kind === "pickShot" ? (
        <div className="mt-3 grid max-w-md grid-cols-3 gap-1 border-x-4 border-t-4 border-slate-200 p-1">
          {GOAL_GRID.map((zone) => {
            const z = SHOT_ZONES[zone];
            return (
              <button
                key={zone}
                onClick={() => onAct({ kind: "shootAt", target: zone })}
                className="rounded bg-slate-800 px-2 py-3 text-sm transition hover:bg-emerald-700"
              >
                <div className="font-medium">{z.label}</div>
                <div className="text-xs text-slate-400">
                  on target {z.onTarget}+ · goal {z.beatsKeeper}+
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {choices(situation).map((choice) => (
            <button
              key={choice.label}
              onClick={() => onAct(choice.action)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 font-medium transition hover:border-emerald-500 hover:bg-slate-700"
            >
              {choice.label}
              {choice.target !== undefined && (
                <span className="ml-2 text-xs font-normal text-slate-400">{choice.target}+</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
