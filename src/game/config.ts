// Every tunable number lives here. All of these are placeholders to be argued over.
import type { BallAction, FormationId, Lane, PositionCode, RoleId, Stat, StyleId, Zone } from "./types";

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const STATS: Stat[] = [
  "speed",
  "strength",
  "stamina",
  "composure",
  "finishing",
  "aerial",
  "keeping",
  "defending",
  "dribbling",
  "passing",
];

export const STAT_LABELS: Record<Stat, string> = {
  speed: "Speed",
  strength: "Strength",
  stamina: "Stamina",
  composure: "Composure",
  finishing: "Finishing",
  aerial: "Aerial",
  keeping: "Keeping",
  defending: "Defending",
  dribbling: "Dribbling",
  passing: "Passing",
};

/** Fatigue: after this minute (shifted by stamina and style), players lose half a star per interval. */
export const FATIGUE = {
  startsAt: 50,
  minutesPerStaminaStar: 8,
  minutesPerHalfStarLost: 12,
  maxStarsLost: 1.5,
};

// ---------------------------------------------------------------------------
// Positions, roles, formations, styles
// ---------------------------------------------------------------------------

interface PositionInfo {
  label: string;
  lane: Lane;
  /** How often a player here is involved in each zone (from their own side's view). */
  presence: Partial<Record<Zone, number>>;
  roles: RoleId[];
}

export const POSITIONS: Record<PositionCode, PositionInfo> = {
  GK: { label: "Goalkeeper", lane: "centre", presence: { defence: 0.4 }, roles: ["shotStopper", "sweeperKeeper"] },
  CB: {
    label: "Centre-back",
    lane: "centre",
    presence: { defence: 3, midfield: 0.4 },
    roles: ["stopper", "ballPlayingDefender"],
  },
  LB: {
    label: "Left-back",
    lane: "left",
    presence: { defence: 2, midfield: 1.5, attack: 0.6 },
    roles: ["defensiveFullBack", "overlappingFullBack"],
  },
  RB: {
    label: "Right-back",
    lane: "right",
    presence: { defence: 2, midfield: 1.5, attack: 0.6 },
    roles: ["defensiveFullBack", "overlappingFullBack"],
  },
  LWB: { label: "Left wing-back", lane: "left", presence: { defence: 1.5, midfield: 2, attack: 1.5 }, roles: ["wingBack"] },
  RWB: { label: "Right wing-back", lane: "right", presence: { defence: 1.5, midfield: 2, attack: 1.5 }, roles: ["wingBack"] },
  DM: {
    label: "Defensive midfielder",
    lane: "centre",
    presence: { defence: 2, midfield: 3, attack: 0.4 },
    roles: ["anchor", "deepLyingPlaymaker"],
  },
  CM: {
    label: "Central midfielder",
    lane: "centre",
    presence: { defence: 1, midfield: 3, attack: 1.5, box: 0.4 },
    roles: ["boxToBox", "playmaker", "ballWinner"],
  },
  AM: {
    label: "Attacking midfielder",
    lane: "centre",
    presence: { midfield: 2, attack: 3, box: 1 },
    roles: ["numberTen", "shadowStriker"],
  },
  LM: {
    label: "Left midfielder",
    lane: "left",
    presence: { defence: 0.6, midfield: 2.5, attack: 2, box: 0.3 },
    roles: ["wideMidfielder", "winger"],
  },
  RM: {
    label: "Right midfielder",
    lane: "right",
    presence: { defence: 0.6, midfield: 2.5, attack: 2, box: 0.3 },
    roles: ["wideMidfielder", "winger"],
  },
  LW: { label: "Left winger", lane: "left", presence: { midfield: 1, attack: 3, box: 1 }, roles: ["winger", "insideForward"] },
  RW: { label: "Right winger", lane: "right", presence: { midfield: 1, attack: 3, box: 1 }, roles: ["winger", "insideForward"] },
  ST: {
    label: "Striker",
    lane: "centre",
    presence: { midfield: 0.5, attack: 2, box: 3 },
    roles: ["targetForward", "poacher", "falseNine"],
  },
};

interface RoleInfo {
  label: string;
  description: string;
  /** Extra stars on top of the base when generating a player for this role. */
  keyStats: Partial<Record<Stat, number>>;
  presence?: Partial<Record<Zone, number>>;
  actions?: Partial<Record<BallAction, number>>;
}

