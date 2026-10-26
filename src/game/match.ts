import {
  BACKGROUND_EVENT_CHANCE,
  BACKGROUND_GOAL_CHANCE,
  CHANCES,
  DIVE_MODIFIER,
  HEADER,
  INVOLVEMENT_GAP,
  MATCH_LENGTH,
  MINUTES_PER_TICK,
  NEXT_ZONE,
  ONE_ON_ONE_MODIFIER,
  OPENERS,
  SHOT_DISTANCE_MODIFIER,
  SHOT_ZONES,
  STARTING_ZONE,
  TARGETS,
  ZONE_LABELS,
  goalZoneSide,
  statModifier,
} from "./config";
import { check, passed, type Rng } from "./dice";
import type {
  Action,
  Attributes,
  CheckResult,
  Choice,
  GoalZone,
  LogEntry,
  MatchState,
  Modifier,
  Opener,
  Player,
  Situation,
  Team,
} from "./types";

const TEAM_NAMES: Record<Team, string> = { us: "Your side", them: "The opposition" };

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function pickWeighted<T extends string>(table: Partial<Record<T, number>>, rng: Rng): T {
  const entries = Object.entries(table) as [T, number][];
  let roll = rng() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}

function randomGoalZone(rng: Rng): GoalZone {
  return pick(Object.keys(SHOT_ZONES) as GoalZone[], rng);
}

function log(state: MatchState, text: string, tone: LogEntry["tone"] = "neutral", roll?: CheckResult): MatchState {
  const entry: LogEntry = { id: state.nextLogId, minute: state.minute, text, tone, roll };
  return { ...state, log: [...state.log, entry], nextLogId: state.nextLogId + 1 };
}

function scoreGoal(state: MatchState, team: Team): MatchState {
  return { ...state, score: { ...state.score, [team]: state.score[team] + 1 } };
}

function scheduleNext(state: MatchState, rng: Rng): MatchState {
  const { min, max } = INVOLVEMENT_GAP[state.player.position];
  return { ...state, nextInvolvement: state.minute + min + Math.floor(rng() * (max - min + 1)) };
}

export function startMatch(player: Player, rng: Rng = Math.random): MatchState {
  const state: MatchState = {
    player,
    minute: 0,
    score: { us: 0, them: 0 },
    log: [],
    situation: null,
    nextInvolvement: 0,
    running: false,
    finished: false,
    stats: { rolls: 0, successes: 0 },
    nextLogId: 1,
  };
  return log(scheduleNext(state, rng), "Kick-off.");
}

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

export function tick(state: MatchState, rng: Rng = Math.random): MatchState {
  if (state.finished || state.situation) return state;

  let next: MatchState = { ...state, minute: state.minute + MINUTES_PER_TICK };

  if (next.minute >= MATCH_LENGTH) {
    next = { ...next, minute: MATCH_LENGTH, running: false, finished: true };
    return log(next, `Full time. ${TEAM_NAMES.us} ${next.score.us}–${next.score.them} ${TEAM_NAMES.them}.`);
  }

  if (state.minute < MATCH_LENGTH / 2 && next.minute >= MATCH_LENGTH / 2) {
    next = log(next, `Half-time. ${next.score.us}–${next.score.them}.`);
  }

  if (next.minute >= next.nextInvolvement) {
    return involve(scheduleNext(next, rng), rng);
  }

  if (rng() < BACKGROUND_EVENT_CHANCE) {
    return backgroundEvent(next, rng);
  }

  return next;
}

const OPENER_LINES: Record<Exclude<Opener, "toFeet" | "toFeetAdvanced">, string[]> = {
  throughOnGoal: ["A ball over the top and you're through. Just the keeper to beat."],
  crossToYou: ["Cross coming in from the right. It's heading your way.", "Whipped ball in from the left, towards you."],
  runAtYou: ["One of theirs is running at you with the ball.", "Their winger's coming straight at you."],
  passThrough: ["They're trying to thread a pass through your area."],
  shotAtYou: ["A shot's coming in from the edge of the box.", "Cross comes in, it's headed goalwards.", "They've worked a shooting chance."],
  crossIntoBox: ["Cross swinging in towards your six-yard box."],
  oneOnOneAgainst: ["Their striker's through on goal. One-on-one."],
};

