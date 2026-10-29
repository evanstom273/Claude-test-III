import Phaser from "phaser";
import type { LiveCast, LiveOutcome } from "../game/match";
import type { Footballer, GoalZone, Stat, Zone } from "../game/types";

export const W = 360;
export const H = 520;
const GOAL_Y = 40;
const POST_L = 125;
const POST_R = 235;
const BOX_Y = 170;
/** How long a live moment lasts before it hands back to the match. */
const DURATION_MS = 12_000;
const PICKUP_RADIUS = 16;
/** Defenders hold off for this long at the start, so you get a moment to look up. */
const GRACE_MS = 1000;
/** A defender who's been skipped past can't go again for this long. */
const RECOVER_MS = 1500;
const TACKLE_RADIUS = 18;

const START_Y: Record<Zone, number> = { defence: 470, midfield: 470, attack: 340, box: 215 };

export interface LiveConfig {
  cast: LiveCast;
  /** Odds the attacker wins, from the same stars and targets as the dice. */
  chance: (attacker: Footballer, aStats: Stat[], defender: Footballer, dStats: Stat[], target: number) => number;
  onDone: (outcome: LiveOutcome) => void;
}

interface Actor {
  p: Footballer;
  side: "us" | "them";
  keeper: boolean;
  x: number;
  y: number;
  speed: number;
  stunnedUntil: number;
  /** Where a teammate is drifting to. */
  lane: number;
  body: Phaser.GameObjects.Arc;
  ring?: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: Actor | null;
  kicker: Actor | null;
  kickedAt: number;
  kickY: number;
  /** Defenders who've already had their go at this ball and missed. */
  beaten: Set<Actor>;
  body: Phaser.GameObjects.Arc;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Pixels per second for a given speed rating. */
const runSpeed = (stars: number) => 60 + stars * 16;

export class LiveScene extends Phaser.Scene {
  private cfg: LiveConfig;
  private actors: Actor[] = [];
  private ball!: Ball;
  private down: { x: number; y: number; t: number } | null = null;
  private pointer = { x: 0, y: 0 };
  private startedAt = 0;
  private finished = false;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private flashText!: Phaser.GameObjects.Text;

  constructor(cfg: LiveConfig) {
    super("live");
    this.cfg = cfg;
  }

  create() {
    this.drawPitch();
    const { cast } = this.cfg;
    const y0 = cast.oneOnOne ? 230 : START_Y[cast.zone];

    const carrier = this.addActor(cast.carrier, "us", 180, y0);
    const mateSpots = [
      [-110, -70],
      [110, -70],
      [0, -150],
    ];
    cast.mates.forEach((p, i) => {
      const [dx, dy] = mateSpots[i];
      this.addActor(p, "us", clamp(180 + dx, 25, W - 25), clamp(y0 + dy, 90, H - 30)).lane = clamp(180 + dx, 40, W - 40);
    });
    carrier.lane = 180;

    const defSpots = cast.oneOnOne
      ? [
          [-60, 50],
          [60, 60],
          [-20, 110],
          [30, 140],
        ]
      : [
          [-90, -130],
          [-30, -95],
          [35, -95],
          [92, -130],
        ];
    cast.defenders.forEach((p, i) => {
      const [dx, dy] = defSpots[i];
      this.addActor(p, "them", clamp(180 + dx, 25, W - 25), clamp(y0 + dy, 75, H - 20));
    });
    this.addActor(cast.keeper, "them", 180, 58, true);

    this.ball = {
      x: carrier.x,
      y: carrier.y - 10,
      vx: 0,
      vy: 0,
      owner: carrier,
      kicker: null,
      kickedAt: 0,
      kickY: carrier.y,
      beaten: new Set(),
      body: this.add.circle(carrier.x, carrier.y - 10, 5, 0xffffff).setStrokeStyle(1, 0x111111).setDepth(5),
    };

    this.add
      .text(W / 2, H - 22, "Hold to run · Flick to pass or shoot", { fontFamily: "sans-serif", fontSize: "12px", color: "#e2e8f0" })
      .setOrigin(0.5)
      .setDepth(10);
    this.add.rectangle(0, H - 6, W, 6, 0x0f172a).setOrigin(0, 0.5).setDepth(10);
    this.timerBar = this.add.rectangle(0, H - 6, W, 6, 0xfbbf24).setOrigin(0, 0.5).setDepth(11);
    this.flashText = this.add
      .text(W / 2, H / 2, "", { fontFamily: "sans-serif", fontSize: "20px", fontStyle: "bold", color: "#ffffff", stroke: "#000000", strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.down = { x: p.x, y: p.y, t: this.time.now };
      this.pointer = { x: p.x, y: p.y };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.pointer = { x: p.x, y: p.y };
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const d = this.down;
      this.down = null;
      if (!d) return;
      const held = this.time.now - d.t;
      const dx = p.x - d.x;
      const dy = p.y - d.y;
      const dist = Math.hypot(dx, dy);
      const owner = this.ball.owner;
      if (owner?.side === "us" && held < 280 && dist > 25) {
        const speed = clamp((dist / Math.max(held, 40)) * 1000 * 0.55, 240, 560);
        this.kick(owner, (dx / dist) * speed, (dy / dist) * speed);
      }
    });

  }

