import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import type { Side, Team } from "../game/types";
import Lineups from "../components/Lineups";
import Controls from "./Controls";
import { PitchScene, type HudState } from "./PitchScene";
import { createSim, NO_INPUT, type ControlMode, type Input, type MatchEvent } from "./sim";

interface Props {
  sides: Record<Team, Side>;
  mode: ControlMode;
  onReplay: () => void;
  onQuit: () => void;
}

export default function PitchMatch({ sides, mode, onReplay, onQuit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const input = useRef<Input>({ ...NO_INPUT });
  const game = useRef<Phaser.Game | null>(null);
  const [hud, setHud] = useState<HudState>({ minute: 0, score: { us: 0, them: 0 }, phase: "kickoff", onBall: false, attacking: true, canTackle: false });
  const [toast, setToast] = useState<MatchEvent | null>(null);
  // Starts paused on a ready screen, so you know the controls before anything moves.
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const sim = createSim(sides, mode);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    const scene = new PitchScene({
      sim,
      input: input.current,
      onHud: setHud,
      onEvent: (e) => {
        if (e.kind === "halftime" || e.kind === "fulltime") return;
        setToast(e);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => setToast(null), e.kind === "goal" ? 2400 : 1100);
      },
    });
    const el = host.current!;
    const g = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      width: el.clientWidth * dpr,
      height: el.clientHeight * dpr,
      backgroundColor: "#30363d",
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      scene,
    });
    game.current = g;
    const resize = () => {
      g.scale.resize(el.clientWidth * dpr, el.clientHeight * dpr);
      g.scale.setZoom(1 / dpr);
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      clearTimeout(toastTimer);
      g.destroy(true);
    };
  }, [sides, mode]);

  useEffect(() => {
    if (!game.current) return;
    if (paused) game.current.pause();
    else game.current.resume();
  }, [paused]);

  const finished = hud.phase === "fulltime";

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-900 select-none" style={{ height: "100dvh" }}>
      <div ref={host} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3 rounded-full border border-white/15 bg-slate-950/75 px-4 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur">
          <span className="h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white/40" />
          <span className="tabular-nums">
            {hud.score.us} – {hud.score.them}
          </span>
          <span className="h-3 w-3 rounded-full bg-red-600 ring-2 ring-white/40" />
          <span className="tabular-nums text-emerald-300">{hud.minute}'</span>
        </div>
      </div>
      <button
        className="absolute right-3 top-2 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-white"
        style={{ marginTop: "env(safe-area-inset-top)" }}
        onClick={() => setPaused(true)}
      >
        Pause
      </button>

      {(toast || hud.phase === "kickoff" || hud.phase === "halftime") && !finished && (
        <div className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center">
          <div
            className={`rounded-2xl px-6 py-3 text-center font-extrabold text-white shadow-2xl ${
              toast?.kind === "goal" ? "bg-amber-500/90 text-3xl" : "bg-slate-950/70 text-lg"
            }`}
          >
            {toast ? toast.text : hud.phase === "halftime" ? "Half-time" : "Kick-off"}
          </div>
        </div>
      )}

      {started && !paused && !finished && <Controls input={input.current} hud={hud} mode={mode} />}

      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="flex max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-5 text-white shadow-2xl">
            <div className="text-xl font-bold">{mode === "player" ? "You're one player" : "You control the team"}</div>
            <p className="text-sm text-slate-300">
              {mode === "player"
                ? "You're the token with the white ring and YOU on it. Your teammates play themselves."
                : "You control whoever has the ball (gold ring). Your own player still has the white ring."}{" "}
              You're blue, attacking to the right.
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li>
                <b>Move:</b> put your left thumb anywhere on the left half and drag.
              </li>
              <li>
                <b>Pass:</b> aims at the teammate you're pushing towards.
              </li>
              <li>
                <b>Shoot:</b> hold for power, let go to shoot. Push up or down to aim for a corner.
              </li>
              <li>
                <b>Tackle:</b> when you're right next to whoever has the ball.
              </li>
              <li>{mode === "team" ? <><b>Switch:</b> jump to the player nearest the ball.</> : <><b>Call:</b> shout for the ball when a teammate has it.</>}</li>
            </ul>
            <p className="text-xs text-slate-400">Keyboard: arrows or WASD, J pass, hold K shoot, L tackle, {mode === "team" ? "Shift switch" : "C call"}.</p>
            <button
              onClick={() => {
                setStarted(true);
                setPaused(false);
              }}
              className="mt-1 rounded-xl bg-emerald-600 px-4 py-3 text-lg font-bold"
            >
              Kick off
            </button>
          </div>
        </div>
      )}

      {started && (paused || finished) && (
        <div className="absolute inset-0 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-md flex-col gap-3">
            <div className="text-center text-2xl font-bold text-white">{finished ? "Full time" : "Paused"}</div>
            <div className="text-center text-4xl font-extrabold tabular-nums text-white">
              {hud.score.us} – {hud.score.them}
            </div>
            {!finished && (
              <button onClick={() => setPaused(false)} className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white">
                Resume
              </button>
            )}
            <button onClick={onReplay} className="rounded-lg border border-white/20 px-4 py-2.5 font-semibold text-white">
              {finished ? "Play again" : "Restart match"}
            </button>
            <button onClick={onQuit} className="rounded-lg border border-white/20 px-4 py-2.5 text-white">
              New setup
            </button>
            <div className="rounded-lg bg-slate-900/80 p-3 text-xs leading-relaxed text-slate-300">
              <div className="mb-1 font-semibold text-white">Controls</div>
              Left thumb anywhere on the left half to move. On the ball: Pass (aims where you're pushing), hold Shoot for power.
              Without it: Tackle when you're close{mode === "team" ? ", Switch to change player" : ", Call to ask for it"}.
              Keyboard: arrows or WASD, J pass, hold K shoot, L tackle, {mode === "team" ? "Shift switch" : "C call"}.
            </div>
            <Lineups sides={[sides.us, sides.them]} />
          </div>
        </div>
      )}
    </div>
  );
}
