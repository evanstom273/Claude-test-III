import { SHOT_ZONES, ZONE_LABELS } from "../game/config";
import type { Action, DiveDirection, GoalZone, Situation } from "../game/types";

const btn =
  "rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 font-medium transition hover:border-emerald-500 hover:bg-slate-700";

const GOAL_GRID: GoalZone[] = ["topLeft", "topCentre", "topRight", "bottomLeft", "bottomCentre", "bottomRight"];

export default function DecisionPanel({ situation, onAct }: { situation: Situation; onAct: (a: Action) => void }) {
  return (
    <div className="rounded-xl border-2 border-amber-400/70 bg-slate-900 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">Clock stopped — your call</div>

      {situation.kind === "onBall" && (
        <>
          <p className="mt-2">You're on the ball in {ZONE_LABELS[situation.zone]}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btn} onClick={() => onAct({ kind: "pass" })}>Pass</button>
            <button className={btn} onClick={() => onAct({ kind: "dribble" })}>Dribble</button>
            {(situation.zone === "finalThird" || situation.zone === "box") && (
              <button className={btn} onClick={() => onAct({ kind: "shoot" })}>Shoot</button>
            )}
          </div>
        </>
      )}

      {situation.kind === "pickShot" && (
        <>
          <p className="mt-2">Where are you putting it?</p>
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
        </>
      )}

      {situation.kind === "defending" && (
        <>
          <p className="mt-2">They're running at you.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btn} onClick={() => onAct({ kind: "tackle" })}>Tackle</button>
          </div>
        </>
      )}

      {situation.kind === "facingShot" && (
        <>
          <p className="mt-2">Which way are you going?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["left", "centre", "right"] as DiveDirection[]).map((direction) => (
              <button key={direction} className={btn} onClick={() => onAct({ kind: "dive", direction })}>
                {direction === "centre" ? "Stay central" : `Dive ${direction}`}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
