/**
 * SP cost to advance a skill from currentLevel to the next level.
 * null = Unskilled. Cost table: null→0: 1, 0→1: 1, n→n+1 (n≥1): 2^n
 */
export function getSkillUpgradeCost(currentLevel: number | null): number {
  if (currentLevel === null) return 1;
  if (currentLevel === 0)   return 1;
  return 2 ** currentLevel;
}

export function getStatDM(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—"
  if (score === 0) return "-3"
  if (score <= 2) return "-2"
  if (score <= 5) return "-1"
  if (score <= 8) return "+0"
  if (score <= 11) return "+1"
  if (score <= 14) return "+2"
  return "+3"
}

export function getSkillDM(level: number | null | undefined): string {
  if (level === null || level === undefined) return "-3"
  return level >= 0 ? `+${level}` : `${level}`
}
