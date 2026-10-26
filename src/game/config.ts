// Every tunable number lives here. All of these are placeholders to be argued over.
import type { DiveDirection, GoalZone, PitchZone, Player, Position } from "./types";

/** Match clock. */
export const MINUTES_PER_TICK = 1;
export const MATCH_LENGTH = 90;
export const TICK_MS = 350;

/** Chance per tick that the player gets pulled into the action, by position. */
export const INVOLVEMENT_CHANCE: Record<Position, number> = {
  GK: 0.04,
  DEF: 0.08,
  MID: 0.1,
  FWD: 0.07,
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
  dribble: 7,
  tackle: 8,
  save: 8,
};

/** Shooting from further out is harder. */
export const SHOT_DISTANCE_MODIFIER: Partial<Record<PitchZone, number>> = {
  finalThird: -2,
  box: 1,
};

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

/** Off-the-ball involvements: how often an outfielder is defending rather than on the ball. */
export const DEFENDING_SHARE: Record<Exclude<Position, "GK">, number> = {
  DEF: 0.6,
  MID: 0.4,
  FWD: 0.15,
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
