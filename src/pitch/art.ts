// All artwork as SVG, authored at native world scale (1 SVG unit = 1 world pixel).
// Light comes from the north-west and the camera looks down from the south at three-quarter height,
// so tall things show their tops and south faces, and shadows fall to the south-east.
import { GOAL_DEPTH, GOAL_HEIGHT, GOAL_WIDTH, HEIGHT_SCALE, MARGIN, PITCH_L, PITCH_W, PX, WORLD_H, WORLD_W } from "./constants";

const m = (metres: number) => metres * PX;
const X = (x: number) => MARGIN + m(x);
const Y = (y: number) => MARGIN + m(y);

/** Small deterministic random, so the art is the same every time it's drawn. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------------------
// The pitch, its surroundings and the stands
// ---------------------------------------------------------------------------

function stands(): string {
  const rand = seeded(7);
  const parts: string[] = [];
  const tierDepth = 9;
  const tiers = Math.floor((MARGIN - 60) / tierDepth);
  const seatColours = ["#1e3a8a", "#1e40af", "#334155", "#991b1b", "#334155"];
  // North and south stands: rows of seats on concrete steps (top face, then riser).
  for (const side of ["north", "south"] as const) {
    for (let t = 0; t < tiers; t++) {
      const y = side === "north" ? t * tierDepth : WORLD_H - (t + 1) * tierDepth;
      parts.push(`<rect x="0" y="${y}" width="${WORLD_W}" height="${tierDepth}" fill="url(#concreteTop)"/>`);
      parts.push(`<rect x="0" y="${y + tierDepth - 3}" width="${WORLD_W}" height="3" fill="url(#riser)"/>`);
      for (let x = 4; x < WORLD_W - 6; x += 7) {
        const colour = seatColours[Math.floor((x / WORLD_W) * seatColours.length + t * 0.3) % seatColours.length];
        const empty = rand() < 0.08;
        parts.push(
          `<rect x="${x}" y="${y + 1.5}" width="5" height="4.5" rx="1" fill="${empty ? "#475569" : colour}"/>` +
            `<rect x="${x + 0.6}" y="${y + 1.8}" width="3.8" height="1.2" rx="0.6" fill="#ffffff" opacity="0.18"/>`,
        );
      }
    }
  }
  // East and west: the same steps, running down the sides.
  for (const side of ["west", "east"] as const) {
    for (let t = 0; t < tiers; t++) {
      const x = side === "west" ? t * tierDepth : WORLD_W - (t + 1) * tierDepth;
      parts.push(`<rect x="${x}" y="${tiers * tierDepth}" width="${tierDepth}" height="${WORLD_H - tiers * tierDepth * 2}" fill="url(#concreteSide)"/>`);
      for (let y = tiers * tierDepth + 4; y < WORLD_H - tiers * tierDepth - 6; y += 7) {
        const colour = seatColours[Math.floor((y / WORLD_H) * seatColours.length + t * 0.3) % seatColours.length];
        parts.push(`<rect x="${x + 2}" y="${y}" width="4.5" height="5" rx="1" fill="${rand() < 0.08 ? "#475569" : colour}"/>`);
      }
      parts.push(`<rect x="${side === "west" ? x + tierDepth - 1.5 : x}" y="${tiers * tierDepth}" width="1.5" height="${WORLD_H - tiers * tierDepth * 2}" fill="#000000" opacity="0.3"/>`);
    }
  }
  return parts.join("");
}

const ADS = [
  { bg: "#0f766e", fg: "#ecfeff", text: "MATCHDAY" },
  { bg: "#1d4ed8", fg: "#eff6ff", text: "KICK OFF" },
  { bg: "#b91c1c", fg: "#fff1f2", text: "&#9733;  GOAL  &#9733;" },
  { bg: "#f59e0b", fg: "#1c1917", text: "FULL TIME" },
  { bg: "#111827", fg: "#fde68a", text: "TOP BINS" },
];

/** Advertising boards round the pitch. */
function boards(): string {
  const parts: string[] = [];
  const gap = 24;
  const panel = 66;
  const faceH = 10;
  const topH = 3;
  // North boards: we see their top and their south-facing ad face, with a shadow cast onto the grass.
  const ny = Y(0) - gap - faceH;
  parts.push(`<rect x="${X(-1)}" y="${ny + faceH}" width="${m(PITCH_L + 2)}" height="7" fill="url(#shadowDown)"/>`);
  for (let i = 0, x = X(-1); x < X(PITCH_L + 1); i++, x += panel) {
    const ad = ADS[i % ADS.length];
    const w = Math.min(panel - 1, X(PITCH_L + 1) - x);
    parts.push(
      `<rect x="${x}" y="${ny - topH}" width="${w}" height="${topH}" fill="url(#boardTop)"/>` +
        `<rect x="${x}" y="${ny}" width="${w}" height="${faceH}" fill="${ad.bg}"/>` +
        `<rect x="${x}" y="${ny}" width="${w}" height="${faceH}" fill="url(#panelSheen)"/>` +
        `<text x="${x + w / 2}" y="${ny + 7.4}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="6.6" letter-spacing="0.6" fill="${ad.fg}">${ad.text}</text>` +
        `<rect x="${x}" y="${ny + faceH - 1}" width="${w}" height="1" fill="#000000" opacity="0.35"/>`,
    );
  }
  // South boards: from this side we see their tops and plain backs.
  const sy = Y(PITCH_W) + gap;
  parts.push(
    `<rect x="${X(-1)}" y="${sy - topH}" width="${m(PITCH_L + 2)}" height="${topH}" fill="url(#boardTop)"/>` +
      `<rect x="${X(-1)}" y="${sy}" width="${m(PITCH_L + 2)}" height="${faceH}" fill="url(#boardBack)"/>`,
  );
  for (let x = X(-1); x < X(PITCH_L + 1); x += panel) parts.push(`<rect x="${x}" y="${sy}" width="1.2" height="${faceH}" fill="#0b0f14" opacity="0.6"/>`);
  // Boards behind each goal, seen end-on: tops, with a sliver of ad face on the side facing the pitch.
  for (const side of ["west", "east"] as const) {
    const x = side === "west" ? X(0) - gap - 4 - m(2) : X(PITCH_L) + gap + m(2);
    parts.push(`<rect x="${x}" y="${Y(-1)}" width="4" height="${m(PITCH_W + 2)}" fill="url(#boardTopSide)"/>`);
    for (let i = 0, y = Y(-1); y < Y(PITCH_W + 1); i++, y += panel) {
      const ad = ADS[(i + (side === "east" ? 2 : 0)) % ADS.length];
      parts.push(`<rect x="${side === "west" ? x + 4 : x - 2}" y="${y}" width="2" height="${Math.min(panel - 1, Y(PITCH_W + 1) - y)}" fill="${ad.bg}" opacity="0.9"/>`);
    }
    if (side === "west") parts.push(`<rect x="${x + 6}" y="${Y(-1)}" width="6" height="${m(PITCH_W + 2)}" fill="url(#shadowRight)"/>`);
  }
  return parts.join("");
}

