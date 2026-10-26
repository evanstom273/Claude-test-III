import { POSITION_LABELS } from "../game/config";
import type { LogEntry, Player } from "../game/types";
import { useMatch } from "../game/useMatch";
import DecisionPanel from "./DecisionPanel";
import RollDisplay from "./RollDisplay";

const TONE: Record<LogEntry["tone"], string> = {
  neutral: "text-slate-300",
  good: "text-emerald-300",
  bad: "text-rose-300",
  goal: "font-bold text-amber-300",
  you: "font-semibold text-sky-300",
};

interface Props {
  player: Player;
  onReplay: () => void;
  onQuit: () => void;
}

export default function MatchScreen({ player, onReplay, onQuit }: Props) {
  const { state, play, pause, act } = useMatch(player);
  const newestFirst = [...state.log].reverse();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between rounded-xl bg-slate-900 p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Playing as {POSITION_LABELS[player.position]}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            Your side {state.score.us} – {state.score.them} The opposition
          </div>
        </div>
        <div className="text-3xl font-bold tabular-nums text-emerald-400">{state.minute}'</div>
      </header>

      {state.situation ? (
        <DecisionPanel situation={state.situation} onAct={act} />
      ) : state.finished ? (
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="text-lg font-semibold">Full time</div>
          <p className="mt-1 text-slate-400">
            You made {state.stats.rolls} rolls and succeeded on {state.stats.successes}.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={onReplay} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500">
              Play again
            </button>
            <button onClick={onQuit} className="rounded-lg border border-slate-600 px-4 py-2 hover:bg-slate-800">
              Change position
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
            <div className="flex flex-col gap-1">
              <span className={TONE[entry.tone]}>{entry.text}</span>
              {entry.roll && <RollDisplay roll={entry.roll} />}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