  private drawPitch() {
    for (let i = 0; i < 9; i++) {
      this.add.rectangle(0, i * 60, W, 60, i % 2 ? 0x166534 : 0x15803d).setOrigin(0, 0);
    }
    const g = this.add.graphics({ lineStyle: { width: 2, color: 0xffffff, alpha: 0.7 } });
    g.strokeRect(8, GOAL_Y, W - 16, H + 40);
    g.strokeRect(60, GOAL_Y, W - 120, BOX_Y - GOAL_Y);
    g.strokeRect(130, GOAL_Y, W - 260, 40);
    g.strokeCircle(W / 2, 505, 50);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeRect(POST_L, GOAL_Y - 14, POST_R - POST_L, 14);
  }

  private addActor(p: Footballer, side: "us" | "them", x: number, y: number, keeper = false): Actor {
    const colour = keeper ? 0xfacc15 : side === "us" ? 0x3b82f6 : 0xef4444;
    const body = this.add.circle(x, y, 10, colour).setStrokeStyle(2, 0x0f172a).setDepth(3);
    const ring = p.isUser ? this.add.circle(x, y, 14).setStrokeStyle(2, 0xffffff).setDepth(2) : undefined;
    const label = this.add
      .text(x, y + 14, p.isUser ? "YOU" : p.name, { fontFamily: "sans-serif", fontSize: "9px", color: "#f8fafc" })
      .setOrigin(0.5, 0)
      .setDepth(4);
    const actor: Actor = { p, side, keeper, x, y, speed: runSpeed(p.stats.speed), stunnedUntil: 0, lane: x, body, ring, label };
    this.actors.push(actor);
    return actor;
  }

