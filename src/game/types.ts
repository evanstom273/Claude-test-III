export type Position = "GK" | "DEF" | "MID" | "FWD";

export type Team = "us" | "them";

export interface Attributes {
  shooting: number;
  passing: number;
  dribbling: number;
  tackling: number;
  goalkeeping: number;
}

export interface Player {
  name: string;
  position: Position;
  attributes: Attributes;
}

/** Where on the pitch the player is when they have the ball. */
export type PitchZone = "ownHalf" | "midfield" | "finalThird" | "box";

export type GoalZone =
  | "topLeft"
  | "topCentre"
  | "topRight"
  | "bottomLeft"
  | "bottomCentre"
  | "bottomRight";

export type DiveDirection = "left" | "centre" | "right";

export interface Modifier {
  label: string;
  value: number;
}

export interface CheckResult {
  dice: [number, number];
  modifiers: Modifier[];
  total: number;
  target: number;
}

/** A moment where the clock stops and the player has to decide something. */
export type Situation =
  // Outfield, attacking
  | { kind: "onBall"; zone: PitchZone }
  | { kind: "pickShot"; zone: PitchZone; extra: Modifier[] }
  | { kind: "oneOnOne" }
  | { kind: "crossIncoming" }
  // Outfield, defending
  | { kind: "runAtYou" }
  | { kind: "passThrough" }
  // Goalkeeper
  | { kind: "facingShot"; shotZone: GoalZone }
  | { kind: "crossIntoBox" }
  | { kind: "oneOnOneAgainst" }
  | { kind: "ballInHands" };

/** How an involvement starts. Weighted per position in config. */
export type Opener =
  | "toFeet"
  | "toFeetAdvanced"
  | "throughOnGoal"
  | "crossToYou"
  | "runAtYou"
  | "passThrough"
  | "shotAtYou"
  | "crossIntoBox"
  | "oneOnOneAgainst";

export type Action =
  | { kind: "pass" }
  | { kind: "oneTwo" }
  | { kind: "dribble" }
  | { kind: "throughBall" }
  | { kind: "longBall" }
  | { kind: "shoot" }
  | { kind: "shootAt"; target: GoalZone }
  | { kind: "roundKeeper" }
  | { kind: "header" }
  | { kind: "control" }
  | { kind: "tackle" }
  | { kind: "jockey" }
  | { kind: "intercept" }
  | { kind: "holdPosition" }
  | { kind: "dive"; direction: DiveDirection }
  | { kind: "claim" }
  | { kind: "punch" }
  | { kind: "stayOnLine" }
  | { kind: "rushOut" }
  | { kind: "standTall" }
  | { kind: "throwShort" }
  | { kind: "kickLong" };

export interface Choice {
  action: Action;
  label: string;
  /** Target number on 2d6, if this choice involves a roll. */
  target?: number;
}

export interface LogEntry {
  id: number;
  minute: number;
  text: string;
  tone: "neutral" | "good" | "bad" | "goal" | "you";
  roll?: CheckResult;
}

export interface MatchState {
  player: Player;
  minute: number;
  score: Record<Team, number>;
  log: LogEntry[];
  situation: Situation | null;
  /** Game minute at which the player is next pulled into the action. */
  nextInvolvement: number;
  running: boolean;
  finished: boolean;
  stats: { rolls: number; successes: number };
  nextLogId: number;
}
