import { useMemo, useState } from "react";
import { POSITIONS, ROLES, STYLES } from "../game/config";
import type { LogEntry, Side, Team } from "../game/types";
import Lineups from "../components/Lineups";
import RollDisplay from "../components/RollDisplay";
import {
  COLS,
  GOAL_COLS,
  MAX_MOVES,
  MAX_SHOT_ROWS,
  ROWS,
  carrier,
  endTurn,
  gp,
  passOdds,
  rowsFromGoal,
  shotOdds,
  startGrid,
  stepsFrom,
  type Cell,
  type GridState,
  type Plan,
} from "./engine";

const CELL = 40;
const GOAL_H = 14;
const W = COLS * CELL;
const H = ROWS * CELL + GOAL_H * 2;

const TONE: Record<LogEntry["tone"], string> = {
  neutral: "text-slate-300",
  good: "text-emerald-300",
  bad: "text-rose-300",
  goal: "font-bold text-amber-300",
  you: "font-semibold text-sky-300",
};

const cx = (c: number) => c * CELL + CELL / 2;
const cy = (r: number) => GOAL_H + r * CELL + CELL / 2;
const emptyPlan = (): Plan => ({ moves: {}, ball: null });
const pct = (p: number) => `${Math.round(p * 100)}%`;

interface Props {
  sides: Record<Team, Side>;
  onReplay: () => void;
  onQuit: () => void;
}