export const ROLES: Record<RoleId, RoleInfo> = {
  shotStopper: {
    label: "Shot-stopper",
    description: "Stays on the line and saves things.",
    keyStats: { keeping: 2, composure: 0.5 },
  },
  sweeperKeeper: {
    label: "Sweeper keeper",
    description: "Comes off the line and plays out from the back.",
    keyStats: { keeping: 1.5, passing: 1, speed: 0.5 },
    actions: { shortPass: 1.5, longBall: 0.5 },
  },
  stopper: {
    label: "Centre-back",
    description: "Defends first. Heads it, tackles it, clears it.",
    keyStats: { defending: 1.5, aerial: 1.5, strength: 1 },
    actions: { longBall: 1.5, dribble: 0.5 },
  },
  ballPlayingDefender: {
    label: "Ball-playing defender",
    description: "Defends, then starts attacks with a pass.",
    keyStats: { defending: 1, passing: 1.5, composure: 1 },
    actions: { throughBall: 2, longBall: 1.5 },
  },
  defensiveFullBack: {
    label: "Full-back",
    description: "Stays home and keeps the winger quiet.",
    keyStats: { defending: 1.5, speed: 1, stamina: 0.5 },
    presence: { attack: 0.5 },
  },
  overlappingFullBack: {
    label: "Overlapping full-back",
    description: "Bombs on round the outside to cross.",
    keyStats: { speed: 1, stamina: 1, passing: 1, defending: 0.5 },
    presence: { attack: 2 },
    actions: { cross: 2 },
  },
  wingBack: {
    label: "Wing-back",
    description: "Covers the whole flank, both ways.",
    keyStats: { stamina: 1.5, speed: 1, passing: 0.5, defending: 0.5 },
    actions: { cross: 2, dribble: 1.3 },
  },
  anchor: {
    label: "Anchor",
    description: "Sits in front of the defence and breaks things up.",
    keyStats: { defending: 1.5, strength: 1, composure: 0.5 },
    presence: { attack: 0.3, box: 0 },
    actions: { shortPass: 1.5, dribble: 0.4 },
  },
  deepLyingPlaymaker: {
    label: "Deep-lying playmaker",
    description: "Dictates the game from deep.",
    keyStats: { passing: 2, composure: 1 },
    actions: { throughBall: 2, longBall: 1.5 },
  },
  boxToBox: {
    label: "Box-to-box",
    description: "Everywhere. Tackles in one box, shoots in the other.",
    keyStats: { stamina: 1.5, defending: 0.5, passing: 0.5, finishing: 0.5 },
    presence: { defence: 1.3, box: 2 },
  },
  playmaker: {
    label: "Playmaker",
    description: "Finds the pass nobody else sees.",
    keyStats: { passing: 2, dribbling: 0.5, composure: 0.5 },
    actions: { throughBall: 2.5, oneTwo: 1.5 },
  },
  ballWinner: {
    label: "Ball-winner",
    description: "Hunts the ball down and gives it to someone better.",
    keyStats: { defending: 1.5, stamina: 1, strength: 0.5 },
    actions: { shortPass: 1.5, dribble: 0.5 },
  },
  numberTen: {
    label: "Number 10",
    description: "Plays between the lines and makes chances.",
    keyStats: { passing: 1.5, dribbling: 1, composure: 0.5 },
    actions: { throughBall: 2, oneTwo: 1.5 },
  },
  shadowStriker: {
    label: "Shadow striker",
    description: "Arrives late in the box to score.",
    keyStats: { finishing: 1.5, speed: 0.5, composure: 0.5 },
    presence: { box: 2.5 },
    actions: { shoot: 1.5 },
  },
  wideMidfielder: {
    label: "Wide midfielder",
    description: "Works the flank, tracks back, puts crosses in.",
    keyStats: { stamina: 1, passing: 1, defending: 0.5 },
    actions: { cross: 1.5 },
  },
  winger: {
    label: "Winger",
    description: "Beats the full-back and gets it in the box.",
    keyStats: { speed: 1.5, dribbling: 1, passing: 0.5 },
    actions: { dribble: 2, cross: 2, shoot: 0.6 },
  },
  insideForward: {
    label: "Inside forward",
    description: "Cuts in off the flank to shoot.",
    keyStats: { dribbling: 1, finishing: 1, speed: 0.5 },
    presence: { box: 2 },
    actions: { dribble: 1.5, shoot: 2, cross: 0.3 },
  },
  targetForward: {
    label: "Target forward",
    description: "Big unit. Wins headers, holds it up.",
    keyStats: { aerial: 2, strength: 1.5, finishing: 0.5 },
    presence: { box: 1.3 },
    actions: { shortPass: 1.5, dribble: 0.5 },
  },
  poacher: {
    label: "Poacher",
    description: "Lives in the box. Scores goals, does little else.",
    keyStats: { finishing: 2, composure: 1 },
    presence: { midfield: 0.3, box: 1.5 },
    actions: { shoot: 1.5, shortPass: 0.7 },
  },
  falseNine: {
    label: "False nine",
    description: "Drops deep to link play and drag defenders out.",
    keyStats: { passing: 1, dribbling: 1, finishing: 0.5 },
    presence: { midfield: 3, box: 0.7 },
    actions: { throughBall: 2, oneTwo: 2 },
  },
};

