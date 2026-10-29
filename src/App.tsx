import { lazy, Suspense, useState } from "react";
import type { Side, Team } from "./game/types";
import type { ControlMode } from "./pitch/sim";
import Setup from "./components/Setup";

// Phaser is big, so it loads when the match starts.
const PitchMatch = lazy(() => import("./pitch/PitchMatch"));

export default function App() {
  const [match, setMatch] = useState<{ sides: Record<Team, Side>; mode: ControlMode } | null>(null);
  const [matchKey, setMatchKey] = useState(0);

  if (match) {
    return (
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">Loading…</div>}>
        <PitchMatch key={matchKey} sides={match.sides} mode={match.mode} onReplay={() => setMatchKey((k) => k + 1)} onQuit={() => setMatch(null)} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Setup onStart={(sides, mode) => setMatch({ sides, mode })} />
      </div>
    </div>
  );
}
