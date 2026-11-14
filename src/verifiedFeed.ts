// Opt-in production data flow. Does NOT use ESPN in a visitor's browser.
export const usingLicensedFeed = import.meta.env.VITE_RESEARCH_MODE === 'licensed'

export async function getVerifiedFeed<T>(sport: 'NBA' | 'NFL'): Promise<{ data: T; stale: boolean; refreshedAt: string }> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!base || !key) throw new Error('Licensed research feed not configured')
  const response = await fetch(base.replace(/\/$/, '') + '/functions/v1/sports-research?sport=' + sport, {
    headers: { apikey: key },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Verified ' + sport + ' research is unavailable')
  return payload as { data: T; stale: boolean; refreshedAt: string }
}
