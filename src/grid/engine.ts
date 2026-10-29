// The grid game: every player stands on a square. Each turn you move up to three of your players one square,
// the AI moves everyone else, then the ball does something. Contests use the same stars and dice as everywhere else.
import { FATIGUE, FORMATIONS, MODIFIER_PER_HALF_STAR, STAT_LABELS, STYLES } from "../game/config";
import { chanceToMeet, check, meets, mirror, passed, type Rng } from "../game/dice";
import type { CheckResult, Footballer, LogEntry, Modifier, PositionCode, Side, Stat, Team } from "../game/types";

export const COLS = 9;
export const ROWS = 13;
/** Goal mouth columns. */
export const GOAL_COLS = [3, 4, 5];
/** Game minutes per turn. */
export const MINUTES_PER_TURN = 0.5;
export const MATCH_LENGTH = 90;
export const MAX_MOVES = 3;

/** Shots: one roll, below `onTarget` misses, at or above `beatsKeeper` scores. */
const SHOT = { onTarget: 5, beatsKeeper: 8 };
/** Passing: base target, plus 1 per square beyond 3, 2 per opponent in the lane, 1 per opponent next to the receiver. */
const PASS_BASE = 4;
/** Keeping the ball when an opponent next to you goes for it. */
const TACKLE_TARGET = 6;
/** Shooting from further than this many rows out isn't allowed. */
export const MAX_SHOT_ROWS = 5;

export interface Cell {
  c: number;
  r: number;
}

export interface GridPlayer {
  f: Footballer;
  c: number;
  r: number;
}

export type BallPlan = { kind: "pass"; toId: string } | { kind: "shoot" } | null;

export interface Plan {
  moves: Record<string, Cell>;
  ball: BallPlan;
}

export interface GridState {
  sides: Record<Team, Side>;
  players: GridPlayer[];
  userId: string;
  carrierId: string;
  minute: number;
  score: Record<Team, number>;
  shots: Record<Team, number>;
  log: LogEntry[];
  nextLogId: number;
  finished: boolean;
  stats: { rolls: number; successes: number };
}

// ---------------------------------------------------------------------------
// Geometry. "Relative" coordinates are from a team's own point of view: they attack towards row 0.
// ---------------------------------------------------------------------------

const other = (t: Team): Team => (t === "us" ? "them" : "us");
export const dist = (a: Cell, b: Cell) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const toRel = (team: Team, cell: Cell): Cell => (team === "us" ? cell : { c: COLS - 1 - cell.c, r: ROWS - 1 - cell.r });
const fromRel = toRel;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const inside = (cell: Cell) => cell.c >= 0 && cell.c < COLS && cell.r >= 0 && cell.r < ROWS;

/** Squares a line between two cells passes through, not counting the ends. */
function lineCells(a: Cell, b: Cell): Cell[] {
  const n = dist(a, b);
  const out: Cell[] = [];
  for (let i = 1; i < n; i++) {
    out.push({ c: Math.round(a.c + ((b.c - a.c) * i) / n), r: Math.round(a.r + ((b.r - a.r) * i) / n) });
  }
  return out;
}

const ROW_FOR: Record<PositionCode, number> = {
  GK: 12, CB: 10, LB: 10, RB: 10, LWB: 9, RWB: 9, DM: 9, CM: 8, LM: 8, RM: 8, AM: 8, LW: 7, RW: 7, ST: 7,
};
const WIDE: Partial<Record<PositionCode, number>> = { LB: 1, LWB: 1, LM: 1, LW: 1, RB: 7, RWB: 7, RM: 7, RW: 7 };
const SPREAD: Record<number, number[]> = { 1: [4], 2: [3, 5], 3: [2, 4, 6] };

/** Formation shape in a team's own coordinates, in their half. */
function homeCells(side: Side): Cell[] {
  const positions = FORMATIONS[side.formation];
  return positions.map((pos, i) => {
    const r = ROW_FOR[pos];
    if (WIDE[pos] !== undefined) return { c: WIDE[pos]!, r };
    const sameRow = positions.map((p, j) => ({ p, j })).filter(({ p }) => ROW_FOR[p] === r && WIDE[p] === undefined && p === pos);
    const k = sameRow.findIndex(({ j }) => j === i);
    const cols = SPREAD[sameRow.length] ?? SPREAD[3];
    return { c: cols[k] ?? 4, r };
  });
}

