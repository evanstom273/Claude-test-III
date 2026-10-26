import type { CheckResult, Modifier } from "./types";

export type Rng = () => number;

export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}

export function roll2d6(rng: Rng = Math.random): [number, number] {
  return [rollDie(6, rng), rollDie(6, rng)];
}

/** Roll 2d6, add every modifier, compare against the target. Double one and double six are automatic. */
export function check(roller: string, modifiers: Modifier[], target: number, rng: Rng = Math.random): CheckResult {
  const dice = roll2d6(rng);
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
