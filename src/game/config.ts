// Every tunable number lives here. All of these are placeholders to be argued over.
import type { DiveDirection, GoalZone, Opener, PitchZone, Player, Position } from "./types";

/** Match clock: 45 game minutes take 30 real seconds. */
export const MINUTES_PER_TICK = 1;
export const MATCH_LENGTH = 90;
export const TICK_MS = 30_000 / 45;

/** Game minutes between involvements, picked at random in this range each time. */
export const INVOLVEMENT_GAP: Record<Position, { min: number; max: number }> = {
  GK: { min: 10, max: 20 },
  DEF: { min: 5, max: 10 },
  MID: { min: 5, max: 10 },
  FWD: { min: 5, max: 10 },
};

/** How each position tends to get pulled in. Weights, not percentages. */
export const OPENERS: Record<Position, Partial<Record<Opener, number>>> = {
  GK: { shotAtYou: 45, crossIntoBox: 30, oneOnOneAgainst: 25 },
  DEF: { toFeet: 30, runAtYou: 35, passThrough: 35 },
  MID: { toFeet: 40, toFeetAdvanced: 15, runAtYou: 20, passThrough: 25 },
  FWD: { toFeet: 40, toFeetAdvanced: 10, throughOnGoal: 15, crossToYou: 25, runAtYou: 10 },
};

/** Chance per tick that something worth a commentary line happens without you. */
export const BACKGROUND_EVENT_CHANCE = 0.12;
/** When a background chance falls to a team, how often it goes in. */
export const BACKGROUND_GOAL_CHANCE = 0.22;

/** Stat (1–10) to dice modifier. 5 is average and gives +0. */
export function statModifier(stat: number): number {
  return Math.round((stat - 5) / 2);
}

/** Target numbers on 2d6 (roll + modifiers must meet or beat these). */
export const TARGETS = {
  pass: 6,
  oneTwo: 7,
  throughBall: 8,
  longBall: 8,
  dribble: 7,
  roundKeeper: 8,
  control: 6,
  tackle: 8,
  jockey: 6,
  intercept: 7,
  save: 8,
  claim: 8,
  punch: 6,
  rushOut: 8,
  throwShort: 5,
  kickLong: 8,
};

/** What happens after things you set up but don't finish yourself. */
export const CHANCES = {
  /** A completed short pass comes straight back to you, further up the pitch. */
  passReturned: 0.35,
  /** Teammate scores from your through ball. */
  throughBallFinished: 0.4,
  /** Teammate scores from your square ball in the box. */
  squareBallFinished: 0.45,
  /** Your long ball or kick sets up an attack that ends in a goal. */
  longBallFinished: 0.2,
  /** Opposition score after getting past you (outfield only; your keeper is simulated). */
  opponentBreakScores: 0.3,
  /** A successful save is held rather than parried. */
  saveHeld: 0.4,
};

/** Shooting from further out is harder. */
export const SHOT_DISTANCE_MODIFIER: Partial<Record<PitchZone, number>> = {
  finalThird: -2,
  box: 1,
};

export const ONE_ON_ONE_MODIFIER = 2;

/**
 * One roll per shot. Below `onTarget` misses the goal; at or above `beatsKeeper` scores;
 * anything in between is saved. Corners are hard to hit but go in if you do.
 */
export const SHOT_ZONES: Record<GoalZone, { label: string; onTarget: number; beatsKeeper: number }> = {
  topLeft: { label: "Top left", onTarget: 9, beatsKeeper: 9 },
  topCentre: { label: "Top centre", onTarget: 6, beatsKeeper: 10 },
  topRight: { label: "Top right", onTarget: 9, beatsKeeper: 9 },
  bottomLeft: { label: "Bottom left", onTarget: 7, beatsKeeper: 8 },
  bottomCentre: { label: "Bottom centre", onTarget: 4, beatsKeeper: 11 },
  bottomRight: { label: "Bottom right", onTarget: 7, beatsKeeper: 8 },
};

/** Headers use the same miss / saved / goal split as shots, without picking a spot. */
export const HEADER = { onTarget: 6, beatsKeeper: 9 };

/** Keeper: guessing the right side helps, guessing wrong hurts. */
export const DIVE_MODIFIER = { correct: 3, wrong: -3 };

export function goalZoneSide(zone: GoalZone): DiveDirection {
  if (zone.endsWith("Left")) return "left";
  if (zone.endsWith("Right")) return "right";
  return "centre";
}

export const ZONE_LABELS: Record<PitchZone, string> = {
  ownHalf: "your own half",
  midfield: "midfield",
  finalThird: "the final third",
  box: "the box",
};

export const NEXT_ZONE: Record<PitchZone, PitchZone> = {
  ownHalf: "midfield",
  midfield: "finalThird",
  finalThird: "box",
  box: "box",
};

export const STARTING_ZONE: Record<Exclude<Position, "GK">, PitchZone> = {
  DEF: "ownHalf",
  MID: "midfield",
  FWD: "finalThird",
};

export const POSITION_LABELS: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

/** Placeholder players, one per position. */
export const PLAYERS: Record<Position, Player> = {
  GK: {
    name: "You",
    position: "GK",
    attributes: { shooting: 2, passing: 5, dribbling: 3, tackling: 3, goalkeeping: 8 },
  },
  DEF: {
    name: "You",
    position: "DEF",
    attributes: { shooting: 3, passing: 6, dribbling: 4, tackling: 8, goalkeeping: 1 },
  },
  MID: {
    name: "You",
    position: "MID",
    attributes: { shooting: 6, passing: 8, dribbling: 6, tackling: 6, goalkeeping: 1 },
  },
  FWD: {
    name: "You",
    position: "FWD",
    attributes: { shooting: 8, passing: 5, dribbling: 7, tackling: 3, goalkeeping: 1 },
  },
};