const homes = new WeakMap<Footballer, Cell>();

function home(side: Side, f: Footballer): Cell {
  if (!homes.has(f)) homeCells(side).forEach((cell, i) => homes.set(side.players[i], cell));
  return homes.get(f)!;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function log(s: GridState, text: string, tone: LogEntry["tone"] = "neutral", roll?: CheckResult): GridState {
  return { ...s, log: [...s.log, { id: s.nextLogId, minute: Math.floor(s.minute), text, tone, roll }], nextLogId: s.nextLogId + 1 };
}

function kickOffPositions(sides: Record<Team, Side>, kicking: Team): { players: GridPlayer[]; carrierId: string } {
  const players: GridPlayer[] = [];
  for (const team of ["us", "them"] as Team[]) {
    for (const f of sides[team].players) players.push({ f, ...fromRel(team, home(sides[team], f)) });
  }
  const mids = players.filter((p) => p.f.team === kicking && ["CM", "AM", "DM", "ST"].includes(p.f.position));
  const taker = mids.sort((a, b) => toRel(kicking, a).r - toRel(kicking, b).r)[0];
  const spot = { c: 4, r: 6 };
  taker.c = spot.c;
  taker.r = spot.r;
  return { players, carrierId: taker.f.id };
}

export function startGrid(sides: Record<Team, Side>): GridState {
  const user = [...sides.us.players, ...sides.them.players].find((p) => p.isUser)!;
  const { players, carrierId } = kickOffPositions(sides, "us");
  return log(
    {
      sides,
      players,
      userId: user.id,
      carrierId,
      minute: 0,
      score: { us: 0, them: 0 },
      shots: { us: 0, them: 0 },
      log: [],
      nextLogId: 1,
      finished: false,
      stats: { rolls: 0, successes: 0 },
    },
    "Kick-off.",
  );
}

export const playerAt = (s: GridState, cell: Cell) => s.players.find((p) => p.c === cell.c && p.r === cell.r);
export const gp = (s: GridState, id: string) => s.players.find((p) => p.f.id === id)!;
export const carrier = (s: GridState) => gp(s, s.carrierId);
const keeperOf = (s: GridState, team: Team) => s.players.find((p) => p.f.team === team && p.f.position === "GK")!;

/** Free squares one step from a player. */
export function stepsFrom(s: GridState, p: GridPlayer): Cell[] {
  const out: Cell[] = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      const cell = { c: p.c + dc, r: p.r + dr };
      if ((dc || dr) && inside(cell) && !playerAt(s, cell)) out.push(cell);
    }
  }
  return out;
}

/** How many rows from the goal a player is attacking. */
export function rowsFromGoal(p: GridPlayer): number {
  return toRel(p.f.team, p).r;
}

// ---------------------------------------------------------------------------
// Stars and contests (same rule as the main game: half a star of difference is 1 on 2d6)
// ---------------------------------------------------------------------------

function stars(s: GridState, f: Footballer, stat: Stat): number {
  const base = f.stats[stat];
  if (stat === "stamina") return base;
  const start = FATIGUE.startsAt + f.stats.stamina * FATIGUE.minutesPerStaminaStar - STYLES[s.sides[f.team].style].fatigueEarlier;
  if (s.minute <= start) return base;
  return Math.max(0, base - Math.min(FATIGUE.maxStarsLost, Math.floor((s.minute - start) / FATIGUE.minutesPerHalfStarLost) * 0.5));
}

function rating(s: GridState, f: Footballer, list: Stat[]) {
  return Math.floor((list.reduce((sum, st) => sum + stars(s, f, st), 0) / list.length) * 2) / 2;
}

const labelOf = (list: Stat[]) => list.map((x) => STAT_LABELS[x]).join("/");
const whose = (f: Footballer) => (f.isUser ? "Your" : `${f.name}'s`);

