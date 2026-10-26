import { SHOT_ZONES } from "../game/config";
import { choices, describe, shotNeeds } from "../game/match";
import type { Action, GoalZone, MatchState, Situation } from "../game/types";

const GOAL_GRID: GoalZone[] = ["topLeft", "topCentre", "topRight", "bottomLeft", "bottomCentre", "bottomRight"];

interface Props {
  state: MatchState;
  situation: Situation;
  onAct: (a: Action) => void;
}

export default function DecisionPanel({ state, situation, onAct }: Props) {
  return (
    <div className="rounded-xl border-2 border-amber-400/70 bg-slate-900 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">Clock stopped — your call</div>
      <p className="mt-2">{describe(state, situation)}</p>

      {situation.kind === "pickShot" ? (
        <ShotPicker state={state} situation={situation} onAct={onAct} />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {choices(state, situation).map((choice) => (
            <button
              key={choice.label}
              onClick={() => onAct(choice.action)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 font-medium transition hover:border-emerald-500 hover:bg-slate-700"
            >
              {choice.label}
              {choice.needs !== undefined && (
                <span className="ml-2 text-xs font-normal text-slate-400">needs {choice.needs}+</span>
              )}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">"Needs" is what the two dice have to show once both players' stars are counted.</p>
    </div>
  );
}

function ShotPicker({ state, situation, onAct }: { state: MatchState; situation: Extract<Situation, { kind: "pickShot" }>; onAct: (a: Action) => void }) {
  const needs = shotNeeds(state, situation);
  return (
    <>
      <div className="mt-3 grid max-w-md grid-cols-3 gap-1 border-x-4 border-t-4 border-slate-200 p-1">
        {GOAL_GRID.map((zone) => {
          const n = needs(zone);
          return (
            <button
              key={zone}
              onClick={() => onAct({ kind: "shootAt", target: zone })}
              className="rounded bg-slate-800 px-2 py-3 text-sm transition hover:bg-emerald-700"
            >
              <div className="font-medium">{SHOT_ZONES[zone].label}</div>
              <div className="text-xs text-slate-400">
                on target {n.onTarget}+ · goal {n.goal}+
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">The keeper's guess adds or takes away 2 once you've picked.</p>
    </>
  );
}
