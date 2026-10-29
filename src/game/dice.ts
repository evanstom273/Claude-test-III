import type { CheckResult, Modifier } from "./types";

export type Rng = () => number;

export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}

export function roll2d6(rng: Rng = Math.random): [number, number] {
  return [rollDie(6, rng), rollDie(6, rng)];
}

/** All 36 ways two dice can land, lowest total first. */
const PAIRS: [number, number][] = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) PAIRS.push([a, b]);
PAIRS.sort((x, y) => x[0] + x[1] - (y[0] + y[1]));

/**
 * Dice for a given quantile (0 = worst possible roll, 1 = best). A uniformly random quantile gives
 * exactly the same odds as rolling, which is what lets a skill mini-game stand in for the dice fairly.
 */
export function diceForQuantile(u: number): [number, number] {
  return PAIRS[Math.min(35, Math.max(0, Math.floor(u * 36)))];
}

/** Chance that 2d6 + modifier meets a target, counting double one and double six. */
export function chanceToMeet(modifier: number, target: number): number {
  let hits = 0;
  for (const [a, b] of PAIRS) {
    if (a === 6 && b === 6) hits++;
    else if (!(a === 1 && b === 1) && a + b + modifier >= target) hits++;
  }
  return hits / 36;
}

let pendingQuantile: number | null = null;

/** Run something with the user's next roll decided by a skill result instead of luck. */
export function withSkill<T>(quantile: number, fn: () => T): T {
  pendingQuantile = quantile;
  try {
    return fn();
  } finally {
    pendingQuantile = null;
  }
}

/** Take the pending skill result, if there is one. Only the first roll that involves the user uses it. */
export function takeQuantile(): number | null {
  const q = pendingQuantile;
  pendingQuantile = null;
  return q;
}

/** Roll 2d6, add every modifier, compare against the target. Double one and double six are automatic. */
export function check(
  roller: string,
  modifiers: Modifier[],
  target: number,
  rng: Rng = Math.random,
  forced?: [number, number],
): CheckResult {
  const dice = forced ?? roll2d6(rng);
  const applied = modifiers.filter((m) => m.value !== 0);
  const total = dice[0] + dice[1] + applied.reduce((sum, m) => sum + m.value, 0);
  const crit = dice[0] === 6 && dice[1] === 6 ? "success" : dice[0] === 1 && dice[1] === 1 ? "fail" : null;
  return { dice, modifiers: applied, total, target, crit, roller };
}

/** Whether a roll meets a threshold, respecting double one / double six. */
export function meets(result: CheckResult, threshold: number): boolean {
  if (result.crit === "success") return true;
  if (result.crit === "fail") return false;
  return result.total >= threshold;
}

export function passed(result: CheckResult): boolean {
  return meets(result, result.target);
}

/**
 * The same roll seen from the defender's side. Because 2d6 is symmetrical, flipping each die (7 − n),
 * negating the modifiers and using a target of 15 − T gives exactly the same odds and the same outcome.
 * `threshold` lets shots mirror their save threshold rather than the attacker's target.
 */
export function mirror(result: CheckResult, roller: string, threshold = result.target): CheckResult {
  const dice: [number, number] = [7 - result.dice[0], 7 - result.dice[1]];
  const modifiers = result.modifiers.map((m) => ({ label: m.mirrorLabel ?? m.label, value: -m.value }));
  const crit = result.crit === "success" ? "fail" : result.crit === "fail" ? "success" : null;
  return { dice, modifiers, total: 14 - result.total, target: 15 - threshold, crit, roller };
}
