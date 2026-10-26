import { useState } from "react";
import type { Side, Team } from "./game/types";
import Setup from "./components/Setup";
import MatchScreen from "./components/MatchScreen";

export default function App() {
  const [sides, setSides] = useState<Record<Team, Side> | null>(null);
  const [matchKey, setMatchKey] = useState(0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {sides ? (
          <MatchScreen
            key={matchKey}
            sides={sides}
            onReplay={() => setMatchKey((k) => k + 1)}
            onQuit={() => setSides(null)}
          />
        ) : (
          <Setup onStart={setSides} />
        )}
      </div>
    </div>
  );
}