export default function GridMatch({ sides, onReplay, onQuit }: Props) {
  const [gs, setGs] = useState<GridState>(() => startGrid(sides));
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [selected, setSelected] = useState<string | null>(null);
  const [passMode, setPassMode] = useState(false);
  const [hint, setHint] = useState("");

  const me = gp(gs, gs.userId);
  const ball = carrier(gs);
  const onBall = ball.f.isUser;
  const movesUsed = Object.keys(plan.moves).length;
  const takenTargets = new Set(Object.values(plan.moves).map((c) => `${c.c},${c.r}`));
  const steps = useMemo(() => {
    if (!selected) return [];
    return stepsFrom(gs, gp(gs, selected)).filter((c) => !takenTargets.has(`${c.c},${c.r}`));
    // takenTargets is derived from plan, which is listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs, selected, plan]);

  function resetTurn() {
    setPlan(emptyPlan());
    setSelected(null);
    setPassMode(false);
    setHint("");
  }

  function play(turns: number, withPlan: boolean) {
    let next = gs;
    for (let i = 0; i < turns && !next.finished; i++) {
      next = endTurn(next, withPlan && i === 0 ? plan : null);
      // Skipping stops as soon as the ball reaches you.
      if (!withPlan && carrier(next).f.isUser) break;
    }
    setGs(next);
    resetTurn();
  }

  function clickPlayer(id: string) {
    const p = gp(gs, id);
    if (passMode) {
      if (p.f.team === "us" && !p.f.isUser) {
        setPlan({ ...plan, ball: { kind: "pass", toId: id } });
        setPassMode(false);
      }
      return;
    }
    if (p.f.team !== "us") return;
    if (plan.moves[id]) {
      const { [id]: _removed, ...rest } = plan.moves;
      setPlan({ ...plan, moves: rest });
      setSelected(id);
      return;
    }
    if (selected === id) return setSelected(null);
    if (movesUsed >= MAX_MOVES) return setHint(`You've used all ${MAX_MOVES} moves. Tap a moved player to undo theirs.`);
    setHint("");
    setSelected(id);
  }

  function clickCell(cell: Cell) {
    if (!selected || !steps.some((s) => s.c === cell.c && s.r === cell.r)) return;
    setPlan({ ...plan, moves: { ...plan.moves, [selected]: cell } });
    setSelected(null);
  }

  const passTo = plan.ball?.kind === "pass" ? gp(gs, plan.ball.toId) : null;
  const canShoot = onBall && rowsFromGoal(me) <= MAX_SHOT_ROWS && me.f.position !== "GK";

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-xl bg-slate-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              You: {POSITIONS[me.f.position].label} · {ROLES[me.f.role].label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {sides.us.name} {gs.score.us} – {gs.score.them} {sides.them.name}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {sides.us.formation} {STYLES[sides.us.style].label} vs {sides.them.formation} {STYLES[sides.them.style].label} · Shots{" "}
              {gs.shots.us}–{gs.shots.them}
            </div>
          </div>
          <div className="text-3xl font-bold tabular-nums text-emerald-400">{Math.floor(gs.minute)}'</div>
        </div>
      </header>

      <div className="rounded-xl bg-slate-900 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[360px] touch-manipulation select-none">
          {Array.from({ length: ROWS }, (_, r) => (
            <rect key={r} x={0} y={GOAL_H + r * CELL} width={W} height={CELL} fill={r % 2 ? "#166534" : "#15803d"} />
          ))}
          <g stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.5} fill="none">
            <rect x={1} y={GOAL_H} width={W - 2} height={ROWS * CELL} />
            <line x1={0} x2={W} y1={cy(6)} y2={cy(6)} />
            <circle cx={cx(4)} cy={cy(6)} r={CELL * 1.2} />
            <rect x={CELL} y={GOAL_H} width={CELL * 7} height={CELL * 3} />
            <rect x={CELL} y={GOAL_H + CELL * 10} width={CELL * 7} height={CELL * 3} />
          </g>
          {[0, H - GOAL_H].map((y) => (
            <rect key={y} x={GOAL_COLS[0] * CELL} y={y} width={GOAL_COLS.length * CELL} height={GOAL_H} fill="#e2e8f0" opacity={0.9} />
          ))}
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const cell = { c: i % COLS, r: Math.floor(i / COLS) };
            const valid = steps.some((s) => s.c === cell.c && s.r === cell.r);
            return (
              <rect
                key={i}
                x={cell.c * CELL}
                y={GOAL_H + cell.r * CELL}
                width={CELL}
                height={CELL}
                fill={valid ? "#fde68a" : "transparent"}
                fillOpacity={valid ? 0.45 : 0}
                stroke={valid ? "#fbbf24" : "none"}
                onClick={() => clickCell(cell)}
              />
            );
          })}
          {passTo && <line x1={cx(me.c)} y1={cy(me.r)} x2={cx(passTo.c)} y2={cy(passTo.r)} stroke="#fde047" strokeWidth={3} strokeDasharray="6 4" />}
          {Object.entries(plan.moves).map(([id, cell]) => {
            const p = gp(gs, id);
            return (
              <g key={id} pointerEvents="none">
                <line x1={cx(p.c)} y1={cy(p.r)} x2={cx(cell.c)} y2={cy(cell.r)} stroke="#ffffff" strokeWidth={2.5} />
                <circle cx={cx(cell.c)} cy={cy(cell.r)} r={8} fill="#ffffff" fillOpacity={0.6} />
              </g>
            );
          })}
          {gs.players.map((p) => {
            const isGK = p.f.position === "GK";
            const fill = p.f.team === "us" ? (isGK ? "#0891b2" : "#2563eb") : isGK ? "#ca8a04" : "#dc2626";
            const ring = selected === p.f.id ? "#fbbf24" : p.f.isUser ? "#ffffff" : "#0f172a";
            const clickable = p.f.team === "us" || passMode;
            return (
              <g key={p.f.id} onClick={() => clickPlayer(p.f.id)} style={{ cursor: clickable ? "pointer" : "default" }}>
                <circle cx={cx(p.c)} cy={cy(p.r)} r={15} fill={fill} stroke={ring} strokeWidth={p.f.isUser || selected === p.f.id ? 3 : 1.5} />
                <text x={cx(p.c)} y={cy(p.r) + 3.5} textAnchor="middle" fontSize={p.f.isUser ? 9 : 10} fontWeight={700} fill="#ffffff" pointerEvents="none">
                  {p.f.isUser ? "YOU" : p.f.position}
                </text>
              </g>
            );
          })}
          <circle cx={cx(ball.c) + 11} cy={cy(ball.r) - 11} r={5.5} fill="#ffffff" stroke="#0f172a" strokeWidth={1.5} pointerEvents="none" />
        </svg>
      </div>

      {gs.finished ? (
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="text-lg font-semibold">Full time</div>
          <p className="mt-1 text-slate-400">
            You were in {gs.stats.rolls} contests and came out on top in {gs.stats.successes}.
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
        <div className="flex flex-col gap-3 rounded-xl bg-slate-900 p-4">
          <div className="text-sm text-slate-300">
            Tap one of your players, then a highlighted square. Moves used:{" "}
            <span className="font-semibold tabular-nums">
              {movesUsed}/{MAX_MOVES}
            </span>
            . The AI moves everyone else.
          </div>
          {hint && <div className="text-sm text-amber-300">{hint}</div>}
          {onBall && (
            <div className="rounded-lg border border-amber-400/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">You've got the ball</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setPassMode(!passMode)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${passMode ? "border-amber-400 bg-amber-500/20" : "border-slate-600 bg-slate-800"}`}
                >
                  {passMode ? "Tap a teammate…" : "Pass"}
                </button>
                <button
                  disabled={!canShoot}
                  onClick={() => setPlan({ ...plan, ball: { kind: "shoot" } })}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Shoot{canShoot ? ` · ${pct(shotOdds(gs, me))} to score` : ""}
                </button>
                <button onClick={() => setPlan({ ...plan, ball: null })} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm">
                  Keep it
                </button>
              </div>
              <div className="mt-2 text-sm text-slate-400">
                {plan.ball?.kind === "pass" && passTo
                  ? `Passing to ${passTo.f.name} · ${pct(passOdds(gs, me, passTo))} to get there. Passes go before anyone can close you down.`
                  : plan.ball?.kind === "shoot"
                    ? "Shooting this turn."
                    : "Keeping it. Move yourself to dribble; anyone next to you might tackle."}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => play(1, true)} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500">
              End turn
            </button>
            <button onClick={() => play(5, false)} className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">
              Skip 5 turns
            </button>
            <button onClick={() => play(20, false)} className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">
              Skip 20
            </button>
            <button onClick={onQuit} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200">
              Quit
            </button>
          </div>
          <div className="text-xs text-slate-500">Each turn is 30 seconds. Skipping lets the AI move your players too, and stops when the ball reaches you.</div>
        </div>
      )}

      <ol className="flex flex-col gap-2 rounded-xl bg-slate-900 p-4">
        {[...gs.log].reverse().map((entry) => (
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
