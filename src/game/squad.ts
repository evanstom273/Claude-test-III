import { BASE_STARS, FORMATIONS, OUTFIELD_KEEPING, POSITIONS, ROLES, STATS, SURNAMES } from "./config";
import type { FormationId, Footballer, PositionCode, RoleId, Side, Stats, StyleId, Team } from "./types";

type Rng = () => number;

function halfStars(value: number): number {
  return Math.min(5, Math.max(0, Math.round(value * 2) / 2));
}

function between(min: number, max: number, rng: Rng): number {
  return min + rng() * (max - min);
}

export function generateStats(position: PositionCode, role: RoleId, rng: Rng): Stats {
  const stats = {} as Stats;
  for (const stat of STATS) {
    const base =
      stat === "keeping" && position !== "GK"
        ? between(OUTFIELD_KEEPING.min, OUTFIELD_KEEPING.max, rng)
        : between(BASE_STARS.min, BASE_STARS.max, rng);
    stats[stat] = halfStars(base + (ROLES[role].keyStats[stat] ?? 0));
  }
  return stats;
}

/** Draws surnames without repeats across both sides. */
export function namePool(rng: Rng) {
  const remaining = [...SURNAMES];
  return () => remaining.splice(Math.floor(rng() * remaining.length), 1)[0] ?? "Smith";
}

export interface UserPick {
  slot: number;
  role: RoleId;
  stats: Stats;
}

export function generateSide(
  name: string,
  team: Team,
  formation: FormationId,
  style: StyleId,
  nextName: () => string,
  rng: Rng,
  user?: UserPick,
): Side {
  const players: Footballer[] = FORMATIONS[formation].map((position, slot) => {
    const isUser = user?.slot === slot;
    const roles = POSITIONS[position].roles;
    const role = isUser ? user.role : roles[Math.floor(rng() * roles.length)];
    return {
      id: `${team}-${slot}`,
      name: isUser ? "You" : nextName(),
      team,
      position,
      role,
      stats: isUser ? user.stats : generateStats(position, role, rng),
      isUser,
    };
  });
  return { name, formation, style, players };
}
