export type InjuryReport = {
  playerId: string
  player: string
  team: string
  teamId: string
  status: string
  reason: string
  note: string
  updatedAt: string
  expectedReturn?: string
  position?: string
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}
export function normalizeInjuries(payload: any): InjuryReport[] {
  const groups: any[] = Array.isArray(payload?.injuries) ? payload.injuries : []
  const rows: InjuryReport[] = []
  for (const group of groups) {
    const groupTeam = group?.team ?? {}
    const entries: any[] = Array.isArray(group?.injuries) ? group.injuries : group?.athlete ? [group] : []
    for (const entry of entries) {
      const athlete = entry?.athlete ?? entry?.player ?? {}
      const team = entry?.team ?? groupTeam
      const playerId = text(athlete.id)
      const player = text(athlete.displayName || athlete.fullName || athlete.name)
      const status = text(typeof entry.status === 'string'
        ? entry.status : entry.status?.name || entry.status?.description || entry.status?.type || entry.fantasyStatus?.name)
      if ((!playerId && !player) || !status) continue
      rows.push({
        playerId, player, team: text(team.abbreviation), teamId: text(team.id),
        status,
        reason: text(entry.type?.name || entry.type?.description || entry.details?.type || entry.details?.detail || entry.injury?.description),
        note: text(entry.details?.shortComment || entry.details?.description || entry.shortComment || entry.details?.detail).slice(0,240),
        updatedAt: text(entry.date || entry.lastUpdated),
        expectedReturn: text(entry.details?.returnDate || entry.returnDate),
        position: text(athlete.position?.abbreviation || athlete.position?.name),
      })
    }
  }
  const unique = new Map<string, InjuryReport>()
  for (const item of rows) unique.set(item.playerId || (item.team + ':' + item.player), item)
  return [...unique.values()]
}
const normName = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')
export function findInjury(
  rows: InjuryReport[], playerId: string, player: string,
  team: string, teamId = '',
): InjuryReport | undefined {
  const byId = rows.find(item => item.playerId && item.playerId === playerId)
  if (byId) return byId
  const name = normName(player)
  return rows.find(item => normName(item.player) === name && (
    (!!teamId && item.teamId === teamId) || (!!team && item.team === team)
  ))
}
export type Availability = 'unavailable' | 'risk' | 'listed' | 'unknown'
export function injuryAvailability(status: string): Availability {
  const name = status.trim().toLowerCase().replace(/[-_]/g,' ')
  if (!name) return 'unknown'
  if (/\b(out|inactive|suspended|reserve|ir|pup|nfi|non football injury)\b/.test(name)) return 'unavailable'
  if (/\b(doubtful|questionable|game time|gtd|day to day)\b/.test(name)) return 'risk'
  return 'listed'
}
export function shouldExcludeInjury(item: InjuryReport | undefined): boolean {
  return !!item && ['unavailable','risk'].includes(injuryAvailability(item.status))
}
