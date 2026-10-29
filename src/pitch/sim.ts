// The real-time match. Pure simulation in metres: no drawing in here, so it can be run headless to tune.
// The pitch runs left to right: x along the length (0 to 105), y across (0 to 68). Your side attacks to the right.
import { FATIGUE, FORMATIONS, STYLES } from "../game/config";
import { chanceToMeet } from "../game/dice";
import type { Footballer, PositionCode, Side, Stat, Team } from "../game/types";
import {
  ACCELERATION,
  AI_REACTION,
  BALL_DRAG,
  BALL_FRICTION,
  BEATEN_TIME,
  BOUNCE,
  FIRST_TOUCH,
  CONTROL_HEIGHT,
  CONTROL_RADIUS,
  DRIBBLE_SPEED_FACTOR,
  FATIGUE_SPEED_LOSS,
  GOAL_HEIGHT,
  GOAL_PAUSE,
  GOAL_WIDTH,
  GRAVITY,
  INTERCEPT_TARGET,
  KEEPER_HEIGHT,
  KEEPER_REACH,
  KICKOFF_PAUSE,
  LOFT_DISTANCE,
  MATCH_SECONDS,
  PASS_ARRIVAL_SPEED,
  PASS_ERROR,
  PITCH_L,
  PITCH_W,
  RESTART_PAUSE,
  RUN_SPEED,
  SHOT_CHARGE_SECONDS,
  SHOT_ERROR,
  SHOT_SPEED,
  TACKLE_RANGE,
  TACKLE_TARGET,
} from "./constants";

export type ControlMode = "player" | "team";
export type Rng = () => number;

export interface Body {
  f: Footballer;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Direction faced, as a unit vector. */
  fx: number;
  fy: number;
  homeX: number;
  homeY: number;
  /** Beaten in a duel: slowed and can't challenge until this time. */
  beatenUntil: number;
  nextThink: number;
  /** Where the AI wants to be. */
  tx: number;
  ty: number;
}

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  owner: Body | null;
  lastTouch: Body | null;
  kickedAt: number;
  /** A pass in flight: who it's meant for, and who's already had a go at cutting it out. */
  intended: Body | null;
  beaten: Set<Body>;
  /** A shot in flight, and whether the keeper has had their chance at it. */
  shooter: Body | null;
  keeperTried: boolean;
}

export type Phase = "kickoff" | "play" | "restart" | "goal" | "halftime" | "fulltime";

export interface MatchEvent {
  kind: "goal" | "save" | "miss" | "halftime" | "fulltime" | "tackle" | "intercept";
  team?: Team;
  text: string;
}

export interface Input {
  /** Joystick, -1 to 1 on each axis (screen and world share directions). */
  mx: number;
  my: number;
  pass: boolean;
  /** Shoot is held down; on release, `shootReleased` carries how long it was held. */
  shootHeld: boolean;
  shootReleased: number | null;
  tackle: boolean;
  switchPlayer: boolean;
  call: boolean;
}

export const NO_INPUT: Input = { mx: 0, my: 0, pass: false, shootHeld: false, shootReleased: null, tackle: false, switchPlayer: false, call: false };

export interface Sim {
  sides: Record<Team, Side>;
  mode: ControlMode;
  bodies: Body[];
  ball: Ball;
  user: Body;
  controlled: Body;
  /** Seconds of match clock played. */
  clock: number;
  /** Seconds of real time, including pauses. */
  time: number;
  phase: Phase;
  phaseUntil: number;
  kickingOff: Team;
  secondHalf: boolean;
  score: Record<Team, number>;
  shots: Record<Team, number>;
  events: MatchEvent[];
  /** You've called for the ball. */
  callingUntil: number;
  /** When an AI computer plays your part too (for testing). */
  autopilot: boolean;
}

const other = (t: Team): Team => (t === "us" ? "them" : "us");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const len = (x: number, y: number) => Math.hypot(x, y);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Normally distributed noise, for aim errors. */
function gauss(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());
}

// ---------------------------------------------------------------------------
// Each team sees the pitch as attacking to the right. These convert to and from that view.
// ---------------------------------------------------------------------------

const relX = (team: Team, x: number) => (team === "us" ? x : PITCH_L - x);
const relY = (team: Team, y: number) => (team === "us" ? y : PITCH_W - y);
const absX = relX;
const absY = relY;

/** The goal a team is attacking. */
const goalX = (team: Team) => (team === "us" ? PITCH_L : 0);

// ---------------------------------------------------------------------------
// Formation shape, in a team's own view, inside their own half
// ---------------------------------------------------------------------------

