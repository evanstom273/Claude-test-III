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
  | { kind: "onBall"; zone: PitchZone }
  | { kind: "pickShot"; zone: PitchZone }
  | { kind: "defending" }
  | { kind: "facingShot"; shotZone: GoalZone };

export type Action =
  | { kind: "pass" }
  | { kind: "dribble" }
  | { kind: "shoot" }
  | { kind: "shootAt"; target: GoalZone }
  | { kind: "tackle" }
  | { kind: "dive"; direction: DiveDirection };

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
  running: boolean;
  finished: boolean;
  stats: { rolls: number; successes: number };
  nextLogId: number;
}