interface Result {
  s: GridState;
  ok: boolean;
  /** As the user should see it. */
  roll: CheckResult;
  /** As the attacker rolled it. */
  raw: CheckResult;
  userInvolved: boolean;
  userWon: boolean;
}

/** Attacker rolls against a defender. With no defender close enough, it's against an average (2.5★) opponent. */
function contest(
  s: GridState,
  attacker: Footballer,
  aStats: Stat[],
  defender: Footballer | null,
  dStats: Stat[],
  target: number,
  extra: Modifier[],
  rng: Rng,
  mirrorThreshold?: number,
): Result {
  const a = rating(s, attacker, aStats);
  const d = defender ? rating(s, defender, dStats) : 2.5;
  const opposed: Modifier = {
    label: `${attacker.isUser ? "Your " : ""}${labelOf(aStats)} ${a}★ vs ${defender ? `${whose(defender)} ${labelOf(dStats)}` : "nobody close"} ${d}★`,
    mirrorLabel: defender ? `${whose(defender)} ${labelOf(dStats)} ${d}★ vs ${whose(attacker)} ${labelOf(aStats)} ${a}★` : undefined,
    value: ((a - d) / 0.5) * MODIFIER_PER_HALF_STAR,
  };
  const roll = check(attacker.isUser ? "You" : attacker.name, [opposed, ...extra], target, rng);
  const ok = passed(roll);
  const userInvolved = attacker.isUser || !!defender?.isUser;
  const userWon = attacker.isUser ? ok : !ok;
  const shown = defender?.isUser ? mirror(roll, "You", mirrorThreshold) : roll;
  const next = userInvolved
    ? { ...s, stats: { rolls: s.stats.rolls + 1, successes: s.stats.successes + (userWon ? 1 : 0) } }
    : s;
  return { s: next, ok, roll: shown, raw: roll, userInvolved, userWon };
}

// ---------------------------------------------------------------------------
// AI movement
// ---------------------------------------------------------------------------

function aiTarget(s: GridState, p: GridPlayer): Cell {
  const team = p.f.team;
  const ball = carrier(s);
  const attacking = ball.f.team === team;
  const b = toRel(team, ball);

  if (p.f.position === "GK") return fromRel(team, { c: clamp(b.c, 3, 5), r: attacking ? 11 : 12 });

  if (p === ball) {
    // Carry it towards goal, drifting central as you get close.
    return fromRel(team, { c: b.r < 5 ? clamp(b.c + Math.sign(4 - b.c), 0, 8) : b.c, r: b.r - 1 });
  }

  if (!attacking) {
    const opponents = s.players.filter((o) => o.f.team !== team);
    const presser = s.players
      .filter((o) => o.f.team === team && o.f.position !== "GK")
      .sort((x, y) => dist(x, ball) - dist(y, ball))[0];
    if (p === presser) return { c: ball.c, r: ball.r };
    // Otherwise hold shape, pulled towards the ball, and tighten onto any runner nearby.
    const h = home(s.sides[team], p.f);
    const shaped = fromRel(team, { c: clamp(Math.round(h.c + (b.c - 4) * 0.4), 0, 8), r: clamp(Math.round(h.r + 1 + (b.r - 6) * 0.5), 0, 12) });
    const runner = opponents.filter((o) => o !== ball && dist(o, shaped) <= 2).sort((x, y) => dist(x, p) - dist(y, p))[0];
    if (!runner) return shaped;
    const goal = fromRel(team, { c: 4, r: 12 });
    return { c: runner.c + Math.sign(goal.c - runner.c), r: runner.r + Math.sign(goal.r - runner.r) };
  }

  // Attacking: forwards push on furthest; park the bus keeps the back lines deep but still breaks with the front ones.
  const h = home(s.sides[team], p.f);
  const bus = s.sides[team].style === "parkTheBus";
  const push = h.r <= 7 ? -4 : h.r <= 8 ? (bus ? -2 : -3) : bus ? -1 : -2;
  return fromRel(team, { c: clamp(Math.round(h.c + (b.c - 4) * 0.3), 0, 8), r: clamp(Math.round(h.r + push + (b.r - 6) * 0.5), 0, 12) });
}

