import { adminRequest, requireEnv, respond } from '../_shared/core.ts'

function fixedTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}
function validNBA(obj: any): boolean {
  return Array.isArray(obj?.players) && obj.players.every((p: any) => typeof p?.id !== 'undefined' && typeof p?.name === 'string')
    && obj?.history && typeof obj.history === 'object' && !Array.isArray(obj.history)
    && Object.values(obj.history).every(value => Array.isArray(value) && value.every((g: any) =>
      typeof g?.date === 'string' && typeof g?.gameId === 'string' &&
      ['points', 'rebounds', 'assists', 'threes'].every(key => typeof g[key] === 'number' && Number.isFinite(g[key]))
    ))
}
function validNFL(obj: any): boolean {
  return Array.isArray(obj?.rows) && obj.rows.every((r: any) =>
    typeof r?.gameId === 'string' && typeof r?.playerId === 'string' &&
    typeof r?.player === 'string' && typeof r?.date === 'string' &&
    r.stats && typeof r.stats === 'object' &&
    Object.values(r.stats).every(v => typeof v === 'number' && Number.isFinite(v))
  )
}
// Protected ingestion: a trusted external scheduler POSTs JSON {"sport":"NBA"|"NFL"}.
// SPORTS_DATA_FEED_NBA / NFL must be HTTPS feeds with the normalized payload schema.
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const secret = requireEnv('RESEARCH_REFRESH_SECRET')
    if (!fixedTimeEqual(req.headers.get('x-edgeiq-refresh-key') ?? '', secret)) return new Response('Forbidden', { status: 403 })
    if (Deno.env.get('SPORTS_LICENSE_APPROVED') !== 'true') return new Response('Licensing not confirmed', { status: 503 })
    const input = await req.json()
    const sport = input?.sport
    if (sport !== 'NBA' && sport !== 'NFL') return new Response('Invalid sport', { status: 400 })
    const feedUrl = requireEnv('SPORTS_DATA_FEED_' + sport)
    if (!feedUrl.startsWith('https://')) return new Response('HTTPS provider URL required', { status: 503 })
    const provider = await fetch(feedUrl, {
      headers: { Authorization: 'Bearer ' + requireEnv('SPORTS_DATA_API_KEY') },
      signal: AbortSignal.timeout(20_000),
    })
    if (!provider.ok) throw new Error('Provider request failed: ' + provider.status)
    const data = await provider.json()
    if (!(sport === 'NBA' ? validNBA(data) : validNFL(data))) return new Response('Provider returned invalid research data', { status: 422 })
    await adminRequest('sports_cache?on_conflict=sport', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ sport, payload: data, source_label: requireEnv('SPORTS_DATA_SOURCE_LABEL'), refreshed_at: new Date().toISOString() }),
    })
    return respond(req, { refreshed: sport, records: sport === 'NBA' ? data.players.length : data.rows.length })
  } catch (error) {
    console.error('Licensed feed refresh failed', error)
    return new Response('Refresh failed; data not published', { status: 503 })
  }
})
