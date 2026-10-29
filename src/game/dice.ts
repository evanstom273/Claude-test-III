/** All 36 ways two dice can land. */
const PAIRS: [number, number][] = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) PAIRS.push([a, b]);

/**
 * Chance that 2d6 + modifier meets a target, with double one always failing and double six always succeeding.
 * The dice are behind the scenes now, but duels still work exactly this way.
 */
export function chanceToMeet(modifier: number, target: number): number {
  let hits = 0;
  for (const [a, b] of PAIRS) {
    if (a === 6 && b === 6) hits++;
    else if (!(a === 1 && b === 1) && a + b + modifier >= target) hits++;
  }
  return hits / 36;
}