function markings(): string {
  const boxW = 40.32;
  const boxD = 16.5;
  const sixW = 18.32;
  const sixD = 5.5;
  const cy = PITCH_W / 2;
  const end = (x: number, right: boolean) => {
    const dir = right ? -1 : 1;
    const left = (d: number) => (right ? X(x - d) : X(x));
    const spotX = x + dir * 11;
    // Penalty arc: the part of the 9.15m circle round the spot that sits outside the box.
    const edge = x + dir * boxD;
    const dx = Math.abs(edge - spotX);
    const dy = Math.sqrt(9.15 ** 2 - dx ** 2);
    return (
      `<rect x="${left(boxD)}" y="${Y(cy - boxW / 2)}" width="${m(boxD)}" height="${m(boxW)}"/>` +
      `<rect x="${left(sixD)}" y="${Y(cy - sixW / 2)}" width="${m(sixD)}" height="${m(sixW)}"/>` +
      `<path d="M ${X(edge)} ${Y(cy - dy)} A ${m(9.15)} ${m(9.15)} 0 0 ${right ? 0 : 1} ${X(edge)} ${Y(cy + dy)}"/>` +
      `<circle cx="${X(spotX)}" cy="${Y(cy)}" r="2" fill="#ffffff" stroke="none"/>`
    );
  };
  const corner = (x: number, y: number, a0: number) => {
    const r = m(1);
    const p = (a: number) => `${X(x) + Math.cos(a) * r} ${Y(y) + Math.sin(a) * r}`;
    return `<path d="M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a0 + Math.PI / 2)}"/>`;
  };
  const lines =
    `<rect x="${X(0)}" y="${Y(0)}" width="${m(PITCH_L)}" height="${m(PITCH_W)}"/>` +
    `<line x1="${X(PITCH_L / 2)}" y1="${Y(0)}" x2="${X(PITCH_L / 2)}" y2="${Y(PITCH_W)}"/>` +
    `<circle cx="${X(PITCH_L / 2)}" cy="${Y(cy)}" r="${m(9.15)}"/>` +
    `<circle cx="${X(PITCH_L / 2)}" cy="${Y(cy)}" r="2.2" fill="#ffffff" stroke="none"/>` +
    end(0, false) +
    end(PITCH_L, true) +
    corner(0, 0, 0) +
    corner(PITCH_L, 0, Math.PI / 2) +
    corner(PITCH_L, PITCH_W, Math.PI) +
    corner(0, PITCH_W, -Math.PI / 2);
  // A soft wide pass for chalk bleeding into the grass, then the crisp line on top.
  return (
    `<g fill="none" stroke="#ffffff" stroke-opacity="0.13" stroke-width="5" stroke-linejoin="round">${lines}</g>` +
    `<g fill="none" stroke="#f8fafc" stroke-opacity="0.9" stroke-width="2.1" stroke-linejoin="round">${lines}</g>`
  );
}