function involve(state: MatchState, rng: Rng): MatchState {
  const position = state.player.position;
  const opener = pickWeighted(OPENERS[position], rng);
  let situation: Situation;
  let text: string;

  if (opener === "toFeet" || opener === "toFeetAdvanced") {
    const start = position === "GK" ? "ownHalf" : STARTING_ZONE[position];
    const zone = opener === "toFeet" ? start : NEXT_ZONE[start];
    situation = { kind: "onBall", zone };
    text = pick(
      [
        `The ball comes to you in ${ZONE_LABELS[zone]}.`,
        `A teammate finds you in ${ZONE_LABELS[zone]}.`,
        `You pick it up in ${ZONE_LABELS[zone]}.`,
      ],
      rng,
    );
  } else {
    text = pick(OPENER_LINES[opener], rng);
    switch (opener) {
      case "throughOnGoal":
        situation = { kind: "oneOnOne" };
        break;
      case "crossToYou":
        situation = { kind: "crossIncoming" };
        break;
      case "runAtYou":
        situation = { kind: "runAtYou" };
        break;
      case "passThrough":
        situation = { kind: "passThrough" };
        break;
      case "shotAtYou":
        situation = { kind: "facingShot", shotZone: randomGoalZone(rng) };
        break;
      case "crossIntoBox":
        situation = { kind: "crossIntoBox" };
        break;
      case "oneOnOneAgainst":
        situation = { kind: "oneOnOneAgainst" };
        break;
    }
  }

  return log({ ...state, situation, running: false }, text, "you");
}

const BACKGROUND_LINES = {
  goal: ["find the bottom corner.", "score from close range.", "head it in at the back post."],
  noGoal: [
    "fire over the bar.",
    "drag a shot wide.",
    "win a corner, but nothing comes of it.",
    "have a shot blocked.",
    "have a decent spell of possession.",
  ],
};

function backgroundEvent(state: MatchState, rng: Rng): MatchState {
  const team: Team = rng() < 0.5 ? "us" : "them";
  // A keeper should never concede without being involved, so their goals only come through a save roll.
  const canScore = !(team === "them" && state.player.position === "GK");

  if (canScore && rng() < BACKGROUND_GOAL_CHANCE) {
    const scored = scoreGoal(state, team);
    return log(
      scored,
      `GOAL! ${TEAM_NAMES[team]} ${pick(BACKGROUND_LINES.goal, rng)} ${scored.score.us}–${scored.score.them}.`,
      "goal",
    );
  }

  return log(state, `${TEAM_NAMES[team]} ${pick(BACKGROUND_LINES.noGoal, rng)}`);
}

// ---------------------------------------------------------------------------
// What you can do
// ---------------------------------------------------------------------------

export function describe(situation: Situation): string {
  switch (situation.kind) {
    case "onBall":
      return `You're on the ball in ${ZONE_LABELS[situation.zone]}.`;
    case "pickShot":
      return "Where are you putting it?";
    case "oneOnOne":
      return "Just you and the keeper.";
    case "crossIncoming":
      return "The cross is coming to you.";
    case "runAtYou":
      return "They're running at you.";
    case "passThrough":
      return "The pass is coming through.";
    case "facingShot":
      return "Which way are you going?";
    case "crossIntoBox":
      return "The cross is dropping into your area.";
    case "oneOnOneAgainst":
      return "They're bearing down on you.";
    case "ballInHands":
      return "Ball's in your hands.";
  }
}

