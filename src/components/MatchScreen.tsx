import { POSITIONS, ROLES, STYLES } from "../game/config";
import { findPlayer } from "../game/match";
import type { LogEntry, Side, Team } from "../game/types";
import { useMatch } from "../game/useMatch";
import { lazy, Suspense } from "react";
import { isLiveSituation } from "../game/match";
import DecisionPanel, { type MomentMode } from "./DecisionPanel";
import Lineups from "./Lineups";
import RollDisplay from "./RollDisplay";

// Phaser is big, so it only loads for the live-moments version.
const LiveMoment = lazy(() => import("../live/LiveMoment"));

const TONE: Record<LogEntry["tone"], string> = {
  neutral: "text-slate-300",
  good: "text-emerald-300",
  bad: "text-rose-300",
  goal: "font-bold text-amber-300",
  you: "font-semibold text-sky-300",
};

interface Props {
  sides: Record<Team, Side>;
  mode: MomentMode;
  onReplay: () => void;
  onQuit: () => void;
}

export default function MatchScreen({ sides, mode, onReplay, onQuit }: Props) {
  const { state, play, pause, act, finishLive } = useMatch(sides);
  const me = findPlayer(state, state.userId);
  const newestFirst = [...state.log].reverse();

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-xl bg-slate-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              You: {POSITIONS[me.position].label} · {ROLES[me.role].label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {sides.us.name} {state.score.us} – {state.score.them} {sides.them.name}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {sides.us.formation} {STYLES[sides.us.style].label} vs {sides.them.formation} {STYLES[sides.them.style].label}
              {" · "}Shots {state.shots.us}–{state.shots.them}
            </div>
          </div>
          <div className="text-3xl font-bold tabular-nums text-emerald-400">{state.minute}'</div>
        </div>
      </header>

      {state.situation && mode === "live" && isLiveSituation(state, state.situation) ? (
        <Suspense fallback={<div className="rounded-xl bg-slate-900 p-4 text-slate-400">Loading…</div>}>
          <LiveMoment key={state.nextLogId} state={state} onDone={finishLive} />
        </Suspense>
      ) : state.situation ? (
        <DecisionPanel key={state.nextLogId} state={state} situation={state.situation} mode={mode} onAct={act} />
      ) : state.finished ? (
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="text-lg font-semibold">Full time</div>
          <p className="mt-1 text-slate-400">
            You made {state.stats.rolls} rolls and came out on top in {state.stats.successes}.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={onReplay} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500">
              Play again
            </button>
            <button onClick={onQuit} className="rounded-lg border border-slate-600 px-4 py-2 hover:bg-slate-800">
              New setup
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {state.running ? (
            <button onClick={pause} className="rounded-lg border border-slate-600 px-4 py-2 hover:bg-slate-800">
              Pause
            </button>
          ) : (
            <button onClick={play} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500">
              {state.minute === 0 ? "Kick off" : "Continue"}
            </button>
          )}
          <button onClick={onQuit} className="rounded-lg px-4 py-2 text-slate-400 hover:text-slate-200">
            Quit
          </button>
        </div>
      )}

      <ol className="flex flex-col gap-2 rounded-xl bg-slate-900 p-4">
        {newestFirst.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{entry.minute}'</span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className={TONE[entry.tone]}>{entry.text}</span>
              {entry.roll && <RollDisplay roll={entry.roll} />}
            </div>
          </li>
        ))}
      </ol>

      <Lineups sides={[sides.us, sides.them]} />
    </div>
  );
}