const LINE_X: Record<PositionCode, number> = {
  GK: 3, CB: 17, LB: 18, RB: 18, LWB: 25, RWB: 25, DM: 26, CM: 34, LM: 34, RM: 34, AM: 42, LW: 47, RW: 47, ST: 48,
};
/** Facing the opposition goal, left is towards y = 0. */
const WIDE_Y: Partial<Record<PositionCode, number>> = { LB: 8, LWB: 6, LM: 7, LW: 8, RB: 60, RWB: 62, RM: 61, RW: 60 };
const SPREAD: Record<number, number[]> = { 1: [34], 2: [25, 43], 3: [19, 34, 49] };

const lineOf = (p: PositionCode) => (p === "GK" ? 0 : LINE_X[p] <= 26 ? 1 : LINE_X[p] <= 42 ? 2 : 3);

function homeShape(side: Side): { x: number; y: number }[] {
  const positions = FORMATIONS[side.formation];
  return positions.map((pos, i) => {
    const x = LINE_X[pos];
    if (WIDE_Y[pos] !== undefined) return { x, y: WIDE_Y[pos]! };
    const same = positions.map((p, j) => ({ p, j })).filter(({ p }) => p === pos);
    const k = same.findIndex(({ j }) => j === i);
    return { x, y: (SPREAD[same.length] ?? SPREAD[3])[k] ?? 34 };
  });
}

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------

function stars(sim: Sim, b: Body, stat: Stat): number {
  const base = b.f.stats[stat];
  if (stat === "stamina") return base;
  const minute = minuteOf(sim);
  const start = FATIGUE.startsAt + b.f.stats.stamina * FATIGUE.minutesPerStaminaStar - STYLES[sim.sides[b.team].style].fatigueEarlier;
  if (minute <= start) return base;
  return Math.max(0, base - Math.min(FATIGUE.maxStarsLost, Math.floor((minute - start) / FATIGUE.minutesPerHalfStarLost) * 0.5));
}

function rating(sim: Sim, b: Body, list: Stat[]): number {
  return Math.floor((list.reduce((s, st) => s + stars(sim, b, st), 0) / list.length) * 2) / 2;
}

/** Each half star of difference is 1 on 2d6, exactly as before; the dice just happen behind the scenes now. */
function duel(sim: Sim, attacker: Body, aStats: Stat[], defender: Body, dStats: Stat[], target: number, rng: Rng): boolean {
  const mod = (rating(sim, attacker, aStats) - rating(sim, defender, dStats)) * 2;
  return rng() < chanceToMeet(mod, target);
}

function topSpeed(sim: Sim, b: Body): number {
  const base = RUN_SPEED.base + RUN_SPEED.perStar * b.f.stats.speed;
  const tired = clamp((minuteOf(sim) - (50 + b.f.stats.stamina * 8)) / 40, 0, 1);
  const beaten = sim.time < b.beatenUntil ? 0.55 : 1;
  const dribbling = sim.ball.owner === b ? DRIBBLE_SPEED_FACTOR : 1;
  return base * (1 - FATIGUE_SPEED_LOSS * tired) * beaten * dribbling;
}

export function minuteOf(sim: Sim): number {
  return Math.min(90, Math.floor((sim.clock / MATCH_SECONDS) * 90));
}

// ---------------------------------------------------------------------------
// Setting up
// ---------------------------------------------------------------------------

export function createSim(sides: Record<Team, Side>, mode: ControlMode, autopilot = false): Sim {
  const bodies: Body[] = [];
  for (const team of ["us", "them"] as Team[]) {
    const shape = homeShape(sides[team]);
    sides[team].players.forEach((f, i) => {
      const h = shape[i];
      const x = absX(team, h.x);
      const y = absY(team, h.y);
      bodies.push({ f, team, x, y, vx: 0, vy: 0, fx: team === "us" ? 1 : -1, fy: 0, homeX: h.x, homeY: h.y, beatenUntil: 0, nextThink: 0, tx: x, ty: y });
    });
  }
  const user = bodies.find((b) => b.f.isUser)!;
  const sim: Sim = {
    sides,
    mode,
    bodies,
    ball: { x: PITCH_L / 2, y: PITCH_W / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: null, kickedAt: 0, intended: null, beaten: new Set(), shooter: null, keeperTried: false },
    user,
    controlled: user,
    clock: 0,
    time: 0,
    phase: "kickoff",
    phaseUntil: KICKOFF_PAUSE,
    kickingOff: "us",
    secondHalf: false,
    score: { us: 0, them: 0 },
    shots: { us: 0, them: 0 },
    events: [],
    callingUntil: 0,
    autopilot,
  };
  setUpKickOff(sim, "us");
  return sim;
}