/** Choices for every situation except picking a shot, which has its own goal-mouth UI. */
export function choices(situation: Situation): Choice[] {
  switch (situation.kind) {
    case "onBall": {
      const pass: Choice = { action: { kind: "pass" }, label: "Pass", target: TARGETS.pass };
      const oneTwo: Choice = { action: { kind: "oneTwo" }, label: "One-two", target: TARGETS.oneTwo };
      const dribble: Choice = { action: { kind: "dribble" }, label: "Dribble", target: TARGETS.dribble };
      const through: Choice = { action: { kind: "throughBall" }, label: "Through ball", target: TARGETS.throughBall };
      const shoot: Choice = { action: { kind: "shoot" }, label: "Shoot" };
      switch (situation.zone) {
        case "ownHalf":
          return [pass, dribble, { action: { kind: "longBall" }, label: "Long ball", target: TARGETS.longBall }];
        case "midfield":
          return [pass, oneTwo, dribble, through];
        case "finalThird":
          return [pass, oneTwo, dribble, through, shoot];
        case "box":
          return [{ ...pass, label: "Square it" }, dribble, shoot];
      }
      break;
    }
    case "pickShot":
      return [];
    case "oneOnOne":
      return [
        { action: { kind: "shoot" }, label: "Shoot" },
        { action: { kind: "roundKeeper" }, label: "Round the keeper", target: TARGETS.roundKeeper },
      ];
    case "crossIncoming":
      return [
        { action: { kind: "header" }, label: "Go for the header", target: HEADER.beatsKeeper },
        { action: { kind: "control" }, label: "Bring it down", target: TARGETS.control },
      ];
    case "runAtYou":
      return [
        { action: { kind: "tackle" }, label: "Tackle", target: TARGETS.tackle },
        { action: { kind: "jockey" }, label: "Jockey them", target: TARGETS.jockey },
      ];
    case "passThrough":
      return [
        { action: { kind: "intercept" }, label: "Step in and intercept", target: TARGETS.intercept },
        { action: { kind: "holdPosition" }, label: "Hold your position" },
      ];
    case "facingShot":
      return [
        { action: { kind: "dive", direction: "left" }, label: "Dive left", target: TARGETS.save },
        { action: { kind: "dive", direction: "centre" }, label: "Stay central", target: TARGETS.save },
        { action: { kind: "dive", direction: "right" }, label: "Dive right", target: TARGETS.save },
      ];
    case "crossIntoBox":
      return [
        { action: { kind: "claim" }, label: "Come and claim it", target: TARGETS.claim },
        { action: { kind: "punch" }, label: "Punch it clear", target: TARGETS.punch },
        { action: { kind: "stayOnLine" }, label: "Stay on your line" },
      ];
    case "oneOnOneAgainst":
      return [
        { action: { kind: "rushOut" }, label: "Rush out", target: TARGETS.rushOut },
        { action: { kind: "standTall" }, label: "Stand tall" },
      ];
    case "ballInHands":
      return [
        { action: { kind: "throwShort" }, label: "Throw it short", target: TARGETS.throwShort },
        { action: { kind: "kickLong" }, label: "Kick it long", target: TARGETS.kickLong },
      ];
  }
}

// ---------------------------------------------------------------------------
// Resolving a choice
// ---------------------------------------------------------------------------

type Stat = keyof Attributes;

const STAT_LABELS: Record<Stat, string> = {
  shooting: "Shooting",
  passing: "Passing",
  dribbling: "Dribbling",
  tackling: "Tackling",
  goalkeeping: "Goalkeeping",
};

/** Roll against a target using one stat plus any situational modifiers, and count it. */
function attempt(state: MatchState, stat: Stat, target: number, rng: Rng, extra: Modifier[] = []) {
  const result = check(
    [{ label: STAT_LABELS[stat], value: statModifier(state.player.attributes[stat]) }, ...extra],
    target,
    rng,
  );
  const ok = passed(result);
  const counted: MatchState = {
    ...state,
    stats: { rolls: state.stats.rolls + 1, successes: state.stats.successes + (ok ? 1 : 0) },
  };
  return { result, ok, state: counted };
}