function stepToward(p: Cell, t: Cell): Cell {
  return { c: p.c + Math.sign(t.c - p.c), r: p.r + Math.sign(t.r - p.r) };
}

// ---------------------------------------------------------------------------
// Ball AI
// ---------------------------------------------------------------------------

function laneBlockers(s: GridState, from: Cell, to: Cell, team: Team): GridPlayer[] {
  const cells = lineCells(from, to);
  return s.players.filter((o) => o.f.team !== team && cells.some((c) => c.c === o.c && c.r === o.r));
}

function markersOf(s: GridState, p: GridPlayer): GridPlayer[] {
  return s.players.filter((o) => o.f.team !== p.f.team && o.f.position !== "GK" && dist(o, p) === 1);
}

export function passTarget(s: GridState, from: GridPlayer, to: GridPlayer): number {
  const d = dist(from, to);
  return PASS_BASE + Math.max(0, d - 3) + laneBlockers(s, from, to, from.f.team).length * 2 + markersOf(s, to).length;
}

function opposedValue(s: GridState, attacker: Footballer, aStats: Stat[], defender: Footballer | null, dStats: Stat[]) {
  const a = rating(s, attacker, aStats);
  const d = defender ? rating(s, defender, dStats) : 2.5;
  return ((a - d) / 0.5) * MODIFIER_PER_HALF_STAR;
}

/** Chance a pass gets through, for showing before you commit. */
export function passOdds(s: GridState, from: GridPlayer, to: GridPlayer): number {
  const defender = [...laneBlockers(s, from, to, from.f.team)].sort((a, b) => dist(a, from) - dist(b, from))[0] ?? markersOf(s, to)[0] ?? null;
  return chanceToMeet(opposedValue(s, from.f, ["passing"], defender?.f ?? null, ["defending"]), passTarget(s, from, to));
}

/** Chance a shot goes in from where the shooter is now. */
export function shotOdds(s: GridState, shooter: GridPlayer): number {
  const keeper = keeperOf(s, other(shooter.f.team));
  const extra = shotModifiers(s, shooter).reduce((sum, m) => sum + m.value, 0);
  return chanceToMeet(opposedValue(s, shooter.f, ["finishing"], keeper.f, ["keeping"]) + extra, SHOT.beatsKeeper);
}

function shotModifiers(s: GridState, shooter: GridPlayer): Modifier[] {
  const keeper = keeperOf(s, other(shooter.f.team));
  const rows = rowsFromGoal(shooter);
  const goal = fromRel(shooter.f.team, { c: 4, r: -1 });
  const blockers = laneBlockers(s, shooter, goal, shooter.f.team).filter((b) => b !== keeper);
  return [
    { label: "Distance", value: rows <= 1 ? 1 : rows === 2 ? 0 : rows === 3 ? -1 : -2 - (rows - 4) },
    { label: "Angle", value: Math.abs(toRel(shooter.f.team, shooter).c - 4) >= 3 ? -1 : 0 },
    { label: "Bodies in the way", value: -blockers.length },
  ];
}

function aiBallPlan(s: GridState, p: GridPlayer, rng: Rng): BallPlan {
  const rows = rowsFromGoal(p);
  if (p.f.position !== "GK" && rows <= MAX_SHOT_ROWS) {
    const want = rows <= 2 ? 0.7 : rows <= 3 ? 0.35 : 0.12;
    if (rng() < want) return { kind: "shoot" };
  }
  const style = s.sides[p.f.team].style;
  const pressured = markersOf(s, p).length > 0;
  const options = s.players
    .filter((m) => m.f.team === p.f.team && m !== p && dist(m, p) <= 7)
    .map((m) => {
      const progress = rowsFromGoal(p) - rowsFromGoal(m);
      let score = progress * (style === "parkTheBus" ? 1.5 : 1) - passTarget(s, p, m) * 0.6;
      if (style === "tikiTaka" && dist(m, p) <= 3) score += 1;
      if (style === "wingPlay" && (m.c <= 1 || m.c >= 7)) score += 1;
      if (m.f.position === "GK") score -= 3;
      return { m, score: score + rng() * 1.5 };
    })
    .sort((a, b) => b.score - a.score);
  const best = options[0];
  if (best && (pressured || best.score > -2.5 || rng() < 0.3)) return { kind: "pass", toId: best.m.f.id };
  return null;
}

