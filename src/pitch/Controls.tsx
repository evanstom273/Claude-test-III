import { useEffect, useRef, useState } from "react";
import type { Input } from "./sim";
import type { HudState } from "./PitchScene";

const KNOB_RANGE = 52;

/** Floating joystick: put your thumb down anywhere on the left half and drag. */
function Joystick({ input }: { input: Input }) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);

  const update = (e: React.PointerEvent, o: { x: number; y: number }) => {
    let dx = e.clientX - o.x;
    let dy = e.clientY - o.y;
    const d = Math.hypot(dx, dy);
    if (d > KNOB_RANGE) {
      dx = (dx / d) * KNOB_RANGE;
      dy = (dy / d) * KNOB_RANGE;
    }
    setKnob({ x: dx, y: dy });
    input.mx = dx / KNOB_RANGE;
    input.my = dy / KNOB_RANGE;
  };

  return (
    <div
      className="absolute inset-y-0 left-0 w-1/2 touch-none"
      onPointerDown={(e) => {
        if (id.current !== null) return;
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const o = { x: e.clientX, y: e.clientY };
        setOrigin(o);
        update(e, o);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === id.current && origin) update(e, origin);
      }}
      onPointerUp={(e) => {
        if (e.pointerId !== id.current) return;
        id.current = null;
        setOrigin(null);
        setKnob({ x: 0, y: 0 });
        input.mx = input.my = 0;
      }}
      onPointerCancel={() => {
        id.current = null;
        setOrigin(null);
        input.mx = input.my = 0;
      }}
    >
      {origin ? (
        <div className="pointer-events-none fixed" style={{ left: origin.x - 60, top: origin.y - 60 }}>
          <div className="h-[120px] w-[120px] rounded-full border-2 border-white/40 bg-slate-900/30 shadow-inner backdrop-blur-[2px]" />
          <div
            className="absolute h-14 w-14 rounded-full border-2 border-white/80 bg-gradient-to-br from-white/70 to-slate-300/50 shadow-lg"
            style={{ left: 32 + knob.x, top: 32 + knob.y }}
          />
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-8 left-8 h-[110px] w-[110px] rounded-full border-2 border-dashed border-white/25 text-center text-[11px] leading-[110px] text-white/50">
          move
        </div>
      )}
    </div>
  );
}

function Button({
  label,
  tone,
  onDown,
  onUp,
  big,
  charge,
}: {
  label: string;
  tone: string;
  onDown: () => void;
  onUp?: () => void;
  big?: boolean;
  charge?: boolean;
}) {
  const [held, setHeld] = useState(false);
  return (
    <button
      className={`relative select-none touch-none rounded-full border-2 border-white/60 font-bold uppercase tracking-wide text-white shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition active:scale-95 ${tone} ${
        big ? "h-[84px] w-[84px] text-sm" : "h-[66px] w-[66px] text-[11px]"
      }`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setHeld(true);
        onDown();
      }}
      onPointerUp={() => {
        setHeld(false);
        onUp?.();
      }}
      onPointerCancel={() => {
        setHeld(false);
        onUp?.();
      }}
    >
      <span className="absolute inset-[3px] rounded-full bg-gradient-to-b from-white/35 to-transparent" />
      {charge && held && <span className="absolute -inset-2 animate-[charge_0.9s_linear_forwards] rounded-full border-4 border-amber-300" />}
      <span className="relative">{label}</span>
    </button>
  );
}

export default function Controls({ input, hud, mode }: { input: Input; hud: HudState; mode: "player" | "team" }) {
  const shootStart = useRef(0);

  // Keyboard, for playing on a computer: arrows/WASD, J or Space pass, K shoot (hold), L tackle, Shift switch, C call.
  useEffect(() => {
    const keys = new Set<string>();
    const sync = () => {
      input.mx = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
      input.my = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      keys.add(k);
      if (k === "j" || k === " ") input.pass = true;
      if (k === "k") {
        input.shootHeld = true;
        shootStart.current = performance.now();
      }
      if (k === "l") input.tackle = true;
      if (k === "shift") input.switchPlayer = true;
      if (k === "c") input.call = true;
      sync();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.delete(k);
      if (k === "k") {
        input.shootHeld = false;
        input.shootReleased = (performance.now() - shootStart.current) / 1000;
      }
      sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [input]);

  return (
    <>
      <Joystick input={input} />
      <div className="absolute bottom-6 right-5 flex items-end gap-3" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {hud.onBall ? (
          <>
            <Button label="Pass" tone="bg-sky-600/85" onDown={() => (input.pass = true)} />
            <Button
              label="Shoot"
              tone="bg-rose-600/85"
              big
              charge
              onDown={() => {
                input.shootHeld = true;
                shootStart.current = performance.now();
              }}
              onUp={() => {
                input.shootHeld = false;
                input.shootReleased = (performance.now() - shootStart.current) / 1000;
              }}
            />
          </>
        ) : hud.attacking ? (
          <>
            {mode === "team" && <Button label="Switch" tone="bg-slate-600/85" onDown={() => (input.switchPlayer = true)} />}
            {mode === "player" && <Button label="Call" tone="bg-emerald-600/85" big onDown={() => (input.call = true)} />}
          </>
        ) : (
          <>
            {mode === "team" && <Button label="Switch" tone="bg-slate-600/85" onDown={() => (input.switchPlayer = true)} />}
            <Button label="Tackle" tone={hud.canTackle ? "bg-amber-600/90" : "bg-amber-900/70"} big onDown={() => (input.tackle = true)} />
          </>
        )}
      </div>
    </>
  );
}
