// Everything the real-time match runs on. Distances are metres, speeds metres per second.

/** World pixels per metre. Art is authored at this scale (1 SVG unit = 1 world pixel). */
export const PX = 11;

/** The pitch runs left to right: length along x, width along y. Your side attacks to the right. */
export const PITCH_L = 105;
export const PITCH_W = 68;
/** Grass, boards and stands around the pitch, in world pixels. */
export const MARGIN = 96;

export const WORLD_W = PITCH_L * PX + MARGIN * 2;
export const WORLD_H = PITCH_W * PX + MARGIN * 2;

export const GOAL_WIDTH = 7.32;
export const GOAL_HEIGHT = 2.44;
export const GOAL_DEPTH = 2;
/** How tall something one metre high is drawn, from the three-quarter camera angle. */
export const HEIGHT_SCALE = 0.62;

/** Real seconds for the full 90 minutes. */
export const MATCH_SECONDS = 360;
export const KICKOFF_PAUSE = 1.6;
export const RESTART_PAUSE = 0.9;
export const GOAL_PAUSE = 2.6;

export const PLAYER_RADIUS = 1.1;
export const BALL_RADIUS = 0.45;

/** Running speed: base plus this much per speed star. */
export const RUN_SPEED = { base: 5.6, perStar: 0.55 };
export const ACCELERATION = 22;
/** You run a bit slower with the ball at your feet. */
export const DRIBBLE_SPEED_FACTOR = 0.86;
/** Late in the game, low-stamina players lose up to this much speed. */
export const FATIGUE_SPEED_LOSS = 0.12;

/** Ball rolling resistance (m/s²), air drag and gravity. */
export const BALL_FRICTION = 3.2;
export const BALL_DRAG = 0.12;
export const GRAVITY = 9.8;
export const BOUNCE = 0.45;

/** How close a player has to be to pick the ball up. */
export const CONTROL_RADIUS = 1.25;
export const KEEPER_REACH = { base: 1.6, perStar: 0.35 };
/** Highest the ball can be and still be controlled at feet / by a keeper's hands. */
export const CONTROL_HEIGHT = 1.0;
export const KEEPER_HEIGHT = 2.7;

export const TACKLE_RANGE = 2.3;
/** After losing a duel, a player is beaten for this long. */
export const BEATEN_TIME = 0.75;
/** How often the AI rethinks, in seconds. */
export const AI_REACTION = 0.32;
/** After receiving, an unpressured AI player takes a touch and looks up for this long (plus a bit). */
export const FIRST_TOUCH = 0.45;

/** Passing: arrival speed, and how far before passes go in the air. */
export const PASS_ARRIVAL_SPEED = 9;
export const LOFT_DISTANCE = 28;
/** Aim error in radians: base minus this per passing/finishing star. */
export const PASS_ERROR = { base: 0.11, perStar: 0.017 };
export const SHOT_ERROR = { base: 0.12, perStar: 0.017 };
export const SHOT_SPEED = { min: 17, max: 31 };
/** Holding shoot for this long gives full power. */
export const SHOT_CHARGE_SECONDS = 0.9;

/** Duels use the same rule as before: each half star of difference is 1 on 2d6. */
export const TACKLE_TARGET = 7;
export const INTERCEPT_TARGET = 6;
