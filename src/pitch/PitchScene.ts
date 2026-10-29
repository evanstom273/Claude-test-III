import Phaser from "phaser";
import { ballSvg, goalArt, KITS, pitchSvg, ringSvg, shadowSvg, svgToDataUri, TOKEN_R, tokenSvg, type GoalArt } from "./art";
import { HEIGHT_SCALE, MARGIN, PITCH_L, PITCH_W, PX, WORLD_H, WORLD_W } from "./constants";
import { minuteOf, situation, stepSim, type Body, type Input, type MatchEvent, type Phase, type Sim } from "./sim";
import type { Team } from "../game/types";

export interface HudState {
  minute: number;
  score: Record<Team, number>;
  phase: Phase;
  onBall: boolean;
  attacking: boolean;
  canTackle: boolean;
}

export interface SceneConfig {
  sim: Sim;
  input: Input;
  onEvent: (e: MatchEvent) => void;
  onHud: (h: HudState) => void;
}

const STEP = 1 / 60;
const wx = (x: number) => MARGIN + x * PX;
const wy = (y: number) => MARGIN + y * PX;

interface Token {
  body: Body;
  shadow: Phaser.GameObjects.Image;
  disc: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

/**
 * Draws the simulation. Textures are rasterised at the device's pixel ratio and shown at 1/dpr,
 * with the camera zoomed by dpr, so the art appears at its native world size and stays sharp.
 */
export class PitchScene extends Phaser.Scene {
  private cfg: SceneConfig;
  private dpr = Math.min(window.devicePixelRatio || 1, 3);
  private tokens: Token[] = [];
  private ball!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Image;
  private userRing!: Phaser.GameObjects.Image;
  private controlRing!: Phaser.GameObjects.Image;
  private acc = 0;
  private camX = 0;
  private camY = 0;
  private hudAt = 0;
  private goals: { art: GoalArt; key: string; x: number }[] = [];

  constructor(cfg: SceneConfig) {
    super("pitch");
    this.cfg = cfg;
  }

  preload() {
    const svg = (key: string, source: string) => this.load.svg(key, svgToDataUri(source), { scale: this.dpr });
    svg("pitch", pitchSvg());
    this.goals = [
      { art: goalArt(true), key: "goalLeft", x: wx(0) },
      { art: goalArt(false), key: "goalRight", x: wx(PITCH_L) },
    ];
    for (const g of this.goals) svg(g.key, g.art.svg);
    for (const [k, c] of Object.entries(KITS)) svg(`token-${k}`, tokenSvg(c));
    svg("shadow", shadowSvg(TOKEN_R + 2, 7));
    svg("ballShadow", shadowSvg(6, 3.5, 0.5));
    svg("ball", ballSvg());
    svg("ringUser", ringSvg("#ffffff"));
    svg("ringControl", ringSvg("#fbbf24"));
  }

  private place(key: string, x: number, y: number, ox = 0.5, oy = 0.5) {
    return this.add.image(x, y, key).setOrigin(ox, oy).setScale(1 / this.dpr);
  }

  create() {
    this.place("pitch", 0, 0, 0, 0).setDepth(-1000);
    for (const g of this.goals) {
      this.place(g.key, g.x, wy(PITCH_W / 2), g.art.anchorX / g.art.width, g.art.anchorY / g.art.height).setDepth(wy(PITCH_W / 2));
    }

    this.userRing = this.place("ringUser", 0, 0);
    this.controlRing = this.place("ringControl", 0, 0);

    for (const body of this.cfg.sim.bodies) {
      const keeper = body.f.position === "GK";
      const kit = body.team === "us" ? (keeper ? "usKeeper" : "us") : keeper ? "themKeeper" : "them";
      const shadow = this.place("shadow", 0, 0);
      // Origin at the middle of the token's top face.
      const disc = this.place(`token-${kit}`, 0, 0, 0.5, (TOKEN_R + 2) / (TOKEN_R * 2 + 10));
      const label = this.add
        .text(0, 0, body.f.isUser ? "YOU" : body.f.position, {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: body.f.isUser ? "8px" : "9px",
          fontStyle: "bold",
          color: "#ffffff",
          stroke: "#0f172a",
          strokeThickness: 2,
          resolution: this.dpr,
        })
        .setOrigin(0.5);
      this.tokens.push({ body, shadow, disc, label });
    }
    this.ballShadow = this.place("ballShadow", 0, 0);
    this.ball = this.place("ball", 0, 0);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.setZoom(this.dpr);
    cam.setRoundPixels(false);
    this.camX = wx(PITCH_L / 2);
    this.camY = wy(PITCH_W / 2);
    cam.centerOn(this.camX, this.camY);
  }

  update(_time: number, deltaMs: number) {
    const sim = this.cfg.sim;
    const input = this.cfg.input;
    this.acc += Math.min(deltaMs, 100) / 1000;
    while (this.acc >= STEP) {
      stepSim(sim, input, STEP);
      // Button presses count once.
      input.pass = input.tackle = input.switchPlayer = input.call = false;
      input.shootReleased = null;
      this.acc -= STEP;
    }
    while (sim.events.length) this.cfg.onEvent(sim.events.shift()!);

    for (const t of this.tokens) {
      const x = wx(t.body.x);
      const y = wy(t.body.y);
      t.shadow.setPosition(x + 2.5, y + 4).setDepth(y - 0.2);
      t.disc.setPosition(x, y).setDepth(y);
      t.label.setPosition(x, y + 0.5).setDepth(y + 0.1);
    }
    const user = sim.user;
    this.userRing.setPosition(wx(user.x), wy(user.y) + 3).setDepth(wy(user.y) - 0.3);
    const showControl = sim.mode === "team" && sim.controlled !== sim.user;
    this.controlRing.setVisible(showControl).setPosition(wx(sim.controlled.x), wy(sim.controlled.y) + 3).setDepth(wy(sim.controlled.y) - 0.3);

    const b = sim.ball;
    const bx = wx(b.x);
    const by = wy(b.y);
    const lift = b.z * PX * HEIGHT_SCALE;
    this.ballShadow.setPosition(bx + lift * 0.45, by + 2 + lift * 0.2).setScale((1 / this.dpr) * Math.max(0.55, 1 - b.z * 0.08)).setDepth(by - 0.15);
    this.ball.setPosition(bx, by - lift).setDepth(b.z > 1.2 ? 100000 : by + 0.2).setScale((1 / this.dpr) * (1 + b.z * 0.05));

    // Follow the ball, looking a little ahead of whoever has it.
    const owner = b.owner;
    const lead = owner ? (owner.team === "us" ? 6 : -6) : 0;
    const targetX = wx(b.x + lead);
    const targetY = wy(b.y);
    this.camX += (targetX - this.camX) * 0.08;
    this.camY += (targetY - this.camY) * 0.08;
    this.cameras.main.centerOn(this.camX, this.camY);

    if (sim.time - this.hudAt > 0.1) {
      this.hudAt = sim.time;
      this.cfg.onHud({ minute: minuteOf(sim), score: { ...sim.score }, phase: sim.phase, ...situation(sim) });
    }
  }
}