function setUpKickOff(sim: Sim, team: Team) {
  for (const b of sim.bodies) {
    b.x = absX(b.team, b.homeX);
    b.y = absY(b.team, b.homeY);
    b.vx = b.vy = 0;
    b.fx = b.team === "us" ? 1 : -1;
    b.fy = 0;
    b.beatenUntil = 0;
  }
  const taker = sim.bodies
    .filter((b) => b.team === team && b.f.position !== "GK")
    .sort((a, b) => relX(team, b.x) - relX(team, a.x))[0];
  taker.x = PITCH_L / 2 - (team === "us" ? 0.6 : -0.6);
  taker.y = PITCH_W / 2;
  giveBall(sim, taker);
  sim.kickingOff = team;
  sim.phase = "kickoff";
  sim.phaseUntil = sim.time + KICKOFF_PAUSE;
  if (sim.mode === "team" && team === "us") sim.controlled = taker;
}

function giveBall(sim: Sim, b: Body) {
  const ball = sim.ball;
  ball.owner = b;
  ball.lastTouch = b;
  ball.intended = null;
  ball.shooter = null;
  ball.vx = ball.vy = ball.vz = 0;
  ball.z = 0;
  ball.x = b.x + b.fx * 0.9;
  ball.y = b.y + b.fy * 0.9;
  if (sim.mode === "team" && b.team === "us") sim.controlled = b;
}