/** End the involvement and let the clock carry on. */
function done(state: MatchState): MatchState {
  return { ...state, situation: null };
}

function then(state: MatchState, situation: Situation): MatchState {
  return { ...state, situation };
}

/** Something you set up gets finished (or not) by a teammate. */
function teammateFinish(state: MatchState, chance: number, rng: Rng): MatchState {
  if (rng() < chance) {
    const scored = scoreGoal(state, "us");
    return log(scored, `GOAL! Your teammate finishes it. ${scored.score.us}–${scored.score.them}.`, "goal");
  }
  return log(state, pick(["Your teammate's shot is saved.", "Your teammate snatches at it and misses."], rng));
}

/** The opposition get past you. Outfield only: your own keeper is simulated. */
function opponentBreak(state: MatchState, rng: Rng): MatchState {
  if (rng() < CHANCES.opponentBreakScores) {
    const conceded = scoreGoal(state, "them");
    return log(conceded, `GOAL! They make it count. ${conceded.score.us}–${conceded.score.them}.`, "goal");
  }
  return log(state, pick(["Your keeper bails you out.", "They waste it. Lucky."], rng));
}

/** Miss, saved or goal from a single roll against two thresholds. */
function finish(
  state: MatchState,
  result: CheckResult,
  thresholds: { onTarget: number; beatsKeeper: number },
  what: string,
): MatchState {
  if (result.total >= thresholds.beatsKeeper) {
    const scored = scoreGoal(state, "us");
    return log(scored, `GOAL! ${what}. ${scored.score.us}–${scored.score.them}.`, "goal", result);
  }
  if (result.total >= thresholds.onTarget) {
    return log(state, `${what}, but the keeper saves it.`, "bad", result);
  }
  return log(state, `${what}. Off target.`, "bad", result);
}