export function pitchSvg(): string {
  const stripes: string[] = [];
  const n = 20;
  for (let i = 0; i < n; i++) {
    const x = X((PITCH_L / n) * i);
    stripes.push(`<rect x="${x}" y="${Y(-2)}" width="${m(PITCH_L / n) + 0.5}" height="${m(PITCH_W + 4)}" fill="url(#${i % 2 ? "stripeA" : "stripeB"})"/>`);
  }
  const wear = (x: number) =>
    `<ellipse cx="${X(x)}" cy="${Y(PITCH_W / 2)}" rx="${m(4.5)}" ry="${m(7)}" fill="url(#wear)"/>` +
    `<ellipse cx="${X(x === 0 ? 11 : PITCH_L - 11)}" cy="${Y(PITCH_W / 2)}" rx="${m(1.8)}" ry="${m(2.4)}" fill="url(#wear)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WORLD_W}" height="${WORLD_H}" viewBox="0 0 ${WORLD_W} ${WORLD_H}">
<defs>
  <linearGradient id="concreteTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#565d66"/><stop offset="1" stop-color="#40464e"/></linearGradient>
  <linearGradient id="riser" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f35"/><stop offset="1" stop-color="#1b1f24"/></linearGradient>
  <linearGradient id="concreteSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b525a"/><stop offset="1" stop-color="#3a4047"/></linearGradient>
  <linearGradient id="apron" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6b3c"/><stop offset="1" stop-color="#245a31"/></linearGradient>
  <linearGradient id="stripeA" x1="0" y1="0" x2="0.15" y2="1"><stop offset="0" stop-color="#3f8f4a"/><stop offset="0.5" stop-color="#47994f"/><stop offset="1" stop-color="#3c8746"/></linearGradient>
  <linearGradient id="stripeB" x1="0" y1="0" x2="0.15" y2="1"><stop offset="0" stop-color="#357c3f"/><stop offset="0.5" stop-color="#3a8444"/><stop offset="1" stop-color="#32763c"/></linearGradient>
  <radialGradient id="light" cx="0.38" cy="0.32" r="0.85"><stop offset="0" stop-color="#fffbe6" stop-opacity="0.13"/><stop offset="0.6" stop-color="#fffbe6" stop-opacity="0"/><stop offset="1" stop-color="#001a08" stop-opacity="0.28"/></radialGradient>
  <radialGradient id="wear"><stop offset="0" stop-color="#8a7a4a" stop-opacity="0.35"/><stop offset="0.7" stop-color="#7a6d40" stop-opacity="0.12"/><stop offset="1" stop-color="#7a6d40" stop-opacity="0"/></radialGradient>
  <linearGradient id="boardTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5e7eb"/><stop offset="1" stop-color="#9ca3af"/></linearGradient>
  <linearGradient id="boardTopSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e5e7eb"/><stop offset="1" stop-color="#9ca3af"/></linearGradient>
  <linearGradient id="boardBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4149"/><stop offset="1" stop-color="#22272d"/></linearGradient>
  <linearGradient id="panelSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.25"/></linearGradient>
  <linearGradient id="shadowDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0.35"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></linearGradient>
  <linearGradient id="shadowRight" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0.3"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></linearGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4"/>
    <feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.2  0 0 0 0 0.05  0 0 0 1.4 -0.55"/>
  </filter>
  <filter id="mottle" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="9"/>
    <feColorMatrix values="0 0 0 0 0.85  0 0 0 0 0.95  0 0 0 0 0.6  0 0 0 0.9 -0.35"/>
  </filter>
</defs>
<rect width="${WORLD_W}" height="${WORLD_H}" fill="#30363d"/>
${stands()}
<rect x="${X(-5.5)}" y="${Y(-3.3)}" width="${m(PITCH_L + 11)}" height="${m(PITCH_W + 6.6)}" fill="url(#apron)"/>
${stripes.join("")}
<rect x="${X(-5.5)}" y="${Y(-3.3)}" width="${m(PITCH_L + 11)}" height="${m(PITCH_W + 6.6)}" filter="url(#mottle)" opacity="0.22"/>
<rect x="${X(-5.5)}" y="${Y(-3.3)}" width="${m(PITCH_L + 11)}" height="${m(PITCH_W + 6.6)}" filter="url(#grain)" opacity="0.55"/>
${wear(0)}${wear(PITCH_L)}
<ellipse cx="${X(PITCH_L / 2)}" cy="${Y(PITCH_W / 2)}" rx="${m(2)}" ry="${m(3)}" fill="url(#wear)" opacity="0.6"/>
${markings()}
<rect x="${X(-5.5)}" y="${Y(-3.3)}" width="${m(PITCH_L + 11)}" height="${m(PITCH_W + 6.6)}" fill="url(#light)"/>
${boards()}
</svg>`;
}

