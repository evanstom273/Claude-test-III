import { useEffect, useRef, useState } from "react";

/**
 * A marker sweeps back and forth; stop it as close to the middle as you can.
 * Stopping at random gives exactly the dice odds, so your stars still set the target and timing replaces the luck.
 */
export default function TimingMeter({ prompt, periodMs, onDone }: { prompt: string; periodMs: number; onDone: (quantile: number) => void }) {
  const [pos, setPos] = useState(0);
  const [stopped, setStopped] = useState<number | null>(null);
  const start = useRef(performance.now());

  useEffect(() => {
    if (stopped !== null) return;
    let frame = 0;
    const loop = (now: number) => {
      const phase = ((now - start.current) % periodMs) / periodMs;
      setPos(phase < 0.5 ? phase * 2 : 2 - phase * 2);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [stopped, periodMs]);

  function stop() {
    if (stopped !== null) return;
    const quality = 1 - Math.abs(pos - 0.5) * 2;
    setStopped(quality);
    setTimeout(() => onDone(quality), 650);
  }

  return (
    <div className="mt-3 select-none" onPointerDown={stop}>
      <div className="mb-2 text-sm text-slate-300">{prompt}</div>
      <div className="relative h-10 cursor-pointer overflow-hidden rounded-lg bg-gradient-to-r from-rose-700 via-emerald-500 to-rose-700">
        <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white/80" />
        <div className="absolute inset-y-0 w-2 -translate-x-1/2 rounded bg-slate-950 ring-2 ring-white" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="mt-2 h-5 text-sm">
        {stopped === null ? (
          <span className="text-slate-400">Tap anywhere on the bar to stop it.</span>
        ) : (
          <span className={stopped > 0.66 ? "text-emerald-300" : stopped > 0.33 ? "text-amber-300" : "text-rose-300"}>
            Timing {Math.round(stopped * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}