  private flash(text: string) {
    this.flashText.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.flashText, alpha: 0, delay: 500, duration: 400 });
  }

  private kick(from: Actor, vx: number, vy: number) {
    const b = this.ball;
    b.owner = null;
    b.kicker = from;
    b.kickedAt = this.time.now;
    b.kickY = from.y;
    b.vx = vx;
    b.vy = vy;
    b.beaten = new Set();
  }

  private end(outcome: LiveOutcome, text?: string) {
    if (this.finished) return;
    this.finished = true;
    if (text) this.flash(text);
    this.cfg.onDone(outcome);
  }

  private moveToward(a: Actor, tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const step = Math.min(d, speed * dt);
    a.x = clamp(a.x + (dx / d) * step, 12, W - 12);
    a.y = clamp(a.y + (dy / d) * step, GOAL_Y + 6, H - 14);
  }

  private zoneAt(y: number): Zone {
    return y < BOX_Y ? "box" : y < 330 ? "attack" : "midfield";
  }

  private nearest(list: Actor[], x: number, y: number): Actor {
    return list.reduce((best, a) => (Math.hypot(a.x - x, a.y - y) < Math.hypot(best.x - x, best.y - y) ? a : best));
  }

  update(_time: number, deltaMs: number) {
    if (this.finished) return;
    // Use the scene clock throughout, the same one input timestamps come from.
    const time = this.time.now;
    // The scene clock hasn't started when create() runs, so the moment starts on its first frame.
    if (this.startedAt === 0) this.startedAt = time;
    const elapsed = time - this.startedAt;
    const dt = Math.min(deltaMs, 50) / 1000;
    const b = this.ball;
    const us = this.actors.filter((a) => a.side === "us");
    const them = this.actors.filter((a) => a.side === "them" && !a.keeper);
    const keeper = this.actors.find((a) => a.keeper)!;
    this.timerBar.width = W * Math.max(0, 1 - elapsed / DURATION_MS);

    // Your carrier runs towards your finger while you hold it down.
    const owner = b.owner;
    if (owner?.side === "us" && this.down && time - this.down.t > 120) {
      this.moveToward(owner, this.pointer.x, this.pointer.y, owner.speed, dt);
    }

    // Teammates keep ahead of the ball in their lanes.
    for (const a of us) {
      if (a === owner) continue;
      const ahead = (owner ?? { y: b.y }).y - 90;
      this.moveToward(a, a.lane, clamp(ahead, 80, H - 40), a.speed * 0.8, dt);
    }

    // Defenders: nearest one goes for the ball, the rest sit between their man and goal.
    const chaser = this.nearest(them, b.x, b.y);
    const marked = new Set<Actor>();
    const engaged = elapsed > GRACE_MS;
    for (const d of them) {
      if (time < d.stunnedUntil || !engaged) continue;
      if (d === chaser) {
        this.moveToward(d, b.x, b.y, d.speed * 0.9, dt);
        continue;
      }
      const free = us.filter((a) => !marked.has(a));
      const man = this.nearest(free.length ? free : us, d.x, d.y);
      marked.add(man);
      this.moveToward(d, man.x + (W / 2 - man.x) * 0.25, man.y + (GOAL_Y - man.y) * 0.25, d.speed * 0.8, dt);
    }
    this.moveToward(keeper, clamp(b.x, POST_L + 10, POST_R - 10), 58, keeper.speed, dt);

    // Tackles.
    if (engaged && owner?.side === "us" && time >= chaser.stunnedUntil && Math.hypot(chaser.x - owner.x, chaser.y - owner.y) < TACKLE_RADIUS) {
      const keep = this.cfg.chance(owner.p, ["dribbling", "speed"], chaser.p, ["defending"], 7);
      if (Math.random() < keep) {
        chaser.stunnedUntil = time + RECOVER_MS;
        this.flash("Skipped past him!");
      } else {
        return this.end({ kind: "lost", byId: chaser.p.id }, `${chaser.p.name} takes it`);
      }
    }

    // Ball.
    if (b.owner) {
      b.x = b.owner.x;
      b.y = b.owner.y - 11;
    } else {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const friction = Math.pow(0.5, dt);
      b.vx *= friction;
      b.vy *= friction;
      const speed = Math.hypot(b.vx, b.vy);
      const kicker = b.kicker!;

      if (b.y <= GOAL_Y) {
        if (b.x >= POST_L && b.x <= POST_R) {
          const col = b.x < POST_L + 37 ? "Left" : b.x > POST_R - 37 ? "Right" : "Centre";
          const goalZone = `${speed > 330 ? "top" : "bottom"}${col}` as GoalZone;
          return this.end({ kind: "shot", shooterId: kicker.p.id, zone: this.zoneAt(b.kickY), goalZone }, "Shot!");
        }
        return this.end({ kind: "wide", shooterId: kicker.p.id }, "Wide!");
      }
      if (b.x < 4 || b.x > W - 4 || b.y > H - 4) {
        const d = this.nearest(them, b.x, b.y);
        return this.end({ kind: "lost", byId: d.p.id }, "Out of play");
      }

      const fresh = time - b.kickedAt < 150;
      for (const a of this.actors) {
        if (a === kicker && fresh) continue;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (a.keeper) {
          if (dist < 20 && speed < 300) return this.end({ kind: "lost", byId: a.p.id }, `${a.p.name} gathers`);
          continue;
        }
        if (dist > PICKUP_RADIUS) continue;
        if (a.side === "us") {
          b.owner = a;
          break;
        }
        if (b.beaten.has(a)) continue;
        const through = this.cfg.chance(kicker.p, ["passing"], a.p, ["defending"], 6);
        if (Math.random() < through) {
          b.beaten.add(a);
        } else {
          return this.end({ kind: "lost", byId: a.p.id }, "Intercepted");
        }
      }

      if (!b.owner && speed < 25) {
        const n = this.nearest([...us, ...them], b.x, b.y);
        if (n.side === "them") return this.end({ kind: "lost", byId: n.p.id }, "Loose ball lost");
        b.owner = n;
      }
    }

    if (elapsed > DURATION_MS && b.owner?.side === "us") {
      return this.end({ kind: "kept", carrierId: b.owner.p.id, zone: this.zoneAt(b.owner.y) }, "Time");
    }

    for (const a of this.actors) {
      a.body.setPosition(a.x, a.y);
      a.ring?.setPosition(a.x, a.y);
      a.label.setPosition(a.x, a.y + 12);
      a.body.setStrokeStyle(2, a === b.owner ? 0xffffff : 0x0f172a);
    }
    b.body.setPosition(b.x, b.y);
  }
}
