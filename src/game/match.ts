import {
  ACTIONS_PER_TICK,
  AI_SHOT_ZONE_WEIGHTS,
  BASE_ACTIONS,
  DIVE_MODIFIER,
  FATIGUE,
  HEADER,
  INVOLVEMENT_NUDGE,
  MATCH_LENGTH,
  MINUTES_PER_TICK,
  MIRROR_ZONE,
  MODIFIER_PER_HALF_STAR,
  NEXT_ZONE,
  ONE_ON_ONE,
  POSITIONS,
  ROLES,
  SHOT_DISTANCE_MODIFIER,
  SHOT_ZONES,
  STAT_LABELS,
  STYLES,
  TARGETS,
  ZONE_LABELS,
  goalZoneSide,
} from "./config";
import { check, meets, mirror, passed, type Rng } from "./dice";
import type {
  Action,
  BallAction,
  CheckResult,
  Choice,
  DiveDirection,
  Footballer,
  GoalZone,
  LogEntry,
  MatchState,
  Modifier,
  Side,
  Situation,
  Stat,
  Team,
  Zone,
} from "./types";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const other = (team: Team): Team => (team === "us" ? "them" : "us");

function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: Rng): T {
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

function find(state: MatchState, id: string): Footballer {
  for (const side of Object.values(state.sides)) {
    const p = side.players.find((x) => x.id === id);
    if (p) return p;
  }
  throw new Error(`No player ${id}`);
}

function keeperOf(state: MatchState, team: Team): Footballer {
  return state.sides[team].players.find((p) => p.position === "GK")!;
}

function styleOf(state: MatchState, team: Team) {
  return STYLES[state.sides[team].style];
}

/** "You" or the player's name. */
function who(p: Footballer): string {
  return p.isUser ? "You" : p.name;
}

function log(state: MatchState, text: string, tone: LogEntry["tone"] = "neutral", roll?: CheckResult): MatchState {
  const entry: LogEntry = { id: state.nextLogId, minute: state.minute, text, tone, roll };
  return { ...state, log: [...state.log, entry], nextLogId: state.nextLogId + 1 };
}

function giveBall(state: MatchState, team: Team, carrierId: string, zone: Zone, oneOnOne = false): MatchState {
  return { ...state, possession: { team, carrierId, zone, oneOnOne } };
}

function kickOff(state: MatchState, team: Team, rng: Rng): MatchState {
  const mids = state.sides[team].players.filter((p) => ["CM", "DM", "AM", "LM", "RM"].includes(p.position));
  const taker = mids.length ? mids[Math.floor(rng() * mids.length)] : state.sides[team].players[5];
  return giveBall(state, team, taker.id, "midfield");
}

/** Keeper has it in their hands. */
function keeperRestart(state: MatchState, team: Team): MatchState {
  return giveBall(state, team, keeperOf(state, team).id, "defence");
}

/** Short goal kick to a defender. */
function goalKick(state: MatchState, team: Team, rng: Rng): MatchState {
  const taker = pickReceiver(state, team, "defence", keeperOf(state, team).id, rng);
  return giveBall(state, team, taker.id, "defence");
}

function scoreGoal(state: MatchState, team: Team, rng: Rng): MatchState {
  const scored = { ...state, score: { ...state.score, [team]: state.score[team] + 1 } };
  return kickOff(scored, other(team), rng);
}

function scoreline(state: MatchState): string {
  return `${state.score.us}–${state.score.them}`;
}

// ---------------------------------------------------------------------------
// Stars and rolls
// ---------------------------------------------------------------------------

/** A stat after fatigue. Stamina pushes fatigue back; some styles bring it forward. */
export function effectiveStars(state: MatchState, p: Footballer, stat: Stat): number {
  const base = p.stats[stat];
  if (stat === "stamina") return base;
  const start =
    FATIGUE.startsAt + p.stats.stamina * FATIGUE.minutesPerStaminaStar - styleOf(state, p.team).fatigueEarlier;
  if (state.minute <= start) return base;
  const lost = Math.min(FATIGUE.maxStarsLost, Math.floor((state.minute - start) / FATIGUE.minutesPerHalfStarLost) * 0.5);
  return Math.max(0, base - lost);
}

/** One stat, or the average of two rounded down to the half star. */
function rating(state: MatchState, p: Footballer, stats: Stat[]): number {
  const avg = stats.reduce((sum, s) => sum + effectiveStars(state, p, s), 0) / stats.length;
  return Math.floor(avg * 2) / 2;
}

function statLabel(stats: Stat[]): string {
  return stats.map((s) => STAT_LABELS[s]).join("/");
}

function opposedModifier(
  state: MatchState,
  attacker: Footballer,
  aStats: Stat[],
  defender: Footballer,
  dStats: Stat[],
): Modifier {
  const a = rating(state, attacker, aStats);
  const d = rating(state, defender, dStats);
  const mine = (p: Footballer) => (p.isUser ? "Your" : `${p.name}'s`);
  return {
    label: `${attacker.isUser ? "Your " : ""}${statLabel(aStats)} ${a}★ vs ${mine(defender)} ${statLabel(dStats)} ${d}★`,
    mirrorLabel: `${mine(defender)} ${statLabel(dStats)} ${d}★ vs ${mine(attacker)} ${statLabel(aStats)} ${a}★`,
    value: ((a - d) / 0.5) * MODIFIER_PER_HALF_STAR,
  };
}

/** Defending team's style squeezing the attacker in certain areas. */
function squeeze(state: MatchState, defendingTeam: Team, zone: Zone): Modifier[] {
  const style = styleOf(state, defendingTeam);
  return style.squeezes.includes(zone) ? [{ label: `Their ${style.label.toLowerCase()}`, mirrorLabel: `Your ${style.label.toLowerCase()}`, value: -1 }] : [];
}

interface Contest {
  state: MatchState;
  result: CheckResult;
  ok: boolean;
  /** The roll as the user should see it, if they're involved. */
  shown: CheckResult;
  userInvolved: boolean;
  /** Whether it went the user's way (only meaningful if userInvolved). */
  userWon: boolean;
}

/**
 * Every contest on the pitch goes through here, whoever's involved. The attacker rolls;
 * if the user is defending, they see the identical roll from their side.
 */
function contest(
  state: MatchState,
  attacker: Footballer,
  aStats: Stat[],
  defender: Footballer,
  dStats: Stat[],
  target: number,
  extra: Modifier[],
  rng: Rng,
  mirrorThreshold?: number,
): Contest {
  const result = check(who(attacker), [opposedModifier(state, attacker, aStats, defender, dStats), ...extra], target, rng);
  const ok = passed(result);
  const userInvolved = attacker.isUser || defender.isUser;
  const userWon = attacker.isUser ? ok : !ok;
  const shown = defender.isUser ? mirror(result, "You", mirrorThreshold) : result;
  let next = state;
  if (userInvolved) {
    next = {
      ...state,
      lastInvolved: state.minute,
      stats: { rolls: state.stats.rolls + 1, successes: state.stats.successes + (userWon ? 1 : 0) },
    };
  }
  return { state: next, result, ok, shown, userInvolved, userWon };
}

function toneFor(c: Contest): LogEntry["tone"] {
  return c.userWon ? "good" : "bad";
}

// ---------------------------------------------------------------------------
// Who gets the ball, who challenges for it
// ---------------------------------------------------------------------------

function nudge(state: MatchState, p: Footballer): number {
  if (!p.isUser) return 1;
  const since = state.minute - state.lastInvolved;
  if (state.minute > 0 && since >= INVOLVEMENT_NUDGE.cooldownFrom && since < INVOLVEMENT_NUDGE.cooldownTo) {
    return INVOLVEMENT_NUDGE.cooldownWeight;
  }
  const idle = since - INVOLVEMENT_NUDGE.afterMinutes;
  return idle > 0 ? 1 + idle * INVOLVEMENT_NUDGE.weightPerMinute : 1;
}

function presence(state: MatchState, p: Footballer, zone: Zone): number {
  const base = POSITIONS[p.position].presence[zone] ?? 0;
  const role = ROLES[p.role].presence?.[zone] ?? 1;
  const wide = POSITIONS[p.position].lane !== "centre" ? styleOf(state, p.team).widePresence : 1;
  return base * role * wide;
}

function pickReceiver(state: MatchState, team: Team, zone: Zone, excludeId: string, rng: Rng): Footballer {
  const candidates = state.sides[team].players.filter((p) => p.id !== excludeId);
  return pickWeighted(candidates, (p) => presence(state, p, zone) * nudge(state, p), rng);
}

/** The opponent who challenges, given where the ball is for the attacking side. */
function pickDefender(state: MatchState, attacker: Footballer, zone: Zone, rng: Rng): Footballer {
  const defZone = MIRROR_ZONE[zone];
  const aLane = POSITIONS[attacker.position].lane;
  const facing = aLane === "left" ? "right" : aLane === "right" ? "left" : "centre";
  const candidates = state.sides[other(attacker.team)].players.filter((p) => p.position !== "GK");
  return pickWeighted(
    candidates,
    (p) => {
      const laneMatch = POSITIONS[p.position].lane === facing ? (facing === "centre" ? 1.5 : 3) : 1;
      const boxBias = zone === "box" && p.position === "CB" ? 2 : 1;
      return presence(state, p, defZone) * laneMatch * boxBias * nudge(state, p);
    },
    rng,
  );
}

// ---------------------------------------------------------------------------
// Setting up and running the clock
// ---------------------------------------------------------------------------

export function startMatch(sides: Record<Team, Side>, rng: Rng = Math.random): MatchState {
  const user = [...sides.us.players, ...sides.them.players].find((p) => p.isUser)!;
  const state: MatchState = {
    sides,
    userId: user.id,
    minute: 0,
    score: { us: 0, them: 0 },
    shots: { us: 0, them: 0 },
    possession: { team: "us", carrierId: sides.us.players[6].id, zone: "midfield", oneOnOne: false },
    log: [],
    situation: null,
    lastInvolved: 0,
    running: false,
    finished: false,
    stats: { rolls: 0, successes: 0 },
    nextLogId: 1,
  };
  return log(kickOff(state, "us", rng), "Kick-off.");
}

export function tick(state: MatchState, rng: Rng = Math.random): MatchState {
  if (state.finished || state.situation) return state;

  let next: MatchState = { ...state, minute: state.minute + MINUTES_PER_TICK };

  if (next.minute >= MATCH_LENGTH) {
    next = { ...next, minute: MATCH_LENGTH, running: false, finished: true };
    return log(next, `Full time. ${next.sides.us.name} ${scoreline(next)} ${next.sides.them.name}.`);
  }

  if (state.minute < MATCH_LENGTH / 2 && next.minute >= MATCH_LENGTH / 2) {
    next = log(kickOff(next, "them", rng), `Half-time. ${scoreline(next)}.`);
  }

  for (let i = 0; i < ACTIONS_PER_TICK && !next.situation; i++) next = step(next, rng);
  return next;
}

/** Whoever has the ball does something with it. */
function step(state: MatchState, rng: Rng): MatchState {
  const { carrierId, zone, oneOnOne } = state.possession;
  const carrier = find(state, carrierId);

  if (oneOnOne) return startOneOnOne(state, carrier, rng);

  if (carrier.isUser) {
    const defender = pickDefender(state, carrier, zone, rng);
    return stop(state, { kind: "onBall", zone, defenderId: defender.id }, `The ball's with you in ${ZONE_LABELS[zone]}.`);
  }

  return performBall(state, carrier, aiBallAction(state, carrier, rng), rng);
}

function stop(state: MatchState, situation: Situation, text: string): MatchState {
  return log({ ...state, situation, running: false, lastInvolved: state.minute }, text, "you");
}

function availableActions(state: MatchState, carrier: Footballer): BallAction[] {
  const zone = state.possession.zone;
  if (carrier.position === "GK") return ["shortPass", "longBall"];
  const wide = POSITIONS[carrier.position].lane !== "centre";
  return (Object.keys(BASE_ACTIONS[zone]) as BallAction[]).filter((a) => a !== "cross" || wide);
}

function aiBallAction(state: MatchState, carrier: Footballer, rng: Rng): BallAction {
  const zone = state.possession.zone;
  const role = ROLES[carrier.role].actions ?? {};
  const style = styleOf(state, carrier.team).actions;
  return pickWeighted(
    availableActions(state, carrier),
    (a) => (BASE_ACTIONS[zone][a] ?? 1) * (role[a] ?? 1) * (style[a] ?? 1),
    rng,
  );
}

// ---------------------------------------------------------------------------
// Things you do with the ball
// ---------------------------------------------------------------------------

function performBall(state: MatchState, carrier: Footballer, action: BallAction, rng: Rng, defenderId?: string): MatchState {
  const zone = state.possession.zone;
  const defender = defenderId ? find(state, defenderId) : pickDefender(state, carrier, zone, rng);
  const defStyle = styleOf(state, defender.team);

  switch (action) {
    case "shortPass":
    case "oneTwo":
    case "throughBall": {
      if (defender.isUser) {
        return stop(state, { kind: "defendPass", passerId: carrier.id, pass: action, zone }, passWarning(carrier, action));
      }
      const response = rng() < defStyle.interceptChance ? "intercept" : "hold";
      return resolvePass(state, carrier, defender, action, response, rng);
    }
    case "dribble": {
      if (defender.isUser) {
        return stop(state, { kind: "defendDribble", attackerId: carrier.id, zone }, `${carrier.name} is running at you.`);
      }
      const response = rng() < defStyle.tackleChance ? "tackle" : "jockey";
      return resolveDribble(state, carrier, defender, response, rng);
    }
    case "longBall":
      return resolveLongBall(state, carrier, rng);
    case "cross":
      return resolveCross(state, carrier, defender, rng);
    case "shoot":
      return aiShoot(state, carrier, rng);
  }
}

function passWarning(passer: Footballer, pass: "shortPass" | "oneTwo" | "throughBall"): string {
  const what = pass === "throughBall" ? "a ball in behind" : pass === "oneTwo" ? "a one-two" : "a pass";
  return `${passer.name} is looking for ${what} through your area.`;
}

function resolvePass(
  state: MatchState,
  passer: Footballer,
  defender: Footballer,
  pass: "shortPass" | "oneTwo" | "throughBall",
  response: "intercept" | "hold",
  rng: Rng,
): MatchState {
  const zone = state.possession.zone;
  const c = contest(state, passer, ["passing"], defender, ["defending"], TARGETS[pass][response], squeeze(state, defender.team, zone), rng);
  let next = c.state;

  if (!c.ok) {
    next = giveBall(next, defender.team, defender.id, MIRROR_ZONE[zone]);
    if (!c.userInvolved) return next;
    const text = passer.isUser ? "Your pass is cut out." : "You read it and win the ball.";
    return log(next, text, toneFor(c), c.shown);
  }

  if (pass === "oneTwo") {
    const ahead = NEXT_ZONE[zone];
    next = giveBall(next, passer.team, passer.id, ahead);
    if (!c.userInvolved) return next;
    return log(next, passer.isUser ? `Give and go. You're into ${ZONE_LABELS[ahead]}.` : `${passer.name} plays the one-two round you.`, toneFor(c), c.shown);
  }

  if (pass === "throughBall") {
    const runner = pickReceiver(next, passer.team, "box", passer.id, rng);
    next = giveBall(next, passer.team, runner.id, "box", true);
    const text = passer.isUser
      ? `Perfect ball. ${who(runner)} ${runner.isUser ? "are" : "is"} through.`
      : defender.isUser
        ? `${passer.name} threads it past you. ${who(runner)} ${runner.isUser ? "are" : "is"} through.`
        : `${passer.name} slides ${who(runner)} through on goal.`;
    return log(next, text, c.userInvolved ? toneFor(c) : runner.isUser ? "you" : "neutral", c.userInvolved ? c.shown : undefined);
  }

  // Short pass: a good pass past a committed defender moves the ball up; otherwise it might.
  const ahead = response === "intercept" || rng() < 0.6 ? NEXT_ZONE[zone] : zone;
  const receiver = pickReceiver(next, passer.team, ahead, passer.id, rng);
  next = giveBall(next, passer.team, receiver.id, ahead);
  if (!c.userInvolved) return next;
  if (defender.isUser && response === "hold") {
    // Holding was never about winning it, just not getting caught out.
    return log(next, `You hold your shape. ${passer.name} keeps it ticking over.`, "neutral", c.shown);
  }
  const text = passer.isUser
    ? zone === "box"
      ? `You square it to ${receiver.name}.`
      : `Pass finds ${receiver.isUser ? "you" : receiver.name}.`
    : `${passer.name} gets the pass past you.`;
  return log(next, text, toneFor(c), c.shown);
}

function resolveDribble(
  state: MatchState,
  attacker: Footballer,
  defender: Footballer,
  response: "tackle" | "jockey",
  rng: Rng,
): MatchState {
  const zone = state.possession.zone;
  const c = contest(
    state,
    attacker,
    ["dribbling", "speed"],
    defender,
    ["defending"],
    TARGETS.dribble[response],
    squeeze(state, defender.team, zone),
    rng,
  );
  let next = c.state;

  if (c.ok) {
    const ahead = NEXT_ZONE[zone];
    const clean = response === "tackle" && zone === "box";
    next = giveBall(next, attacker.team, attacker.id, ahead, clean);
    if (!c.userInvolved) return next;
    const text = attacker.isUser
      ? clean
        ? "You leave the defender on the floor. Just the keeper now."
        : `You get past and carry it into ${ZONE_LABELS[ahead]}.`
      : response === "tackle"
        ? `${attacker.name} skips past your challenge.`
        : `${attacker.name} edges past you.`;
    return log(next, text, toneFor(c), c.shown);
  }

  if (response === "tackle") {
    next = giveBall(next, defender.team, defender.id, MIRROR_ZONE[zone]);
    if (!c.userInvolved) return next;
    return log(next, attacker.isUser ? `${defender.name} takes it off you.` : "Clean tackle. Your ball.", toneFor(c), c.shown);
  }

  // Jockeyed successfully: attacker keeps it but goes nowhere.
  if (!c.userInvolved) return next;
  return log(next, attacker.isUser ? `${defender.name} shows you back. No way through.` : `You show ${attacker.name} back. No way through.`, toneFor(c), c.shown);
}

function resolveLongBall(state: MatchState, passer: Footballer, rng: Rng): MatchState {
  const target = pickReceiver(state, passer.team, "attack", passer.id, rng);
  const marker = pickDefender(state, target, "attack", rng);
  const c = contest(state, passer, ["passing"], marker, ["defending"], TARGETS.longBall, [], rng);
  let next = c.state;
  if (!c.ok) {
    next = giveBall(next, marker.team, marker.id, "defence");
    if (!c.userInvolved) return next;
    return log(next, passer.isUser ? `Long ball. ${marker.name} deals with it.` : `You deal with ${passer.name}'s long ball.`, toneFor(c), c.shown);
  }
  next = giveBall(next, passer.team, target.id, "attack");
  if (!c.userInvolved) {
    return target.isUser ? log(next, `${passer.name} finds you with a long ball.`, "you") : next;
  }
  return log(next, passer.isUser ? `Long ball finds ${target.name}.` : `${passer.name}'s long ball gets over you.`, toneFor(c), c.shown);
}

function resolveCross(state: MatchState, crosser: Footballer, defender: Footballer, rng: Rng): MatchState {
  const c = contest(state, crosser, ["passing"], defender, ["defending"], TARGETS.cross, squeeze(state, defender.team, "attack"), rng);
  let next = c.state;
  if (!c.ok) {
    next = giveBall(next, defender.team, defender.id, "defence");
    if (!c.userInvolved) return next;
    return log(next, crosser.isUser ? `${defender.name} blocks your cross.` : `You block ${crosser.name}'s cross.`, toneFor(c), c.shown);
  }
  if (c.userInvolved) {
    next = log(next, crosser.isUser ? "You whip a cross into the box." : `${crosser.name} gets the cross in past you.`, toneFor(c), c.shown);
  }

  const target = pickReceiver(next, crosser.team, "box", crosser.id, rng);
  const marker = pickDefender(next, target, "box", rng);
  const keeper = keeperOf(next, other(crosser.team));

  if (target.isUser) {
    return stop(next, { kind: "crossToYou", crosserId: crosser.id, markerId: marker.id }, `${who(crosser)}'s cross is coming your way.`);
  }
  if (keeper.isUser) {
    return stop(next, { kind: "keeperCross", crosserId: crosser.id, targetId: target.id }, `${crosser.name} swings a cross in towards ${target.name}.`);
  }
  return keeperDealsWithCross(next, target, marker, keeper, aiKeeperCrossChoice(keeper, rng), rng);
}

function aiKeeperCrossChoice(keeper: Footballer, rng: Rng): "claim" | "punch" | "stay" {
  const claim = keeper.role === "sweeperKeeper" ? 0.4 : 0.25;
  const r = rng();
  return r < claim ? "claim" : r < claim + 0.2 ? "punch" : "stay";
}

function keeperDealsWithCross(
  state: MatchState,
  target: Footballer,
  marker: Footballer,
  keeper: Footballer,
  choice: "claim" | "punch" | "stay",
  rng: Rng,
): MatchState {
  if (choice === "stay") return headerDuel(state, target, marker, keeper, rng);

  const c = contest(state, target, ["aerial"], keeper, ["keeping"], choice === "claim" ? TARGETS.keeperClaim : TARGETS.keeperPunch, [], rng);
  let next = c.state;
  if (!c.ok) {
    const text =
      choice === "claim"
        ? keeper.isUser
          ? "You come and take it cleanly."
          : `${keeper.name} comes and claims it.`
        : keeper.isUser
          ? "You punch it well clear."
          : `${keeper.name} punches it clear.`;
    next = choice === "claim" ? keeperRestart(next, keeper.team) : giveBall(next, keeper.team, pickReceiver(next, keeper.team, "defence", keeper.id, rng).id, "defence");
    return log(next, text, c.userInvolved ? toneFor(c) : "neutral", c.userInvolved ? c.shown : undefined);
  }
  // Keeper's come and missed it: free header.
  next = log(
    next,
    keeper.isUser ? `You come for it and miss. ${target.name} gets there first.` : `${keeper.name} flaps at it.`,
    c.userInvolved ? toneFor(c) : "neutral",
    c.userInvolved ? c.shown : undefined,
  );
  return header(next, target, keeper, rng);
}

function headerDuel(state: MatchState, target: Footballer, marker: Footballer, keeper: Footballer, rng: Rng): MatchState {
  const c = contest(state, target, ["aerial"], marker, ["aerial"], TARGETS.headerDuel, [], rng);
  let next = c.state;
  if (!c.ok) {
    next = giveBall(next, marker.team, marker.id, "defence");
    if (!c.userInvolved) return next;
    return log(next, target.isUser ? `${marker.name} wins the header.` : `You win the header and clear it.`, toneFor(c), c.shown);
  }
  if (c.userInvolved) {
    next = log(next, target.isUser ? "You win the header." : `${target.name} gets above you.`, toneFor(c), c.shown);
  }
  return header(next, target, keeper, rng);
}

function header(state: MatchState, target: Footballer, keeper: Footballer, rng: Rng): MatchState {
  return finishShot(state, target, keeper, ["aerial"], HEADER, "box", [], "a header", rng);
}

// ---------------------------------------------------------------------------
// Shooting
// ---------------------------------------------------------------------------

function aiGoalZone(rng: Rng): GoalZone {
  return pickWeighted(Object.keys(AI_SHOT_ZONE_WEIGHTS) as GoalZone[], (z) => AI_SHOT_ZONE_WEIGHTS[z], rng);
}

function aiDive(rng: Rng): DiveDirection {
  return (["left", "centre", "right"] as DiveDirection[])[Math.floor(rng() * 3)];
}

function diveModifier(goalZone: GoalZone, dive: DiveDirection): Modifier {
  const right = goalZoneSide(goalZone) === dive;
  return {
    label: right ? "Keeper guessed right" : "Keeper guessed wrong",
    mirrorLabel: right ? "You guessed right" : "You guessed wrong",
    value: right ? DIVE_MODIFIER.right : DIVE_MODIFIER.wrong,
  };
}

function aiShoot(state: MatchState, shooter: Footballer, rng: Rng): MatchState {
  const keeper = keeperOf(state, other(shooter.team));
  const goalZone = aiGoalZone(rng);
  const zone = state.possession.zone;
  if (keeper.isUser) {
    return stop(state, { kind: "keeperShot", shooterId: shooter.id, shotZone: goalZone, zone }, `${shooter.name} is lining up a shot from ${zone === "box" ? "inside the box" : "distance"}.`);
  }
  return shootAt(state, shooter, keeper, goalZone, zone, aiDive(rng), rng);
}

function shootAt(
  state: MatchState,
  shooter: Footballer,
  keeper: Footballer,
  goalZone: GoalZone,
  zone: Zone,
  dive: DiveDirection,
  rng: Rng,
): MatchState {
  const extra = [{ label: "Distance", value: SHOT_DISTANCE_MODIFIER[zone] ?? 0 }, diveModifier(goalZone, dive)];
  return finishShot(state, shooter, keeper, ["finishing"], SHOT_ZONES[goalZone], zone, extra, SHOT_ZONES[goalZone].label.toLowerCase(), rng);
}

/** Miss, saved or goal from one roll against two thresholds. Used by every shot on the pitch. */
function finishShot(
  state: MatchState,
  shooter: Footballer,
  keeper: Footballer,
  aStats: Stat[],
  thresholds: { onTarget: number; beatsKeeper: number },
  zone: Zone,
  extra: Modifier[],
  where: string,
  rng: Rng,
): MatchState {
  const c = contest(state, shooter, aStats, keeper, ["keeping"], thresholds.beatsKeeper, [...extra, ...squeeze(state, keeper.team, zone)], rng, thresholds.beatsKeeper);
  let next = { ...c.state, shots: { ...c.state.shots, [shooter.team]: c.state.shots[shooter.team] + 1 } };
  const roll = c.userInvolved ? c.shown : c.result;
  const name = who(shooter);

  if (c.ok) {
    next = scoreGoal(next, shooter.team, rng);
    return log(next, `GOAL! ${name} ${shooter.isUser ? "put" : "puts"} it ${where === "a header" ? "in with a header" : where}. ${scoreline(next)}.`, "goal", roll);
  }
  if (meets(c.result, thresholds.onTarget)) {
    const held = rng() < 0.4;
    next = held ? keeperRestart(next, keeper.team) : giveBall(next, keeper.team, pickReceiver(next, keeper.team, "defence", keeper.id, rng).id, "defence");
    const saver = keeper.isUser ? "You save" : `${keeper.name} saves`;
    return log(next, `${name} ${shooter.isUser ? "go" : "goes"} for ${where}. ${saver} it${held ? " and holds on" : ""}.`, c.userInvolved ? toneFor(c) : "neutral", roll);
  }
  next = goalKick(next, keeper.team, rng);
  return log(next, `${name} ${shooter.isUser ? "go" : "goes"} for ${where}. Off target.`, c.userInvolved ? toneFor(c) : "neutral", roll);
}

// ---------------------------------------------------------------------------
// One-on-ones
// ---------------------------------------------------------------------------

function startOneOnOne(state: MatchState, attacker: Footballer, rng: Rng): MatchState {
  const keeper = keeperOf(state, other(attacker.team));
  const cleared = { ...state, possession: { ...state.possession, oneOnOne: false } };
  if (attacker.isUser) return stop(cleared, { kind: "oneOnOne" }, "You're clean through. Just the keeper to beat.");
  const plan = rng() < 0.65 ? "shoot" : "round";
  if (keeper.isUser) {
    return stop(cleared, { kind: "keeperOneOnOne", attackerId: attacker.id, attackerPlan: plan }, `${attacker.name} is clean through on you.`);
  }
  const response = rng() < (keeper.role === "sweeperKeeper" ? 0.7 : 0.4) ? "rushOut" : "standTall";
  return resolveOneOnOne(cleared, attacker, keeper, plan, response, plan === "shoot" ? aiGoalZone(rng) : null, rng);
}

function resolveOneOnOne(
  state: MatchState,
  attacker: Footballer,
  keeper: Footballer,
  plan: "shoot" | "round",
  response: "rushOut" | "standTall",
  goalZone: GoalZone | null,
  rng: Rng,
): MatchState {
  const keeperMod: Modifier = {
    label: response === "rushOut" ? "Keeper rushed out" : "Keeper stood tall",
    mirrorLabel: response === "rushOut" ? "You rushed out" : "You stood tall",
    value: ONE_ON_ONE[response][plan],
  };
  if (plan === "shoot" && goalZone) {
    const zone = SHOT_ZONES[goalZone];
    return finishShot(state, attacker, keeper, ["finishing", "composure"], zone, "box", [keeperMod], zone.label.toLowerCase(), rng);
  }
  const c = contest(state, attacker, ["dribbling", "composure"], keeper, ["keeping"], TARGETS.roundKeeper, [keeperMod], rng);
  let next = c.state;
  if (c.ok) {
    next = scoreGoal({ ...next, shots: { ...next.shots, [attacker.team]: next.shots[attacker.team] + 1 } }, attacker.team, rng);
    return log(next, `GOAL! ${who(attacker)} ${attacker.isUser ? "take" : "takes"} it round ${keeper.isUser ? "you" : keeper.name} and ${attacker.isUser ? "roll" : "rolls"} it in. ${scoreline(next)}.`, "goal", c.userInvolved ? c.shown : c.result);
  }
  next = keeperRestart(next, keeper.team);
  const text = keeper.isUser
    ? `You smother it at ${attacker.name}'s feet.`
    : `${keeper.name} smothers it at ${attacker.isUser ? "your" : `${attacker.name}'s`} feet.`;
  return log(next, text, c.userInvolved ? toneFor(c) : "neutral", c.userInvolved ? c.shown : c.result);
}

// ---------------------------------------------------------------------------
// What the user can choose, and what happens when they do
// ---------------------------------------------------------------------------

const BALL_LABELS: Record<BallAction, string> = {
  shortPass: "Pass",
  oneTwo: "One-two",
  throughBall: "Through ball",
  longBall: "Long ball",
  cross: "Cross",
  dribble: "Dribble",
  shoot: "Shoot",
};

export function describe(state: MatchState, situation: Situation): string {
  switch (situation.kind) {
    case "onBall": {
      const d = find(state, situation.defenderId);
      return `You're on the ball in ${ZONE_LABELS[situation.zone]}. ${d.name} (${d.position}) is closest.`;
    }
    case "pickShot":
      return "Where are you putting it?";
    case "oneOnOne":
      return `Just you and ${keeperOf(state, "them").name}.`;
    case "crossToYou":
      return `The cross is coming to you. ${find(state, situation.markerId).name} is marking you.`;
    case "defendDribble":
      return `${find(state, situation.attackerId).name} is running at you.`;
    case "defendPass":
      return `${find(state, situation.passerId).name} is about to play it.`;
    case "keeperShot":
      return `${find(state, situation.shooterId).name} is about to shoot. Which way are you going?`;
    case "keeperCross":
      return `The cross is dropping towards ${find(state, situation.targetId).name}.`;
    case "keeperOneOnOne":
      return `${find(state, situation.attackerId).name} is bearing down on you.`;
  }
}

/** Dice needed for a contest the user is about to roll, once the stars are counted. */
function needsAsAttacker(state: MatchState, me: Footballer, aStats: Stat[], them: Footballer, dStats: Stat[], target: number, extra: Modifier[] = []) {
  const m = opposedModifier(state, me, aStats, them, dStats).value + extra.reduce((s, x) => s + x.value, 0);
  return Math.min(12, Math.max(2, target - m));
}

function needsAsDefender(state: MatchState, them: Footballer, aStats: Stat[], me: Footballer, dStats: Stat[], target: number, extra: Modifier[] = []) {
  const m = opposedModifier(state, them, aStats, me, dStats).value + extra.reduce((s, x) => s + x.value, 0);
  return Math.min(12, Math.max(2, 15 - target + m));
}

export function choices(state: MatchState, situation: Situation): Choice[] {
  const me = find(state, state.userId);
  switch (situation.kind) {
    case "onBall": {
      const d = find(state, situation.defenderId);
      const sq = squeeze(state, d.team, situation.zone);
      return availableActions(state, me).map((a) => {
        let needs: number | undefined;
        if (a === "dribble") needs = needsAsAttacker(state, me, ["dribbling", "speed"], d, ["defending"], TARGETS.dribble.tackle, sq);
        if (a === "shortPass" || a === "oneTwo" || a === "throughBall") needs = needsAsAttacker(state, me, ["passing"], d, ["defending"], TARGETS[a].intercept, sq);
        if (a === "cross") needs = needsAsAttacker(state, me, ["passing"], d, ["defending"], TARGETS.cross, sq);
        const label = me.position === "GK" ? (a === "shortPass" ? "Throw it short" : "Kick it long") : situation.zone === "box" && a === "shortPass" ? "Square it" : BALL_LABELS[a];
        return { action: { kind: "ball", action: a }, label, needs };
      });
    }
    case "pickShot":
      return [];
    case "oneOnOne":
      return [
        { action: { kind: "ball", action: "shoot" }, label: "Shoot" },
        { action: { kind: "roundKeeper" }, label: "Round the keeper" },
      ];
    case "crossToYou": {
      const marker = find(state, situation.markerId);
      return [
        { action: { kind: "header" }, label: "Attack the header", needs: needsAsAttacker(state, me, ["aerial"], marker, ["aerial"], TARGETS.headerDuel) },
        { action: { kind: "control" }, label: "Bring it down", needs: needsAsAttacker(state, me, ["dribbling"], marker, ["defending"], TARGETS.control) },
      ];
    }
    case "defendDribble": {
      const a = find(state, situation.attackerId);
      const sq = squeeze(state, me.team, situation.zone);
      return [
        { action: { kind: "tackle" }, label: "Tackle", needs: needsAsDefender(state, a, ["dribbling", "speed"], me, ["defending"], TARGETS.dribble.tackle, sq) },
        { action: { kind: "jockey" }, label: "Jockey them", needs: needsAsDefender(state, a, ["dribbling", "speed"], me, ["defending"], TARGETS.dribble.jockey, sq) },
      ];
    }
    case "defendPass": {
      const a = find(state, situation.passerId);
      const sq = squeeze(state, me.team, situation.zone);
      const t = TARGETS[situation.pass];
      return [
        { action: { kind: "intercept" }, label: "Step in and intercept", needs: needsAsDefender(state, a, ["passing"], me, ["defending"], t.intercept, sq) },
        { action: { kind: "holdPosition" }, label: "Hold your position" },
      ];
    }
    case "keeperShot":
      return (["left", "centre", "right"] as DiveDirection[]).map((direction) => ({
        action: { kind: "dive", direction },
        label: direction === "centre" ? "Stay central" : `Dive ${direction}`,
      }));
    case "keeperCross": {
      const target = find(state, situation.targetId);
      return [
        { action: { kind: "claim" }, label: "Come and claim it", needs: needsAsDefender(state, target, ["aerial"], me, ["keeping"], TARGETS.keeperClaim) },
        { action: { kind: "punch" }, label: "Punch it clear", needs: needsAsDefender(state, target, ["aerial"], me, ["keeping"], TARGETS.keeperPunch) },
        { action: { kind: "stayOnLine" }, label: "Stay on your line" },
      ];
    }
    case "keeperOneOnOne":
      return [
        { action: { kind: "rushOut" }, label: "Rush out" },
        { action: { kind: "standTall" }, label: "Stand tall" },
      ];
  }
}

/** Dice needed for each spot when you shoot (before the keeper's guess, which you can't see). */
export function shotNeeds(state: MatchState, situation: Extract<Situation, { kind: "pickShot" }>) {
  const me = find(state, state.userId);
  const keeper = keeperOf(state, other(me.team));
  const aStats: Stat[] = situation.oneOnOne ? ["finishing", "composure"] : ["finishing"];
  const extra = [{ label: "Distance", value: SHOT_DISTANCE_MODIFIER[situation.zone] ?? 0 }, ...squeeze(state, keeper.team, situation.zone)];
  return (goalZone: GoalZone) => ({
    onTarget: needsAsAttacker(state, me, aStats, keeper, ["keeping"], SHOT_ZONES[goalZone].onTarget, extra),
    goal: needsAsAttacker(state, me, aStats, keeper, ["keeping"], SHOT_ZONES[goalZone].beatsKeeper, extra),
  });
}

export function resolve(state: MatchState, action: Action, rng: Rng = Math.random): MatchState {
  const situation = state.situation;
  if (!situation) return state;
  const me = find(state, state.userId);
  const clear: MatchState = { ...state, situation: null };

  switch (situation.kind) {
    case "onBall": {
      if (action.kind !== "ball") return state;
      if (action.action === "shoot") return { ...state, situation: { kind: "pickShot", zone: situation.zone, oneOnOne: false } };
      return performBall(clear, me, action.action, rng, situation.defenderId);
    }

    case "oneOnOne": {
      if (action.kind === "ball" && action.action === "shoot") {
        return { ...state, situation: { kind: "pickShot", zone: "box", oneOnOne: true } };
      }
      if (action.kind !== "roundKeeper") return state;
      const keeper = keeperOf(state, other(me.team));
      const response = rng() < (keeper.role === "sweeperKeeper" ? 0.7 : 0.4) ? "rushOut" : "standTall";
      return resolveOneOnOne(clear, me, keeper, "round", response, null, rng);
    }

    case "pickShot": {
      if (action.kind !== "shootAt") return state;
      const keeper = keeperOf(state, other(me.team));
      if (situation.oneOnOne) {
        const response = rng() < (keeper.role === "sweeperKeeper" ? 0.7 : 0.4) ? "rushOut" : "standTall";
        return resolveOneOnOne(clear, me, keeper, "shoot", response, action.target, rng);
      }
      return shootAt(clear, me, keeper, action.target, situation.zone, aiDive(rng), rng);
    }

    case "crossToYou": {
      const marker = find(state, situation.markerId);
      if (action.kind === "header") {
        const keeper = keeperOf(state, other(me.team));
        return keeperDealsWithCross(clear, me, marker, keeper, aiKeeperCrossChoice(keeper, rng), rng);
      }
      if (action.kind !== "control") return state;
      const c = contest(clear, me, ["dribbling"], marker, ["defending"], TARGETS.control, [], rng);
      if (!c.ok) return log(giveBall(c.state, marker.team, marker.id, "defence"), `Heavy touch. ${marker.name} clears it.`, "bad", c.shown);
      return log(giveBall(c.state, me.team, me.id, "box"), "You kill it dead in the box.", "good", c.shown);
    }

    case "defendDribble": {
      if (action.kind !== "tackle" && action.kind !== "jockey") return state;
      return resolveDribble(clear, find(state, situation.attackerId), me, action.kind, rng);
    }

    case "defendPass": {
      if (action.kind !== "intercept" && action.kind !== "holdPosition") return state;
      return resolvePass(clear, find(state, situation.passerId), me, situation.pass, action.kind === "intercept" ? "intercept" : "hold", rng);
    }

    case "keeperShot": {
      if (action.kind !== "dive") return state;
      return shootAt(clear, find(state, situation.shooterId), me, situation.shotZone, situation.zone, action.direction, rng);
    }

    case "keeperCross": {
      const target = find(state, situation.targetId);
      const marker = pickDefender(clear, target, "box", rng);
      const choice = action.kind === "claim" ? "claim" : action.kind === "punch" ? "punch" : action.kind === "stayOnLine" ? "stay" : null;
      if (!choice) return state;
      return keeperDealsWithCross(clear, target, marker, me, choice, rng);
    }

    case "keeperOneOnOne": {
      if (action.kind !== "rushOut" && action.kind !== "standTall") return state;
      const attacker = find(state, situation.attackerId);
      const goalZone = situation.attackerPlan === "shoot" ? aiGoalZone(rng) : null;
      return resolveOneOnOne(clear, attacker, me, situation.attackerPlan, action.kind, goalZone, rng);
    }
  }
}

export { find as findPlayer, keeperOf };
