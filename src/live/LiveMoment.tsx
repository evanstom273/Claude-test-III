import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { liveCast, liveChance, type LiveOutcome } from "../game/match";
import type { MatchState } from "../game/types";
import { H, LiveScene, W } from "./LiveScene";

export default function LiveMoment({ state, onDone }: { state: MatchState; onDone: (o: LiveOutcome) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scene = new LiveScene({
      cast: liveCast(state),
      chance: (a, as, d, ds, t) => liveChance(state, a, as, d, ds, t),
      onDone: (outcome) => {
        if (finished) return;
        finished = true;
        timer = setTimeout(() => done.current(outcome), 900);
      },
    });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ref.current!,
      width: W,
      height: H,
      backgroundColor: "#14532d",
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
      scene,
    });
    return () => {
      clearTimeout(timer);
      game.destroy(true);
    };
    // The moment is set up once from the state it started in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border-2 border-amber-400/70 bg-slate-900 p-2">
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">Live — your move</div>
      <div ref={ref} className="mx-auto w-full max-w-[360px] touch-none select-none" style={{ aspectRatio: `${W} / ${H}` }} />
    </div>
  );
}