export function resolve(state: MatchState, action: Action, rng: Rng = Math.random): MatchState {
  const situation = state.situation;
  if (!situation) return state;

  switch (action.kind) {
    // ---- On the ball -------------------------------------------------------
    case "pass": {
      if (situation.kind !== "onBall") return state;
      const r = attempt(done(state), "passing", TARGETS.pass, rng);
      if (!r.ok) return log(r.state, "Pass is cut out.", "bad", r.result);
      if (situation.zone === "box") {
        return teammateFinish(log(r.state, "You square it across the box.", "good", r.result), CHANCES.squareBallFinished, rng);
      }
      if (rng() < CHANCES.passReturned) {
        const zone = NEXT_ZONE[situation.zone];
        return then(
          log(r.state, `Pass finds a teammate, and they play it straight back into your path in ${ZONE_LABELS[zone]}.`, "good", r.result),
          { kind: "onBall", zone },
        );
      }
      return log(r.state, "Pass finds a teammate. Possession kept.", "good", r.result);
    }

    case "oneTwo": {
      if (situation.kind !== "onBall") return state;
      const r = attempt(state, "passing", TARGETS.oneTwo, rng);
      if (!r.ok) return log(done(r.state), "The return ball doesn't come. Move breaks down.", "bad", r.result);
      const zone = NEXT_ZONE[situation.zone];
      return then(log(r.state, `Give and go. You're in ${ZONE_LABELS[zone]}.`, "good", r.result), { kind: "onBall", zone });
    }

    case "dribble": {
      if (situation.kind !== "onBall") return state;
      const r = attempt(state, "dribbling", TARGETS.dribble, rng);
      if (!r.ok) return log(done(r.state), "Tackled. Ball's gone.", "bad", r.result);
      if (situation.zone === "box") {
        return then(log(r.state, "You beat the last defender. It's just the keeper.", "good", r.result), { kind: "oneOnOne" });
      }
      const zone = NEXT_ZONE[situation.zone];
      return then(
        log(r.state, `You skip past your man and carry it into ${ZONE_LABELS[zone]}.`, "good", r.result),
        { kind: "onBall", zone },
      );
    }

    case "throughBall": {
      if (situation.kind !== "onBall") return state;
      const r = attempt(done(state), "passing", TARGETS.throughBall, rng);
      if (!r.ok) return log(r.state, "Through ball's overhit.", "bad", r.result);
      return teammateFinish(log(r.state, "Perfect through ball. Your teammate's in.", "good", r.result), CHANCES.throughBallFinished, rng);
    }

    case "longBall": {
      if (situation.kind !== "onBall") return state;
      const r = attempt(done(state), "passing", TARGETS.longBall, rng);
      if (!r.ok) return log(r.state, "Long ball sails out of play.", "bad", r.result);
      return teammateFinish(log(r.state, "Long ball finds your forward. Your side are on the attack.", "good", r.result), CHANCES.longBallFinished, rng);
    }

    case "shoot": {
      if (situation.kind === "onBall") {
        return then(state, { kind: "pickShot", zone: situation.zone, extra: [] });
      }
      if (situation.kind === "oneOnOne") {
        return then(state, { kind: "pickShot", zone: "box", extra: [{ label: "One-on-one", value: ONE_ON_ONE_MODIFIER }] });
      }
      return state;
    }

    case "shootAt": {
      if (situation.kind !== "pickShot") return state;
      const zone = SHOT_ZONES[action.target];
      const r = attempt(done(state), "shooting", zone.beatsKeeper, rng, [
        { label: "Distance", value: SHOT_DISTANCE_MODIFIER[situation.zone] ?? 0 },
        ...situation.extra,
      ]);
      return finish(r.state, r.result, zone, `You aim ${zone.label.toLowerCase()}`);
    }

    case "roundKeeper": {
      if (situation.kind !== "oneOnOne") return state;
      const r = attempt(done(state), "dribbling", TARGETS.roundKeeper, rng);
      if (!r.ok) return log(r.state, "The keeper smothers it at your feet.", "bad", r.result);
      const scored = scoreGoal(r.state, "us");
      return log(scored, `GOAL! You take it round the keeper and roll it in. ${scored.score.us}–${scored.score.them}.`, "goal", r.result);
    }

    case "header": {
      if (situation.kind !== "crossIncoming") return state;
      const r = attempt(done(state), "shooting", HEADER.beatsKeeper, rng);
      return finish(r.state, r.result, HEADER, "You get your head on it");
    }

    case "control": {
      if (situation.kind !== "crossIncoming") return state;
      const r = attempt(state, "dribbling", TARGETS.control, rng);
      if (!r.ok) return log(done(r.state), "Heavy touch. It's cleared.", "bad", r.result);
      return then(log(r.state, "You kill it dead in the box.", "good", r.result), { kind: "onBall", zone: "box" });
    }

    // ---- Defending ---------------------------------------------------------
    case "tackle": {
      if (situation.kind !== "runAtYou") return state;
      const r = attempt(state, "tackling", TARGETS.tackle, rng);
      if (!r.ok) return opponentBreak(log(done(r.state), "They've gone past you.", "bad", r.result), rng);
      return then(log(r.state, "Clean tackle. You've won it back.", "good", r.result), { kind: "onBall", zone: winBackZone(state) });
    }

    case "jockey": {
      if (situation.kind !== "runAtYou") return state;
      const r = attempt(done(state), "tackling", TARGETS.jockey, rng);
      if (!r.ok) return opponentBreak(log(r.state, "They cut inside and get a shot away.", "bad", r.result), rng);
      return log(r.state, "You show them down the line. The attack fizzles out.", "good", r.result);
    }

    case "intercept": {
      if (situation.kind !== "passThrough") return state;
      const r = attempt(state, "tackling", TARGETS.intercept, rng);
      if (!r.ok) return opponentBreak(log(done(r.state), "You commit and miss it. They're in behind.", "bad", r.result), rng);
      return then(log(r.state, "Read it perfectly. Your ball.", "good", r.result), { kind: "onBall", zone: winBackZone(state) });
    }

    case "holdPosition": {
      if (situation.kind !== "passThrough") return state;
      return log(done(state), "You stay goal-side. They recycle it.");
    }

    // ---- Goalkeeping -------------------------------------------------------
    case "dive": {
      if (situation.kind !== "facingShot") return state;
      const correct = goalZoneSide(situation.shotZone) === action.direction;
      const r = attempt(state, "goalkeeping", TARGETS.save, rng, [
        { label: correct ? "Right way" : "Wrong way", value: correct ? DIVE_MODIFIER.correct : DIVE_MODIFIER.wrong },
      ]);
      const where = SHOT_ZONES[situation.shotZone].label.toLowerCase();
      if (!r.ok) {
        const conceded = scoreGoal(done(r.state), "them");
        return log(conceded, `Shot goes ${where}. Beaten. ${conceded.score.us}–${conceded.score.them}.`, "goal", r.result);
      }
      if (rng() < CHANCES.saveHeld) {
        return then(log(r.state, `Shot goes ${where}. Saved and held!`, "good", r.result), { kind: "ballInHands" });
      }
      return log(done(r.state), `Shot goes ${where}. Pushed away to safety!`, "good", r.result);
    }

    case "claim": {
      if (situation.kind !== "crossIntoBox") return state;
      const r = attempt(state, "goalkeeping", TARGETS.claim, rng);
      if (!r.ok) {
        return then(log(r.state, "You flap at it. It drops to one of theirs.", "bad", r.result), {
          kind: "facingShot",
          shotZone: randomGoalZone(rng),
        });
      }
      return then(log(r.state, "You come through the crowd and take it cleanly.", "good", r.result), { kind: "ballInHands" });
    }

    case "punch": {
      if (situation.kind !== "crossIntoBox") return state;
      const r = attempt(state, "goalkeeping", TARGETS.punch, rng);
      if (!r.ok) {
        return then(log(r.state, "Weak punch. It falls straight back into the box.", "bad", r.result), {
          kind: "facingShot",
          shotZone: randomGoalZone(rng),
        });
      }
      return log(done(r.state), "You punch it well clear.", "good", r.result);
    }

    case "stayOnLine": {
      if (situation.kind !== "crossIntoBox") return state;
      return then(log(state, "You hold your line. They get a header in."), { kind: "facingShot", shotZone: randomGoalZone(rng) });
    }

    case "rushOut": {
      if (situation.kind !== "oneOnOneAgainst") return state;
      const r = attempt(state, "goalkeeping", TARGETS.rushOut, rng);
      if (!r.ok) {
        const conceded = scoreGoal(done(r.state), "them");
        return log(conceded, `They round you and walk it in. ${conceded.score.us}–${conceded.score.them}.`, "goal", r.result);
      }
      return then(log(r.state, "You're out quick and smother it at their feet.", "good", r.result), { kind: "ballInHands" });
    }

    case "standTall": {
      if (situation.kind !== "oneOnOneAgainst") return state;
      return then(log(state, "You stay big and make them pick a spot."), { kind: "facingShot", shotZone: randomGoalZone(rng) });
    }

    case "throwShort": {
      if (situation.kind !== "ballInHands") return state;
      const r = attempt(done(state), "passing", TARGETS.throwShort, rng);
      if (!r.ok) return log(r.state, "Throw's intercepted. Careless.", "bad", r.result);
      return log(r.state, "You roll it out to a full-back. Calm.", "good", r.result);
    }

    case "kickLong": {
      if (situation.kind !== "ballInHands") return state;
      const r = attempt(done(state), "passing", TARGETS.kickLong, rng);
      if (!r.ok) return log(r.state, "Long kick goes straight to them.", "bad", r.result);
      return teammateFinish(log(r.state, "Big kick finds your striker. Your side break.", "good", r.result), CHANCES.longBallFinished, rng);
    }
  }
}

function winBackZone(state: MatchState) {
  const position = state.player.position;
  return position === "GK" ? "ownHalf" : STARTING_ZONE[position] === "finalThird" ? "midfield" : "ownHalf";
}
