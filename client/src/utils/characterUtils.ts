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
