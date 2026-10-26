import { useState } from "react";
import { PLAYERS } from "./game/config";
import type { Position } from "./game/types";
import Setup from "./components/Setup";
import MatchScreen from "./components/MatchScreen";

export default function App() {
  const [position, setPosition] = useState<Position | null>(null);
  const [matchKey, setMatchKey] = useState(0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {position ? (
          <MatchScreen
            key={matchKey}
            player={PLAYERS[position]}
            onReplay={() => setMatchKey((k) => k + 1)}
            onQuit={() => setPosition(null)}
          />
        ) : (
          <Setup onPick={setPosition} />
        )}
      </div>
    </div>
  );
}
