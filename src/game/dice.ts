import type { CheckResult, Modifier } from "./types";

export type Rng = () => number;

export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}

export function roll2d6(rng: Rng = Math.random): [number, number] {
  return [rollDie(6, rng), rollDie(6, rng)];
}

/** Roll 2d6, add every modifier, compare against the target. */
export function check(modifiers: Modifier[], target: number, rng: Rng = Math.random): CheckResult {
  const dice = roll2d6(rng);
  const applied = modifiers.filter((m) => m.value !== 0);
  const total = dice[0] + dice[1] + applied.reduce((sum, m) => sum + m.value, 0);
  return { dice, modifiers: applied, total, target };
}

export function passed(result: CheckResult): boolean {
  return result.total >= result.target;
}