function restart(sim: Sim, taker: Body, x: number, y: number) {
  taker.x = x;
  taker.y = y;
  taker.vx = taker.vy = 0;
  // Face into the pitch.
  const ix = PITCH_L / 2 - x;
  const iy = PITCH_W / 2 - y;
  const l = len(ix, iy) || 1;
  taker.fx = ix / l;
  taker.fy = iy / l;
  giveBall(sim, taker);
  sim.phase = "restart";
  sim.phaseUntil = sim.time + RESTART_PAUSE;
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

export function stepSim(sim: Sim, input: Input, dt: number, rng: Rng = Math.random) {
  sim.time += dt;

  if (sim.phase === "fulltime") return;
  if (sim.phase === "halftime" || sim.phase === "goal") {
    if (sim.time >= sim.phaseUntil) setUpKickOff(sim, sim.phase === "halftime" ? "them" : sim.kickingOff);
    return;
  }
  if (sim.phase === "kickoff" || sim.phase === "restart") {
    if (sim.time >= sim.phaseUntil) sim.phase = "play";
    else {
      attachBall(sim);
      return;
    }
  }

  sim.clock += dt;
  if (!sim.secondHalf && sim.clock >= MATCH_SECONDS / 2) {
    sim.secondHalf = true;
    sim.phase = "halftime";
    sim.phaseUntil = sim.time + 2.5;
    sim.events.push({ kind: "halftime", text: `Half-time. ${sim.score.us}–${sim.score.them}` });
    return;
  }
  if (sim.clock >= MATCH_SECONDS) {
    sim.phase = "fulltime";
    sim.events.push({ kind: "fulltime", text: `Full time. ${sim.score.us}–${sim.score.them}` });
    return;
  }

  const human = !sim.autopilot;
  if (human) handleInput(sim, input, rng);

  for (const b of sim.bodies) {
    if (human && b === sim.controlled) continue;
    think(sim, b, rng);
  }
  for (const b of sim.bodies) move(sim, b, human && b === sim.controlled ? input : null, dt);
  separate(sim);
  moveBall(sim, dt, rng);
}

// ---------------------------------------------------------------------------
// You
// ---------------------------------------------------------------------------

function handleInput(sim: Sim, input: Input, rng: Rng) {
  const me = sim.controlled;
  const ball = sim.ball;

  if (input.switchPlayer && sim.mode === "team") {
    const options = sim.bodies.filter((b) => b.team === "us" && b !== me && b.f.position !== "GK");
    sim.controlled = options.sort((a, b) => dist(a, ball) - dist(b, ball))[0];
  }
  if (input.call && ball.owner?.team === "us" && ball.owner !== me) sim.callingUntil = sim.time + 2.5;

  if (ball.owner === me) {
    if (input.pass) {
      const target = userPassTarget(sim, me, input);
      if (target) kickPass(sim, target, rng, me);
    } else if (input.shootReleased !== null) {
      shoot(sim, me, Math.min(1, input.shootReleased / SHOT_CHARGE_SECONDS), input.my, rng);
    }
  } else if (input.tackle && ball.owner && ball.owner.team !== me.team && sim.time >= me.beatenUntil) {
    if (dist(me, ball.owner) <= TACKLE_RANGE) tackle(sim, me, ball.owner, rng);
  }
}

/** The teammate most in line with where you're pushing the stick (or facing), not too close or far. */
function userPassTarget(sim: Sim, me: Body, input: Input): Body | null {
  const mag = len(input.mx, input.my);
  const dx = mag > 0.3 ? input.mx / mag : me.fx;
  const dy = mag > 0.3 ? input.my / mag : me.fy;
  let best: Body | null = null;
  let bestScore = -Infinity;
  for (const b of sim.bodies) {
    if (b.team !== me.team || b === me) continue;
    const ox = b.x - me.x;
    const oy = b.y - me.y;
    const d = len(ox, oy);
    const cos = (ox * dx + oy * dy) / (d || 1);
    if (cos < 0.55) continue;
    const score = cos * 3 - Math.abs(d - 16) / 10 - (b.f.position === "GK" ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best ?? aiPassChoice(sim, me)?.target ?? null;
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

function think(sim: Sim, b: Body, rng: Rng) {
  const ball = sim.ball;
  if (b.f.position === "GK") return keeperThink(sim, b, rng);

  if (ball.owner === b) {
    if (sim.time >= b.nextThink) {
      b.nextThink = sim.time + AI_REACTION * (0.7 + rng() * 0.6);
      carrierDecide(sim, b, rng);
    }
    return;
  }

  const team = b.team;
  const attacking = ball.owner ? ball.owner.team === team : ball.lastTouch?.team === team && !!ball.intended;
  const bx = relX(team, ball.x);
  const by = relY(team, ball.y);
  const style = sim.sides[team].style;

  // A loose ball or a pass meant for you: go and get it.
  if (!ball.owner) {
    if (ball.intended === b || chaserFor(sim, team) === b) {
      const t = 0.25;
      b.tx = ball.x + ball.vx * t;
      b.ty = ball.y + ball.vy * t;
      return;
    }
  }

  const line = lineOf(b.f.position);
  let tx: number;
  let ty = b.homeY + (by - 34) * 0.35;

  if (attacking) {
    const push = [0, 14, 22, 32][line] * (style === "parkTheBus" && line < 3 ? 0.6 : 1);
    tx = b.homeX + push + (bx - 52.5) * 0.5;
    // Forwards look for space beyond the ball when it's in the final third.
    if (line === 3 && bx > 60) tx = Math.max(tx, bx + 6);
    if (style === "wingPlay" && Math.abs(b.homeY - 34) > 20) ty = b.homeY;
  } else {
    const deep = style === "parkTheBus" ? -7 : style === "gegenpress" ? 6 : 0;
    tx = b.homeX - 2 + deep + (bx - 52.5) * 0.5;

    // The nearest one or two press the ball; others pick up a runner near them.
    const pressers = pressersFor(sim, team);
    if (ball.owner && pressers.includes(b)) {
      b.tx = ball.owner.x;
      b.ty = ball.owner.y;
      if (sim.time >= b.nextThink && sim.time >= b.beatenUntil && dist(b, ball.owner) <= TACKLE_RANGE) {
        b.nextThink = sim.time + AI_REACTION * 1.6;
        if (rng() < STYLES[style].tackleChance) tackle(sim, b, ball.owner, rng);
      }
      return;
    }
    const shapeX = absX(team, clamp(tx, 4, 100));
    const shapeY = absY(team, clamp(ty, 3, 65));
    const runner = sim.bodies
      .filter((o) => o.team !== team && o !== ball.owner && dist(o, { x: shapeX, y: shapeY }) < 11)
      .sort((p, q) => dist(p, b) - dist(q, b))[0];
    if (runner) {
      // Goal-side of them.
      b.tx = runner.x + (team === "us" ? -1.8 : 1.8);
      b.ty = runner.y + (34 - relY(team, runner.y)) * 0.05;
      return;
    }
  }

  b.tx = absX(team, clamp(tx, 4, 101));
  b.ty = absY(team, clamp(ty, 3, 65));
}

function pressersFor(sim: Sim, team: Team): Body[] {
  const owner = sim.ball.owner;
  if (!owner) return [];
  const n = sim.sides[team].style === "gegenpress" ? 2 : 1;
  return sim.bodies
    .filter((b) => b.team === team && b.f.position !== "GK" && !(b === sim.controlled && !sim.autopilot))
    .sort((a, b) => dist(a, owner) - dist(b, owner))
    .slice(0, n);
}

function chaserFor(sim: Sim, team: Team): Body | undefined {
  const ball = sim.ball;
  return sim.bodies
    .filter((b) => b.team === team && b.f.position !== "GK" && !(b === sim.controlled && !sim.autopilot))
    .sort((a, b) => dist(a, ball) - dist(b, ball))[0];
}

function laneClearance(sim: Sim, from: Body, to: { x: number; y: number }, team: Team): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const l2 = dx * dx + dy * dy || 1;
  let min = Infinity;
  for (const o of sim.bodies) {
    if (o.team === team) continue;
    const t = clamp(((o.x - from.x) * dx + (o.y - from.y) * dy) / l2, 0, 1);
    min = Math.min(min, dist(o, { x: from.x + dx * t, y: from.y + dy * t }));
  }
  return min;
}

function nearestOpponent(sim: Sim, b: { x: number; y: number }, team: Team): number {
  let min = Infinity;
  for (const o of sim.bodies) if (o.team !== team) min = Math.min(min, dist(o, b));
  return min;
}

function aiPassChoice(sim: Sim, b: Body): { target: Body; score: number } | null {
  const style = sim.sides[b.team].style;
  const calling = sim.callingUntil > sim.time;
  let best: { target: Body; score: number } | null = null;
  for (const m of sim.bodies) {
    if (m.team !== b.team || m === b) continue;
    const d = dist(m, b);
    if (d < 5 || d > 45) continue;
    const progress = relX(b.team, m.x) - relX(b.team, b.x);
    const space = Math.min(nearestOpponent(sim, m, b.team), 8);
    const clear = laneClearance(sim, b, m, b.team);
    let score = progress * (style === "parkTheBus" ? 0.22 : 0.15) + space * 0.35 - (clear < 1.8 ? 5 : clear < 3 ? 1.5 : 0) - (d > LOFT_DISTANCE ? 1.2 : 0);
    if (style === "tikiTaka" && d < 18) score += 1;
    if (style === "wingPlay" && Math.abs(relY(b.team, m.y) - 34) > 22) score += 1.2;
    if (m.f.position === "GK") score -= 3;
    if (m.f.isUser && m.team === "us" && !sim.autopilot) score += calling ? 6 : 0.8;
    if (!best || score > best.score) best = { target: m, score };
  }
  return best;
}

function carrierDecide(sim: Sim, b: Body, rng: Rng) {
  const team = b.team;
  const gx = goalX(team);
  const toGoal = Math.hypot(gx - b.x, 34 - b.y);
  const pressure = nearestOpponent(sim, b, team);
  const keeper = sim.bodies.find((k) => k.team !== team && k.f.position === "GK")!;
  const shotLane = laneClearance(sim, b, { x: gx, y: 34 }, team);

  const wantShot =
    toGoal < 13 ? 0.8 : toGoal < 22 && shotLane > 1.2 ? 0.45 : toGoal < 30 && shotLane > 2 ? 0.1 : 0;
  if (rng() < wantShot) {
    const aim = keeper.y < 34 ? 1 : -1;
    shoot(sim, b, 0.55 + rng() * 0.45, aim * (0.55 + rng() * 0.35), rng);
    return;
  }

  const option = aiPassChoice(sim, b);
  // Pass when someone's closing you down, when there's a really good ball on, or now and then to keep it moving.
  const space = pressure > 7;
  if (option && ((pressure < 3 && option.score > -2) || option.score > (space ? 4.5 : 3) || (rng() < (space ? 0.05 : 0.12) && option.score > 0.5))) {
    kickPass(sim, option.target, rng, b);
    return;
  }

  // Dribble: towards goal, bending away from anyone close.
  let dx = gx - b.x;
  let dy = 34 - b.y;
  const l = len(dx, dy) || 1;
  dx /= l;
  dy /= l;
  for (const o of sim.bodies) {
    if (o.team === team) continue;
    const d = dist(o, b);
    if (d < 7) {
      const w = ((7 - d) / 7) * 1.4;
      dx += ((b.x - o.x) / (d || 1)) * w;
      dy += ((b.y - o.y) / (d || 1)) * w;
    }
  }
  const dl = len(dx, dy) || 1;
  b.tx = clamp(b.x + (dx / dl) * 6, 1, PITCH_L - 1);
  b.ty = clamp(b.y + (dy / dl) * 6, 1, PITCH_W - 1);
}

function keeperThink(sim: Sim, k: Body, rng: Rng) {
  const ball = sim.ball;
  if (ball.owner === k) {
    // Hold it for a moment, then play it out.
    if (k.nextThink === 0) k.nextThink = sim.time + 1.2;
    else if (sim.time >= k.nextThink) {
      const option = aiPassChoice(sim, k);
      if (option) kickPass(sim, option.target, rng, k);
      k.nextThink = 0;
    }
    return;
  }
  k.nextThink = 0;
  if (k === sim.controlled && !sim.autopilot) return;
  // Stay on the line between the ball and the middle of the goal, a few metres off it.
  const own = goalX(other(k.team));
  const dir = k.team === "us" ? 1 : -1;
  const toBall = Math.abs(ball.x - own);
  const off = clamp(toBall * 0.12, 1, 6);
  k.tx = own + dir * off;
  k.ty = clamp(34 + (ball.y - 34) * (off / Math.max(toBall, 1)) * 1.4, 34 - 4.5, 34 + 4.5);
  // A loose ball in the box is the keeper's.
  if (!ball.owner && !ball.shooter && toBall < 14 && Math.abs(ball.y - 34) < 18 && dist(k, ball) < 9) {
    k.tx = ball.x;
    k.ty = ball.y;
  }
}

// ---------------------------------------------------------------------------
// Moving
// ---------------------------------------------------------------------------

function move(sim: Sim, b: Body, input: Input | null, dt: number) {
  const top = topSpeed(sim, b);
  let wx: number;
  let wy: number;
  if (input) {
    const mag = Math.min(1, len(input.mx, input.my));
    const l = len(input.mx, input.my) || 1;
    wx = (input.mx / l) * mag * top;
    wy = (input.my / l) * mag * top;
  } else {
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = len(dx, dy);
    const speed = d < 0.3 ? 0 : top * Math.min(1, d / 2.5);
    wx = d ? (dx / d) * speed : 0;
    wy = d ? (dy / d) * speed : 0;
  }
  const ax = wx - b.vx;
  const ay = wy - b.vy;
  const al = len(ax, ay);
  const step = ACCELERATION * dt;
  if (al > step) {
    b.vx += (ax / al) * step;
    b.vy += (ay / al) * step;
  } else {
    b.vx = wx;
    b.vy = wy;
  }
  b.x = clamp(b.x + b.vx * dt, -3, PITCH_L + 3);
  b.y = clamp(b.y + b.vy * dt, -3, PITCH_W + 3);
  const sp = len(b.vx, b.vy);
  if (sp > 0.6) {
    b.fx = b.vx / sp;
    b.fy = b.vy / sp;
  }
}

/** Keep players from standing on top of each other. */
function separate(sim: Sim) {
  const bs = sim.bodies;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i];
      const b = bs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = len(dx, dy);
      if (d > 0 && d < 1.8) {
        const push = (1.8 - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
}

function attachBall(sim: Sim) {
  const ball = sim.ball;
  if (!ball.owner) return;
  ball.x = ball.owner.x + ball.owner.fx * 0.9;
  ball.y = ball.owner.y + ball.owner.fy * 0.9;
  ball.z = 0;
}

// ---------------------------------------------------------------------------
// Passing, shooting, tackling
// ---------------------------------------------------------------------------

function kickPass(sim: Sim, target: Body, rng: Rng, passer: Body) {
  const ball = sim.ball;
  const d0 = dist(passer, target);
  // Lead the receiver a little.
  const lead = Math.min(1.2, d0 / 18);
  const tx = target.x + target.vx * lead;
  const ty = target.y + target.vy * lead;
  const d = Math.hypot(tx - ball.x, ty - ball.y) || 1;
  const pressure = nearestOpponent(sim, passer, passer.team) < 2.2 ? 0.04 : 0;
  const sigma = Math.max(0.015, (PASS_ERROR.base - PASS_ERROR.perStar * stars(sim, passer, "passing") + pressure - 0.006 * stars(sim, passer, "composure")) * (1 + d / 45));
  const angle = Math.atan2(ty - ball.y, tx - ball.x) + gauss(rng) * sigma;
  const lofted = d > LOFT_DISTANCE;
  let speed: number;
  if (lofted) {
    speed = clamp(d / 1.5, 14, 25);
    ball.vz = (GRAVITY * (d / speed)) / 2;
  } else {
    speed = Math.min(27, Math.sqrt(PASS_ARRIVAL_SPEED ** 2 + 2 * BALL_FRICTION * d));
    ball.vz = 0;
  }
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.owner = null;
  ball.lastTouch = passer;
  ball.kickedAt = sim.time;
  ball.intended = target;
  ball.beaten = new Set();
  ball.shooter = null;
}

/** `aim` is -1 (left of goal as the shooter sees it) to 1 (right). */
function shoot(sim: Sim, b: Body, power: number, aim: number, rng: Rng) {
  const ball = sim.ball;
  const gx = goalX(b.team);
  const side = b.team === "us" ? 1 : -1;
  const ty = 34 + clamp(aim, -1, 1) * side * (GOAL_WIDTH / 2 - 0.5);
  const d = Math.hypot(gx - ball.x, ty - ball.y);
  const pressure = nearestOpponent(sim, b, b.team) < 2.2 ? 0.04 : 0;
  const sigma = Math.max(0.02, SHOT_ERROR.base - SHOT_ERROR.perStar * stars(sim, b, "finishing") + pressure - 0.006 * stars(sim, b, "composure") + d / 220);
  const angle = Math.atan2(ty - ball.y, gx - ball.x) + gauss(rng) * sigma;
  const speed = SHOT_SPEED.min + (SHOT_SPEED.max - SHOT_SPEED.min) * power;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  // Harder hit, more lift; over-hitting from range can fly over.
  ball.vz = 0.8 + power * 2.6 + Math.abs(gauss(rng)) * (0.5 + d / 40);
  ball.owner = null;
  ball.lastTouch = b;
  ball.kickedAt = sim.time;
  ball.intended = null;
  ball.beaten = new Set();
  ball.shooter = b;
  ball.keeperTried = false;
  sim.shots[b.team]++;
}

function tackle(sim: Sim, tackler: Body, carrier: Body, rng: Rng) {
  const kept = duel(sim, carrier, ["dribbling", "strength"], tackler, ["defending"], TACKLE_TARGET, rng);
  if (kept) {
    tackler.beatenUntil = sim.time + BEATEN_TIME;
  } else {
    carrier.beatenUntil = sim.time + BEATEN_TIME * 0.6;
    giveBall(sim, tackler);
    tackler.nextThink = sim.time + AI_REACTION;
    if (tackler.f.isUser || carrier.f.isUser) sim.events.push({ kind: "tackle", team: tackler.team, text: tackler.f.isUser ? "Won it!" : "Tackled" });
  }
}

// ---------------------------------------------------------------------------
// The ball
// ---------------------------------------------------------------------------

function moveBall(sim: Sim, dt: number, rng: Rng) {
  const ball = sim.ball;
  if (ball.owner) {
    attachBall(sim);
    return;
  }

  // Flight and roll.
  if (ball.z > 0 || ball.vz > 0) {
    ball.vz -= GRAVITY * dt;
    ball.z += ball.vz * dt;
    const drag = 1 - BALL_DRAG * dt;
    ball.vx *= drag;
    ball.vy *= drag;
    if (ball.z <= 0) {
      ball.z = 0;
      if (ball.vz < -1.5) {
        ball.vz = -ball.vz * BOUNCE;
        ball.vx *= 0.85;
        ball.vy *= 0.85;
      } else ball.vz = 0;
    }
  } else {
    const sp = len(ball.vx, ball.vy);
    const next = Math.max(0, sp - BALL_FRICTION * dt);
    if (sp > 0) {
      ball.vx *= next / sp;
      ball.vy *= next / sp;
    }
  }
  const px = ball.x;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  keeperSave(sim, rng);
  if (ball.owner) return;
  if (outOfPlay(sim, px, rng)) return;
  pickUp(sim, rng);
}

function pickUp(sim: Sim, rng: Rng) {
  const ball = sim.ball;
  const fresh = sim.time - ball.kickedAt < 0.25;
  const candidates = sim.bodies
    .map((b) => ({ b, d: dist(b, ball) }))
    .filter(({ b, d }) => {
      if (fresh && b === ball.lastTouch) return false;
      if (b.f.position === "GK") return d < CONTROL_RADIUS + 0.4 && ball.z < KEEPER_HEIGHT;
      return d < CONTROL_RADIUS && ball.z < CONTROL_HEIGHT;
    })
    .sort((a, b) => a.d - b.d);

  for (const { b } of candidates) {
    if (ball.beaten.has(b)) continue;
    const kicker = ball.lastTouch;
    const opposed = kicker && kicker.team !== b.team && (ball.intended || ball.shooter);
    if (opposed) {
      // Cutting out a pass or blocking a shot: the same stars-against-stars roll.
      const stat: Stat = ball.shooter ? "finishing" : "passing";
      if (duel(sim, kicker, [stat], b, ["defending"], INTERCEPT_TARGET, rng)) {
        ball.beaten.add(b);
        continue;
      }
      if (b.f.isUser || kicker.f.isUser) sim.events.push({ kind: "intercept", team: b.team, text: b.f.isUser ? "Intercepted!" : "Cut out" });
    }
    giveBall(sim, b);
    b.nextThink = sim.time + FIRST_TOUCH * (0.6 + rng() * 0.8);
    return;
  }
}

function keeperSave(sim: Sim, rng: Rng) {
  const ball = sim.ball;
  const shooter = ball.shooter;
  if (!shooter || ball.keeperTried) return;
  const defending = other(shooter.team);
  const keeper = sim.bodies.find((b) => b.team === defending && b.f.position === "GK")!;
  const line = goalX(shooter.team);
  const vx = ball.vx;
  if ((line - ball.x) * vx <= 0) return;
  const t = (line - ball.x) / vx;
  if (t > 0.9) return;
  const yAt = ball.y + ball.vy * t;
  const zAt = Math.max(0, ball.z + ball.vz * t - 0.5 * GRAVITY * t * t);
  const onTarget = Math.abs(yAt - 34) < GOAL_WIDTH / 2 + 0.2 && zAt < GOAL_HEIGHT;
  if (!onTarget) return;
  ball.keeperTried = true;

  const reach = KEEPER_REACH.base + KEEPER_REACH.perStar * stars(sim, keeper, "keeping") + topSpeed(sim, keeper) * t * 0.7;
  const gap = Math.abs(yAt - keeper.y);
  // The keeper flings themselves towards it either way.
  keeper.ty = yAt;
  keeper.tx = line + (shooter.team === "us" ? -0.6 : 0.6);
  if (gap > reach + 0.6) return;

  const speed = len(ball.vx, ball.vy);
  const stretch = gap > reach ? -3 : gap > reach * 0.6 ? -1 : 1;
  const mod = (rating(sim, keeper, ["keeping"]) - rating(sim, shooter, ["finishing"])) * 2 + stretch - Math.max(0, speed - 22) / 3;
  if (rng() >= chanceToMeet(mod, 6)) return;

  if (speed < 21 && rng() < 0.35 + stars(sim, keeper, "keeping") * 0.08) {
    giveBall(sim, keeper);
    keeper.nextThink = 0;
  } else {
    // Parried away from goal.
    ball.vx = -ball.vx * 0.3;
    ball.vy = (rng() - 0.5) * 14;
    ball.vz = 1 + rng() * 2;
    ball.shooter = null;
    ball.intended = null;
    ball.lastTouch = keeper;
    ball.kickedAt = sim.time;
  }
  sim.events.push({ kind: "save", team: keeper.team, text: keeper.f.isUser ? "What a save!" : `Saved by ${keeper.f.name}` });
}

function outOfPlay(sim: Sim, prevX: number, rng: Rng): boolean {
  const ball = sim.ball;
  const last = ball.lastTouch;
  if (ball.y < -0.3 || ball.y > PITCH_W + 0.3) {
    // Throw-in to the other side, from where it went out.
    const team = last ? other(last.team) : "us";
    const x = clamp(ball.x, 1, PITCH_L - 1);
    const y = ball.y < 0 ? 0.3 : PITCH_W - 0.3;
    const taker = sim.bodies.filter((b) => b.team === team && b.f.position !== "GK").sort((a, b) => dist(a, { x, y }) - dist(b, { x, y }))[0];
    restart(sim, taker, x, y);
    return true;
  }
  if (ball.x >= 0 && ball.x <= PITCH_L) return false;

  const end: Team = ball.x > PITCH_L ? "them" : "us"; // whose goal it is
  const crossingY = ball.y;
  if (Math.abs(crossingY - 34) < GOAL_WIDTH / 2 && ball.z < GOAL_HEIGHT && prevX >= 0 && prevX <= PITCH_L) {
    const scorer = other(end);
    sim.score[scorer]++;
    const by = ball.lastTouch;
    const own = by && by.team === end;
    sim.events.push({
      kind: "goal",
      team: scorer,
      text: own ? `Own goal! ${sim.score.us}–${sim.score.them}` : `GOAL! ${by ? (by.f.isUser ? "You" : by.f.name) : ""} ${sim.score.us}–${sim.score.them}`,
    });
    ball.vx = ball.vy = ball.vz = 0;
    ball.x = clamp(ball.x, -1.5, PITCH_L + 1.5);
    sim.phase = "goal";
    sim.phaseUntil = sim.time + GOAL_PAUSE;
    sim.kickingOff = end;
    return true;
  }
  if (ball.shooter) sim.events.push({ kind: "miss", team: ball.shooter.team, text: ball.shooter.f.isUser ? "Just wide!" : "Wide" });
  const attackers = other(end);
  if (last && last.team === end) {
    // Corner.
    const cx = end === "them" ? PITCH_L - 0.5 : 0.5;
    const cy = ball.y < 34 ? 0.5 : PITCH_W - 0.5;
    const taker = sim.bodies.filter((b) => b.team === attackers && b.f.position !== "GK").sort((a, b) => dist(a, { x: cx, y: cy }) - dist(b, { x: cx, y: cy }))[0];
    restart(sim, taker, cx, cy);
  } else {
    // Goal kick.
    const keeper = sim.bodies.find((b) => b.team === end && b.f.position === "GK")!;
    restart(sim, keeper, end === "them" ? PITCH_L - 5.5 : 5.5, 34 + (rng() - 0.5) * 8);
    keeper.nextThink = 0;
  }
  return true;
}

/** What the buttons should offer right now. */
export function situation(sim: Sim) {
  const owner = sim.ball.owner;
  return {
    onBall: owner === sim.controlled,
    attacking: owner ? owner.team === "us" : sim.ball.lastTouch?.team === "us",
    canTackle: !!owner && owner.team !== "us" && dist(sim.controlled, owner) <= TACKLE_RANGE + 1.5,
  };
}