// ---------------------------------------------------------------------------
// Goals: separate assets so they can sit above or below the players
// ---------------------------------------------------------------------------

export interface GoalArt {
  svg: string;
  width: number;
  height: number;
  /** Where the middle of the goal line sits inside the SVG. */
  anchorX: number;
  anchorY: number;
}

const NET_DEFS = `
  <pattern id="mesh" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <path d="M0 0 H4 M0 0 V4" stroke="#ffffff" stroke-width="0.55" stroke-opacity="0.55" fill="none"/>
  </pattern>
  <linearGradient id="postV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#f1f5f9"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
  <linearGradient id="barV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#e2e8f0"/><stop offset="1" stop-color="#8b98a9"/></linearGradient>
  <linearGradient id="goalShadow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0.32"/><stop offset="1" stop-color="#000000" stop-opacity="0.05"/></linearGradient>`;

/**
 * A goal seen side-on from the three-quarter camera. The posts stand on the goal line and rise up the screen;
 * the net runs back off the end of the pitch. `left` is the goal at the left end (net going left).
 * Drawn far side first, so the near (south) side netting and post sit in front.
 */
export function goalArt(left: boolean): GoalArt {
  const gw = m(GOAL_WIDTH);
  const gh = m(GOAL_HEIGHT) * HEIGHT_SCALE;
  const gd = m(GOAL_DEPTH);
  const backH = gh * 0.62;
  const pad = 10;
  const width = gd + pad * 2 + 12;
  const height = gw + gh + pad * 2 + 8;
  const ax = left ? width - pad - 6 : pad + 6;
  const ay = pad + gh + gw / 2;
  const back = left ? ax - gd : ax + gd;
  const far = ay - gw / 2;
  const near = ay + gw / 2;
  const net = (d: string, shade: number) => `<path d="${d}" fill="#e2e8f0" fill-opacity="${shade}"/><path d="${d}" fill="url(#mesh)"/>`;
  const post = (y: number) => `<rect x="${ax - 1.75}" y="${y - gh - 1.5}" width="3.5" height="${gh + 1.5}" fill="url(#postV)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>${NET_DEFS}</defs>
<path d="M ${ax} ${far} L ${ax} ${near} L ${ax + 9} ${near + 7} L ${ax + 9} ${far + 7} Z" fill="url(#goalShadow)"/>
<path d="M ${back} ${far} L ${back} ${near} L ${back + 8} ${near + 6} L ${back + 8} ${far + 6} Z" fill="url(#goalShadow)" opacity="0.6"/>
${net(`M ${ax} ${far} L ${back} ${far} L ${back} ${far - backH} L ${ax} ${far - gh} Z`, 0.08)}
${net(`M ${back} ${far} L ${back} ${near} L ${back} ${near - backH} L ${back} ${far - backH} Z`, 0.14)}
<path d="M ${back} ${far} L ${back} ${near}" stroke="#94a3b8" stroke-width="1.4"/>
${post(far)}
${net(`M ${ax} ${far - gh} L ${ax} ${near - gh} L ${back} ${near - backH} L ${back} ${far - backH} Z`, 0.12)}
<rect x="${ax - 1.75}" y="${far - gh - 3}" width="3.5" height="${gw + 3}" rx="1" fill="url(#barV)"/>
${net(`M ${ax} ${near} L ${back} ${near} L ${back} ${near - backH} L ${ax} ${near - gh} Z`, 0.1)}
${post(near)}
</svg>`;
  return { svg, width, height, anchorX: ax, anchorY: ay };
}

