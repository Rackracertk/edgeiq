import { adminRequest, authorizedUser, preflight, requireEnv, respond } from '../_shared/core.ts'

// All premium calculations run server-side against the licensed, normalized cache.
// No client-provided player totals or subscription flags are trusted.
const nbaProps = ['Points', 'Rebounds', 'Assists', '3-Pointers Made', 'PRA']
const nflProps = ['Passing Yards', 'Passing TDs', 'Rushing Yards', 'Rushing Attempts', 'Receiving Yards', 'Receptions', 'Receiving TDs']

type Entry = { gameId: string; date: string; opponent: string; homeAway: string; value: number }
type Group = { games: number; hits: number; rate: number; average: number }
function group(rows: Entry[], line: number, direction: string, minimum = 1): Group | null {
  if (rows.length < minimum) return null
  const hits = rows.filter(row => direction === 'over' ? row.value > line : row.value < line).length
  return {
    games: rows.length, hits, rate: Math.round(100 * hits / rows.length),
    average: Math.round(10 * rows.reduce((sum, row) => sum + row.value, 0) / rows.length) / 10,
  }
}
function nbaValue(row: any, prop: string): number | null {
  const values: Record<string, number> = {
    Points: row.points, Rebounds: row.rebounds, Assists: row.assists,
    '3-Pointers Made': row.threes, PRA: row.points + row.rebounds + row.assists,
  }
  const value = values[prop]
  return Number.isFinite(value) ? value : null
}

Deno.serve(async req => {
  const blocked = preflight(req)
  if (blocked) return blocked
  if (req.method !== 'POST') return respond(req, { error: 'Method not allowed' }, 405)
  try {
    const user = await authorizedUser(req)
    const subscriptions = await adminRequest('subscriptions?user_id=eq.' + encodeURIComponent(user.id) + '&select=status,current_period_end') as Array<{ status: string; current_period_end: string | null }>
    const s = subscriptions[0]
    if (!s || !['active','trialing'].includes(s.status) || !s.current_period_end || Date.parse(s.current_period_end) <= Date.now()) {
      return respond(req, { error: 'Active EDGEIQ Pro subscription required' }, 403)
    }
    if (Deno.env.get('SPORTS_LICENSE_APPROVED') !== 'true') return respond(req, { error: 'Verified sports feed not enabled' }, 503)
    const input = await req.json()
    const sport: string = input?.sport
    const playerId: string = input?.playerId
    const prop: string = input?.prop
    const line: number = input?.line
    const direction: string = input?.direction
    if (!(sport === 'NBA' || sport === 'NFL') || typeof playerId !== 'string' || !/^[\w-]{1,48}$/.test(playerId) ||
      typeof prop !== 'string' || !(sport === 'NBA' ? nbaProps : nflProps).includes(prop) ||
      typeof line !== 'number' || !Number.isFinite(line) || line < 0 || line > 10000 ||
      !['over','under'].includes(direction)) {
      return respond(req, { error: 'Invalid research selection' }, 400)
    }
    const cache = await adminRequest('sports_cache?sport=eq.' + sport + '&select=payload,refreshed_at') as Array<{payload: any; refreshed_at: string}>
    if (!cache[0] || Date.now() - Date.parse(cache[0].refreshed_at) > 24 * 60 * 60 * 1000) {
      return respond(req, { error: 'Verified sports data is unavailable or stale' }, 503)
    }
    const payload = cache[0].payload
    let raw: Entry[] = []
    if (sport === 'NBA') {
      raw = (payload.history?.[playerId] ?? []).map((row: any) => ({
        gameId: String(row.gameId), date: String(row.date), opponent: String(row.opponent ?? ''),
        homeAway: String(row.homeAway ?? ''), value: nbaValue(row, prop),
      })).filter((row: Entry) => Number.isFinite(row.value))
    } else {
      raw = (payload.rows ?? []).filter((row: any) => row.playerId === playerId && Number.isFinite(row.stats?.[prop]))
        .map((row: any) => ({
          gameId: String(row.gameId), date: String(row.date), opponent: String(row.opponent ?? ''),
          homeAway: String(row.homeAway ?? ''), value: Number(row.stats[prop]),
        }))
    }
    const distinct = [...new Map(raw.map(row => [row.gameId, row])).values()]
      .sort((a, b) => b.date.localeCompare(a.date))
    const home = distinct.filter(row => row.homeAway === 'home')
    const away = distinct.filter(row => row.homeAway === 'away')
    const byOpponent = new Map<string, Entry[]>()
    distinct.forEach(row => {
      if (!row.opponent) return
      if (!byOpponent.has(row.opponent)) byOpponent.set(row.opponent, [])
      byOpponent.get(row.opponent)!.push(row)
    })
    const opponents = [...byOpponent.entries()]
      .map(([name, rows]) => ({ opponent: name, ...group(rows, line, direction)! }))
      .sort((a, b) => b.games - a.games || a.opponent.localeCompare(b.opponent)).slice(0, 8)
    return respond(req, {
      sport, playerId, prop, direction, line,
      sampleSize: distinct.length,
      season: group(distinct, line, direction),
      L5: group(distinct.slice(0, 5), line, direction, 5),
      L10: group(distinct.slice(0, 10), line, direction, 10),
      L20: group(distinct.slice(0, 20), line, direction, 20),
      home: group(home, line, direction),
      away: group(away, line, direction),
      opponents,
      refreshedAt: cache[0].refreshed_at,
    })
  } catch (error) {
    console.error('Pro insights error', error)
    return respond(req, { error: 'Premium analysis currently unavailable' }, 503)
  }
})