// ---------------------------------------------------------------------------
// A turn
// ---------------------------------------------------------------------------

function restartAfterGoal(s: GridState, conceding: Team): GridState {
  const { players, carrierId } = kickOffPositions(s.sides, conceding);
  return { ...s, players, carrierId };
}

function goalKick(s: GridState, team: Team, rng: Rng): GridState {
  const defenders = s.players.filter((p) => p.f.team === team && ["CB", "LB", "RB"].includes(p.f.position));
  const taker = defenders.length ? defenders[Math.floor(rng() * defenders.length)] : keeperOf(s, team);
  return { ...s, carrierId: taker.f.id };
}

const name = (f: Footballer) => (f.isUser ? "You" : f.name);

/** Play out one turn. With no plan, the AI moves your players too and decides for you on the ball. */
export function endTurn(state: GridState, plan: Plan | null, rng: Rng = Math.random): GridState {
  if (state.finished) return state;
  let s: GridState = { ...state, players: state.players.map((p) => ({ ...p })) };

  // 1. Movement: everyone decides from the same snapshot, then moves in a random order.
  const intents = new Map<GridPlayer, Cell>();
  for (const p of s.players) {
    const planned = plan?.moves[p.f.id];
    if (planned) intents.set(p, planned);
    // On the ball, you decide whether you move; the AI only runs your other players.
    else if (!(plan && p.f.isUser && p.f.id === state.carrierId)) intents.set(p, stepToward(p, aiTarget(state, p)));
  }
  const order = [...intents.keys()].sort(() => rng() - 0.5);
  for (const p of order) {
    const t = intents.get(p)!;
    if ((t.c === p.c && t.r === p.r) || !inside(t) || playerAt(s, t)) continue;
    p.c = t.c;
    p.r = t.r;
  }
  s = { ...s, players: s.players };

  // 2. The ball: a pass or shot goes before the press can arrive.
  let ball = carrier(s);
  const bp = ball.f.isUser && plan ? plan.ball : aiBallPlan(s, ball, rng);
  if (bp?.kind === "pass") s = resolvePass(s, ball, gp(s, bp.toId), rng);
  else if (bp?.kind === "shoot") s = resolveShot(s, ball, rng);
  else s = pressure(s, rng);

  // 4. The clock.
  const before = s.minute;
  s = { ...s, minute: s.minute + MINUTES_PER_TURN };
  if (before < MATCH_LENGTH / 2 && s.minute >= MATCH_LENGTH / 2) {
    s = log(restartAfterGoal(s, "them"), `Half-time. ${s.score.us}–${s.score.them}.`);
  }
  if (s.minute >= MATCH_LENGTH) {
    s = log({ ...s, minute: MATCH_LENGTH, finished: true }, `Full time. ${s.score.us}–${s.score.them}.`);
  }
  return s;
}

/** Holding onto it: an opponent next to the ball may go for it. */
function pressure(s: GridState, rng: Rng): GridState {
  const ball = carrier(s);
  const adjacent = s.players.filter((o) => o.f.team !== ball.f.team && o.f.position !== "GK" && dist(o, ball) === 1);
  if (!adjacent.length) return s;
  const tackler = adjacent.find((a) => a.f.isUser) ?? adjacent.sort((a, b) => b.f.stats.defending - a.f.stats.defending)[0];
  if (!tackler.f.isUser && rng() >= STYLES[s.sides[tackler.f.team].style].tackleChance) return s;
  const crowd: Modifier[] = adjacent.length > 1 ? [{ label: "Crowded out", value: -(adjacent.length - 1) }] : [];
  const r = contest(s, ball.f, ["dribbling", "speed"], tackler.f, ["defending"], TACKLE_TARGET, crowd, rng);
  let next = r.s;
  if (!r.ok) next = { ...next, carrierId: tackler.f.id };
  if (!r.userInvolved) return next;
  const text = r.ok
    ? ball.f.isUser
      ? `You hold off ${tackler.f.name}.`
      : `${ball.f.name} rides your challenge.`
    : ball.f.isUser
      ? `${tackler.f.name} takes it off you.`
      : `You win it off ${ball.f.name}.`;
  return log(next, text, r.userWon ? "good" : "bad", r.roll);
}