// ---------------------------------------------------------------------------
// Tokens, ball, shadows, markers
// ---------------------------------------------------------------------------

export const TOKEN_R = 12;
const TOKEN_T = 4;

export interface TokenColours {
  light: string;
  base: string;
  dark: string;
  side: string;
}

export const KITS: Record<"us" | "them" | "usKeeper" | "themKeeper", TokenColours> = {
  us: { light: "#93c5fd", base: "#2563eb", dark: "#1e3a8a", side: "#1e3a8a" },
  them: { light: "#fca5a5", base: "#dc2626", dark: "#7f1d1d", side: "#7f1d1d" },
  usKeeper: { light: "#99f6e4", base: "#0d9488", dark: "#134e4a", side: "#134e4a" },
  themKeeper: { light: "#fde68a", base: "#d97706", dark: "#78350f", side: "#78350f" },
};

/** A player token: a shaded disc with visible thickness, like a counter seen from above and in front. */
export function tokenSvg(c: TokenColours): string {
  const s = TOKEN_R * 2 + 6;
  const cx = s / 2;
  const cy = TOKEN_R + 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s + TOKEN_T}" viewBox="0 0 ${s} ${s + TOKEN_T}">
<defs>
  <radialGradient id="top" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="${c.light}"/><stop offset="0.45" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
  <linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.side}"/><stop offset="0.3" stop-color="${c.base}"/><stop offset="1" stop-color="${c.side}"/></linearGradient>
