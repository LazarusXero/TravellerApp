/**
 * Returns the SP cost to advance a skill from `currentLevel` to the next level.
 *
 * Cost table:
 *   Unskilled (null) → 0 :  1 SP
 *   0 → 1              :  1 SP
 *   1 → 2              :  2 SP
 *   2 → 3              :  4 SP
 *   3 → 4              :  8 SP
 *   4 → 5              : 16 SP
 *   5 → 6              : 32 SP
 *   6 → 7              : 64 SP
 *   n → n+1 (n ≥ 1)   : 2^n SP
 */
export function getSkillUpgradeCost(currentLevel: number | null): number {
  if (currentLevel === null) return 1;   // Unskilled → 0
  if (currentLevel === 0)   return 1;   // 0 → 1
  return 2 ** currentLevel;             // 1→2: 2, 2→3: 4, …
}
