import { lazy, Suspense, useState } from "react";
import type { Side, Team } from "./game/types";
import Setup from "./components/Setup";
import MatchScreen from "./components/MatchScreen";
import type { MomentMode } from "./components/DecisionPanel";

const GridMatch = lazy(() => import("./grid/GridMatch"));

type Mode = MomentMode | "grid";

const MODES: { id: Mode; title: string; blurb: string }[] = [
  {
    id: "grid",
    title: "Grid tactics",
    blurb: "Top-down pitch of squares. Each turn, move up to three of your players one square; the AI moves the rest.",
  },
  {
    id: "skill",
    title: "Mini-games",
    blurb: "The match runs on its own. When it reaches you, pick what to do, then stop a timing bar instead of rolling dice.",
  },
  {
    id: "live",
    title: "Live moments",
    blurb: "The match runs on its own. When you're on the ball going forward, play it live: hold to run, flick to pass or shoot.",
  },
  {
    id: "dice",
    title: "Dice (what we had)",
    blurb: "The original: pick what to do, roll 2d6 with your stars against theirs.",
  },
];

export default function App() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [sides, setSides] = useState<Record<Team, Side> | null>(null);
  const [matchKey, setMatchKey] = useState(0);

  const quit = () => {
    setSides(null);
    setMode(null);
  };

  let screen;
  if (!mode) {
    screen = (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">Football Dice</h1>
          <p className="mt-1 text-slate-400">Three prototypes to try. Same squads, stars, formations and styles underneath.</p>
        </div>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-left transition hover:border-emerald-500"
          >
            <div className="text-lg font-semibold">{m.title}</div>
            <p className="mt-1 text-sm text-slate-400">{m.blurb}</p>
          </button>
        ))}
      </div>
    );
  } else if (!sides) {
    screen = <Setup onStart={setSides} onBack={() => setMode(null)} />;
  } else if (mode === "grid") {
    screen = (
      <Suspense fallback={<div className="text-slate-400">Loading…</div>}>
        <GridMatch key={matchKey} sides={sides} onReplay={() => setMatchKey((k) => k + 1)} onQuit={quit} />
      </Suspense>
    );
  } else {
    screen = <MatchScreen key={matchKey} sides={sides} mode={mode} onReplay={() => setMatchKey((k) => k + 1)} onQuit={quit} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6">{screen}</div>
    </div>
  );
}
