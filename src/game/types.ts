export type Team = "us" | "them";

export type Stat =
  | "speed"
  | "strength"
  | "stamina"
  | "composure"
  | "finishing"
  | "aerial"
  | "keeping"
  | "defending"
  | "dribbling"
  | "passing";

/** 0–5 stars in half-star steps. */
export type Stats = Record<Stat, number>;

export type PositionCode =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "LWB"
  | "RWB"
  | "DM"
  | "CM"
  | "AM"
  | "LM"
  | "RM"
  | "LW"
  | "RW"
  | "ST";

export type Lane = "left" | "centre" | "right";

/** Where the ball is, from the point of view of the side that has it. */
export type Zone = "defence" | "midfield" | "attack" | "box";

export type FormationId = "4-4-2" | "4-3-3" | "4-2-3-1" | "3-4-1-2" | "3-5-2";

export type StyleId = "balanced" | "gegenpress" | "parkTheBus" | "wingPlay" | "tikiTaka";

export type RoleId =
  | "shotStopper"
  | "sweeperKeeper"
  | "stopper"
  | "ballPlayingDefender"
  | "defensiveFullBack"
  | "overlappingFullBack"
  | "wingBack"
  | "anchor"
  | "deepLyingPlaymaker"
  | "boxToBox"
  | "playmaker"
  | "ballWinner"
  | "numberTen"
  | "shadowStriker"
  | "wideMidfielder"
  | "winger"
  | "insideForward"
  | "targetForward"
  | "poacher"
  | "falseNine";

export interface Footballer {
  id: string;
  name: string;
  team: Team;
  position: PositionCode;
  role: RoleId;
  stats: Stats;
  isUser: boolean;
}

export interface Side {
  name: string;
  formation: FormationId;
  style: StyleId;
  players: Footballer[];
}

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
  /** How the label reads from the other player's side, for rolls shown to a defending user. */
  mirrorLabel?: string;
}

export interface CheckResult {
  dice: [number, number];
  modifiers: Modifier[];
  total: number;
  target: number;
  /** Double one always fails, double six always succeeds. */
  crit: "success" | "fail" | null;
  /** Who rolled, for display. */
  roller: string;
}

/** What the attacker is trying to do with the ball. */
export type BallAction = "shortPass" | "oneTwo" | "throughBall" | "longBall" | "cross" | "dribble" | "shoot";

/** A moment where the clock stops and the user has to decide something. */
export type Situation =
  | { kind: "onBall"; zone: Zone; defenderId: string }
  | { kind: "pickShot"; zone: Zone; oneOnOne: boolean }
  | { kind: "oneOnOne" }
  | { kind: "crossToYou"; crosserId: string; markerId: string }
  | { kind: "defendDribble"; attackerId: string; zone: Zone }
  | { kind: "defendPass"; passerId: string; pass: "shortPass" | "oneTwo" | "throughBall"; zone: Zone }
  | { kind: "keeperShot"; shooterId: string; shotZone: GoalZone; zone: Zone }
  | { kind: "keeperCross"; crosserId: string; targetId: string }
  | { kind: "keeperOneOnOne"; attackerId: string; attackerPlan: "shoot" | "round" };

export type Action =
  | { kind: "ball"; action: BallAction }
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
  | { kind: "standTall" };

export interface Choice {
  action: Action;
  label: string;
  /** What you need on the two dice, once known modifiers are counted. */
  needs?: number;
}

export interface LogEntry {
  id: number;
  minute: number;
  text: string;
  tone: "neutral" | "good" | "bad" | "goal" | "you";
  roll?: CheckResult;
}

export interface Possession {
  team: Team;
  carrierId: string;
  zone: Zone;
  /** The carrier is clean through on goal. */
  oneOnOne: boolean;
}

export interface MatchState {
  sides: Record<Team, Side>;
  userId: string;
  minute: number;
  score: Record<Team, number>;
  shots: Record<Team, number>;
  possession: Possession;
  log: LogEntry[];
  situation: Situation | null;
  /** Minute the user was last involved, used to make sure the ball finds them now and then. */
  lastInvolved: number;
  running: boolean;
  finished: boolean;
  stats: { rolls: number; successes: number };
  nextLogId: number;
}
