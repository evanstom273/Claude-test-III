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

/** What the attacker is trying to do with the ball. */
export type BallAction = "shortPass" | "oneTwo" | "throughBall" | "longBall" | "cross" | "dribble" | "shoot";