</defs>
<circle cx="${cx}" cy="${cy + TOKEN_T}" r="${TOKEN_R}" fill="url(#side)"/>
<rect x="${cx - TOKEN_R}" y="${cy}" width="${TOKEN_R * 2}" height="${TOKEN_T}" fill="url(#side)"/>
<circle cx="${cx}" cy="${cy + TOKEN_T}" r="${TOKEN_R}" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1"/>
<circle cx="${cx}" cy="${cy}" r="${TOKEN_R}" fill="url(#top)"/>
<circle cx="${cx}" cy="${cy}" r="${TOKEN_R - 0.5}" fill="none" stroke="${c.dark}" stroke-width="1"/>
<circle cx="${cx}" cy="${cy}" r="${TOKEN_R - 2.8}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1"/>
<ellipse cx="${cx - 3.5}" cy="${cy - 5}" rx="4.5" ry="2.4" fill="#ffffff" opacity="0.32" transform="rotate(-25 ${cx - 3.5} ${cy - 5})"/>
</svg>`;
}

export function shadowSvg(rx: number, ry: number, opacity = 0.45): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${rx * 2}" height="${ry * 2}" viewBox="0 0 ${rx * 2} ${ry * 2}">
<defs><radialGradient id="s"><stop offset="0" stop-color="#000000" stop-opacity="${opacity}"/><stop offset="0.6" stop-color="#000000" stop-opacity="${opacity * 0.6}"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="${rx}" cy="${ry}" rx="${rx}" ry="${ry}" fill="url(#s)"/>
</svg>`;
}

/** Ring drawn under a player: white for you, gold for whoever you're controlling. */
export function ringSvg(colour: string): string {
  const r = TOKEN_R + 5;
  const s = r * 2 + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<ellipse cx="${s / 2}" cy="${s / 2}" rx="${r}" ry="${r * 0.82}" fill="none" stroke="${colour}" stroke-opacity="0.35" stroke-width="5"/>
<ellipse cx="${s / 2}" cy="${s / 2}" rx="${r}" ry="${r * 0.82}" fill="none" stroke="${colour}" stroke-width="2.2"/>
</svg>`;
}

/** A leather ball with stitched panels, lit from the north-west. */
export function ballSvg(): string {
  const r = 5.2;
  const s = 13;
  const c = s / 2;
  const pent = (x: number, y: number, size: number) => {
    const pts = Array.from({ length: 5 }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      return `${x + Math.cos(a) * size},${y + Math.sin(a) * size}`;
    });
    return `<polygon points="${pts.join(" ")}" fill="#1f2937"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<defs>
  <radialGradient id="leather" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#e5e7eb"/><stop offset="1" stop-color="#9ca3af"/></radialGradient>
  <clipPath id="ball"><circle cx="${c}" cy="${c}" r="${r}"/></clipPath>
</defs>
<circle cx="${c}" cy="${c}" r="${r}" fill="url(#leather)"/>
<g clip-path="url(#ball)" opacity="0.85">${pent(c, c, 1.9)}${pent(c - 4.6, c - 2, 1.7)}${pent(c + 4.4, c - 2.6, 1.7)}${pent(c - 2.8, c + 4.4, 1.7)}${pent(c + 3.2, c + 4, 1.7)}</g>
<circle cx="${c}" cy="${c}" r="${r - 0.3}" fill="none" stroke="#475569" stroke-width="0.6"/>
<ellipse cx="${c - 1.6}" cy="${c - 2}" rx="1.7" ry="1" fill="#ffffff" opacity="0.8"/>
</svg>`;
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