/** Back to front: keeper, then defence, then midfield, then attack. */
export const FORMATIONS: Record<FormationId, PositionCode[]> = {
  "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
  "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CM", "DM", "CM", "LW", "ST", "RW"],
  "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "DM", "DM", "LW", "AM", "RW", "ST"],
  "3-4-1-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "CM", "RWB", "AM", "ST", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "DM", "CM", "RWB", "ST", "ST"],
};

interface StyleInfo {
  label: string;
  description: string;
  actions: Partial<Record<BallAction, number>>;
  /** Extra weight on wide players receiving the ball. */
  widePresence: number;
  /** When defending: how often the player challenging goes for it rather than holding off. */
  tackleChance: number;
  interceptChance: number;
  /** When defending: −1 to the attacker in these zones (attacker's view). */
  squeezes: Zone[];
  /** Fatigue sets in this many minutes earlier (positive) or later (negative). */
  fatigueEarlier: number;
}

export const STYLES: Record<StyleId, StyleInfo> = {
  balanced: {
    label: "Balanced",
    description: "No particular plan. Bit of everything.",
    actions: {},
    widePresence: 1,
    tackleChance: 0.5,
    interceptChance: 0.4,
    squeezes: [],
    fatigueEarlier: 0,
  },
  gegenpress: {
    label: "Gegenpressing",
    description: "Lose it, win it straight back. Knackering.",
    actions: { throughBall: 1.3, longBall: 0.7 },
    widePresence: 1,
    tackleChance: 0.75,
    interceptChance: 0.6,
    squeezes: ["defence", "midfield"],
    fatigueEarlier: 12,
  },
  parkTheBus: {
    label: "Park the bus",
    description: "Everyone behind the ball. Hit them on the break.",
    actions: { longBall: 2, shortPass: 0.8, oneTwo: 0.5, throughBall: 0.7 },
    widePresence: 1,
    tackleChance: 0.3,
    interceptChance: 0.25,
    squeezes: ["attack", "box"],
    fatigueEarlier: -8,
  },
  wingPlay: {
    label: "Wing play",
    description: "Get it wide, get it in the box.",
    actions: { cross: 2.5, throughBall: 0.7 },
    widePresence: 2,
    tackleChance: 0.5,
    interceptChance: 0.4,
    squeezes: [],
    fatigueEarlier: 0,
  },
  tikiTaka: {
    label: "Tiki-taka",
    description: "Pass, pass, pass, and pass again.",
    actions: { shortPass: 1.8, oneTwo: 2, throughBall: 1.3, longBall: 0.2, cross: 0.5 },
    widePresence: 1,
    tackleChance: 0.5,
    interceptChance: 0.45,
    squeezes: [],
    fatigueEarlier: 0,
  },
};

// ---------------------------------------------------------------------------
// Squad generation
// ---------------------------------------------------------------------------

/** Every outfield stat starts somewhere in this range before the role adds to it. */
export const BASE_STARS = { min: 1, max: 3 };
/** Outfielders are not keepers. */
export const OUTFIELD_KEEPING = { min: 0, max: 0.5 };

export const SURNAMES = [
  "Adeyemi", "Barker", "Castillo", "Doherty", "Eriksen", "Fofana", "Gallagher", "Hartley", "Ince", "Jansen",
  "Kowalski", "Lindqvist", "Mbeki", "Nakamura", "Okafor", "Pereira", "Quinn", "Rossi", "Sandoval", "Thorne",
  "Ugarte", "Vidal", "Walsh", "Yilmaz", "Zielinski", "Ashworth", "Bakayoko", "Conway", "Dumont", "Ekwueme",
  "Fitzgerald", "Grealey", "Hammond", "Ibarra", "Jovanovic", "Kerr", "Lacroix", "Moreno", "Nwosu", "O'Brien",
  "Petrov", "Rahman", "Silva", "Tanaka", "Uche", "Varga", "Whitlock", "Xuereb", "Young", "Zimmer",
  "Achterberg", "Bellamy", "Costa", "Dunne", "Ezeh", "Ferreira", "Grant", "Holloway", "Ivers", "Jensen",
];
