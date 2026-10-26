import {
  BACKGROUND_EVENT_CHANCE,
  BACKGROUND_GOAL_CHANCE,
  DEFENDING_SHARE,
  DIVE_MODIFIER,
  INVOLVEMENT_CHANCE,
  MATCH_LENGTH,
  MINUTES_PER_TICK,
  NEXT_ZONE,
  SHOT_DISTANCE_MODIFIER,
  SHOT_ZONES,
  STARTING_ZONE,
  TARGETS,
  ZONE_LABELS,
  goalZoneSide,
  statModifier,
} from "./config";
import { check, passed, type Rng } from "./dice";
import type { Action, CheckResult, GoalZone, LogEntry, MatchState, Player, Situation, Team } from "./types";

const TEAM_NAMES: Record<Team, string> = { us: "Your side", them: "The opposition" };

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function log(state: MatchState, text: string, tone: LogEntry["tone"] = "neutral", roll?: CheckResult): MatchState {
  const entry: LogEntry = { id: state.nextLogId, minute: state.minute, text, tone, roll };
  return { ...state, log: [...state.log, entry], nextLogId: state.nextLogId + 1 };
}

function recordRoll(state: MatchState, success: boolean): MatchState {
  return {
    ...state,
    stats: { rolls: state.stats.rolls + 1, successes: state.stats.successes + (success ? 1 : 0) },
  };
}

function scoreGoal(state: MatchState, team: Team): MatchState {
  return { ...state, score: { ...state.score, [team]: state.score[team] + 1 } };
}

export function startMatch(player: Player): MatchState {
  const state: MatchState = {
    player,
    minute: 0,
    score: { us: 0, them: 0 },
    log: [],
    situation: null,
    running: false,
    finished: false,
    stats: { rolls: 0, successes: 0 },
    nextLogId: 1,
  };
  return log(state, "Kick-off.");
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

  if (rng() < INVOLVEMENT_CHANCE[next.player.position]) {
    return involve(next, rng);
  }

  if (rng() < BACKGROUND_EVENT_CHANCE) {
    return backgroundEvent(next, rng);
  }

  return next;
}

function involve(state: MatchState, rng: Rng): MatchState {
  const position = state.player.position;
  let situation: Situation;
  let text: string;

  if (position === "GK") {
    const shotZone = pick(Object.keys(SHOT_ZONES) as GoalZone[], rng);
    situation = { kind: "facingShot", shotZone };
    text = pick(
      [
        "Their striker's through on goal. One-on-one.",
        "A shot's coming in from the edge of the box.",
        "Cross comes in, it's headed goalwards.",
      ],
      rng,
    );
  } else if (rng() < DEFENDING_SHARE[position]) {
    situation = { kind: "defending" };
    text = "One of theirs is running at you with the ball.";
  } else {
    const zone = STARTING_ZONE[position];
    situation = { kind: "onBall", zone };
    text = `The ball comes to you in ${ZONE_LABELS[zone]}.`;
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
// Decisions
// ---------------------------------------------------------------------------

export function availableActions(situation: Situation): Action["kind"][] {
  switch (situation.kind) {
    case "onBall":
      return situation.zone === "finalThird" || situation.zone === "box"
        ? ["pass", "dribble", "shoot"]
        : ["pass", "dribble"];
    case "pickShot":
      return ["shootAt"];
    case "defending":
      return ["tackle"];
    case "facingShot":
      return ["dive"];
  }
}

export function resolve(state: MatchState, action: Action, rng: Rng = Math.random): MatchState {
  const situation = state.situation;
  if (!situation) return state;
  const attrs = state.player.attributes;

  switch (action.kind) {
    case "pass": {
      if (situation.kind !== "onBall") return state;
      const result = check([{ label: "Passing", value: statModifier(attrs.passing) }], TARGETS.pass, rng);
      const ok = passed(result);
      const next = recordRoll({ ...state, situation: null }, ok);
      return ok
        ? log(next, "Pass finds a teammate. Possession kept.", "good", result)
        : log(next, "Pass is cut out.", "bad", result);
    }

    case "dribble": {
      if (situation.kind !== "onBall") return state;
      const result = check([{ label: "Dribbling", value: statModifier(attrs.dribbling) }], TARGETS.dribble, rng);
      const ok = passed(result);
      if (!ok) {
        return log(recordRoll({ ...state, situation: null }, false), "Tackled. Ball's gone.", "bad", result);
      }
      const zone = NEXT_ZONE[situation.zone];
      return log(
        recordRoll({ ...state, situation: { kind: "onBall", zone } }, true),
        `You skip past your man and carry it into ${ZONE_LABELS[zone]}.`,
        "good",
        result,
      );
    }

    case "shoot": {
      if (situation.kind !== "onBall") return state;
      return { ...state, situation: { kind: "pickShot", zone: situation.zone } };
    }

    case "shootAt": {
      if (situation.kind !== "pickShot") return state;
      const zone = SHOT_ZONES[action.target];
      const result = check(
        [
          { label: "Shooting", value: statModifier(attrs.shooting) },
          { label: "Distance", value: SHOT_DISTANCE_MODIFIER[situation.zone] ?? 0 },
        ],
        zone.beatsKeeper,
        rng,
      );
      const base = { ...state, situation: null };
      if (result.total >= zone.beatsKeeper) {
        const scored = scoreGoal(recordRoll(base, true), "us");
        return log(
          scored,
          `GOAL! You put it ${zone.label.toLowerCase()}. ${scored.score.us}–${scored.score.them}.`,
          "goal",
          result,
        );
      }
      if (result.total >= zone.onTarget) {
        return log(recordRoll(base, false), `On target, ${zone.label.toLowerCase()}, but the keeper saves it.`, "bad", result);
      }
      return log(recordRoll(base, false), `Aimed ${zone.label.toLowerCase()}. Missed the target.`, "bad", result);
    }

    case "tackle": {
      if (situation.kind !== "defending") return state;
      const result = check([{ label: "Tackling", value: statModifier(attrs.tackling) }], TARGETS.tackle, rng);
      const ok = passed(result);
      if (ok) {
        return log(
          recordRoll({ ...state, situation: { kind: "onBall", zone: "ownHalf" } }, true),
          "Clean tackle. You've won it back.",
          "good",
          result,
        );
      }
      return log(recordRoll({ ...state, situation: null }, false), "They've gone past you.", "bad", result);
    }

    case "dive": {
      if (situation.kind !== "facingShot") return state;
      const correct = goalZoneSide(situation.shotZone) === action.direction;
      const result = check(
        [
          { label: "Goalkeeping", value: statModifier(attrs.goalkeeping) },
          { label: correct ? "Right way" : "Wrong way", value: correct ? DIVE_MODIFIER.correct : DIVE_MODIFIER.wrong },
        ],
        TARGETS.save,
        rng,
      );
      const ok = passed(result);
      const where = SHOT_ZONES[situation.shotZone].label.toLowerCase();
      const base = recordRoll({ ...state, situation: null }, ok);
      if (ok) return log(base, `Shot goes ${where}. Saved!`, "good", result);
      const conceded = scoreGoal(base, "them");
      return log(
        conceded,
        `Shot goes ${where}. Beaten. ${conceded.score.us}–${conceded.score.them}.`,
        "goal",
        result,
      );
    }
  }
}
