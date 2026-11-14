import { adminRequest, respond } from '../_shared/core.ts'

// Public read endpoint for VERIFIED, licensed, server-cached NBA/NFL research only.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return respond(req, {}, 200)
  if (req.method !== 'GET') return respond(req, { error: 'Method not allowed' }, 405)
  const sport = new URL(req.url).searchParams.get('sport')?.toUpperCase()
  if (sport !== 'NBA' && sport !== 'NFL') return respond(req, { error: 'Invalid sport' }, 400)
  if (Deno.env.get('SPORTS_LICENSE_APPROVED') !== 'true') {
    return respond(req, { error: 'Licensed data service not enabled' }, 503)
  }
  try {
    const rows = await adminRequest('sports_cache?sport=eq.' + sport + '&select=payload,source_label,refreshed_at') as Array<{ payload: unknown; source_label: string; refreshed_at: string }>
    const record = rows[0]
    if (!record) return respond(req, { error: 'No verified ' + sport + ' snapshot has been published' }, 503)
    const age = Date.now() - Date.parse(record.refreshed_at)
    if (!Number.isFinite(age) || age > 24 * 60 * 60 * 1000) return respond(req, { error: 'Verified feed is stale; refresh is required' }, 503)
    return respond(req, { sport, data: record.payload, source: record.source_label, refreshedAt: record.refreshed_at, stale: age > 60 * 60 * 1000 })
  } catch (error) {
    console.error('Sports feed read failed', error)
    return respond(req, { error: 'Sports feed temporarily unavailable' }, 503)
  }
})