function resolvePass(s: GridState, from: GridPlayer, to: GridPlayer, rng: Rng): GridState {
  const blockers = laneBlockers(s, from, to, from.f.team);
  const markers = markersOf(s, to);
  const defender = [...blockers].sort((a, b) => dist(a, from) - dist(b, from))[0] ?? markers[0] ?? null;
  const target = passTarget(s, from, to);
  const r = contest(s, from.f, ["passing"], defender?.f ?? null, ["defending"], target, [], rng);
  let next = r.s;
  const involved = r.userInvolved || to.f.isUser;
  if (r.ok) {
    next = { ...next, carrierId: to.f.id };
    if (involved) {
      const text = from.f.isUser ? `You find ${to.f.name}.` : to.f.isUser ? `${from.f.name} finds you.` : `${from.f.name} gets it past you to ${to.f.name}.`;
      next = log(next, text, r.userInvolved ? (r.userWon ? "good" : "bad") : "you", r.userInvolved ? r.roll : undefined);
    }
    return next;
  }
  const winner =
    defender ??
    s.players.filter((o) => o.f.team !== from.f.team).sort((a, b) => dist(a, to) - dist(b, to))[0];
  next = { ...next, carrierId: winner.f.id };
  if (involved || winner.f.isUser) {
    const text = from.f.isUser ? `Your pass is cut out by ${winner.f.name}.` : winner.f.isUser ? `You cut out ${from.f.name}'s pass.` : `${from.f.name}'s pass to you is cut out.`;
    next = log(next, text, r.userInvolved ? (r.userWon ? "good" : "bad") : winner.f.isUser ? "good" : "bad", r.userInvolved ? r.roll : undefined);
  }
  return next;
}

function resolveShot(s: GridState, shooter: GridPlayer, rng: Rng): GridState {
  const keeper = keeperOf(s, other(shooter.f.team));
  const extra = shotModifiers(s, shooter);
  const r = contest(s, shooter.f, ["finishing"], keeper.f, ["keeping"], SHOT.beatsKeeper, extra, rng, SHOT.beatsKeeper);
  let next: GridState = { ...r.s, shots: { ...r.s.shots, [shooter.f.team]: r.s.shots[shooter.f.team] + 1 } };
  const showRoll = r.roll;

  if (r.ok) {
    next = { ...next, score: { ...next.score, [shooter.f.team]: next.score[shooter.f.team] + 1 } };
    next = log(next, `GOAL! ${name(shooter.f)} ${shooter.f.isUser ? "score" : "scores"}. ${next.score.us}–${next.score.them}.`, "goal", showRoll);
    return restartAfterGoal(next, other(shooter.f.team));
  }
  const onTarget = meets(r.raw, SHOT.onTarget);
  if (onTarget) {
    next = { ...next, carrierId: keeper.f.id };
    return log(next, `${name(shooter.f)} ${shooter.f.isUser ? "shoot" : "shoots"}. ${keeper.f.isUser ? "You save" : `${keeper.f.name} saves`}.`, r.userInvolved ? (r.userWon ? "good" : "bad") : "neutral", showRoll);
  }
  next = goalKick(next, keeper.f.team, rng);
  return log(next, `${name(shooter.f)} ${shooter.f.isUser ? "shoot" : "shoots"} wide.`, r.userInvolved ? (r.userWon ? "good" : "bad") : "neutral", showRoll);
}
