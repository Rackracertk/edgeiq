const site = () => Deno.env.get('APP_URL')?.replace(/\/$/, '') ?? ''
const safeOrigins = () => [site(), ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim())].filter(Boolean)

export function respond(req: Request, body: unknown, status = 200): Response {
  const origin = req.headers.get('origin') ?? ''
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'vary': 'Origin',
    'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  }
  if (safeOrigins().includes(origin)) headers['access-control-allow-origin'] = origin
  return new Response(JSON.stringify(body), { status, headers })
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return respond(req, {}, 200)
  const origin = req.headers.get('origin')
  if (origin && !safeOrigins().includes(origin)) return respond(req, { error: 'Origin not allowed' }, 403)
  return null
}

export function requireEnv(key: string): string {
  const value = Deno.env.get(key)
  if (!value) throw new Error('Server not configured: ' + key)
  return value
}

export async function authorizedUser(req: Request): Promise<{ id: string; email: string }> {
  const authorization = req.headers.get('authorization') ?? ''
  if (!/^Bearer\s+\S+$/i.test(authorization)) throw new Error('Sign in required')
  const result = await fetch(requireEnv('SUPABASE_URL') + '/auth/v1/user', {
    headers: {
      authorization,
      apikey: requireEnv('SUPABASE_ANON_KEY'),
    },
  })
  if (!result.ok) throw new Error('Session expired. Sign in again.')
  const user = await result.json()
  if (typeof user.id !== 'string' || typeof user.email !== 'string') throw new Error('Verified email required')
  return { id: user.id, email: user.email }
}

export async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(requireEnv('SUPABASE_URL') + '/rest/v1/' + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + key,
      apikey: key,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  if (!response.ok) {
    console.error('Supabase database error', response.status, (await response.text()).slice(0, 300))
    throw new Error('Database temporarily unavailable')
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export async function stripe(path: string, fields?: Record<string, string>, idempotency?: string): Promise<any> {
  const key = requireEnv('STRIPE_SECRET_KEY')
  const response = await fetch('https://api.stripe.com/v1/' + path, {
    method: fields ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + key,
      ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotency ? { 'Idempotency-Key': idempotency } : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
  })
  if (!response.ok) {
    console.error('Stripe error', response.status, (await response.text()).slice(0, 300))
    throw new Error('Billing service unavailable. Please try again later.')
  }
  return response.json()
}

export function publicError(req: Request, error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Unexpected server error'
  const safe = /^(Sign in required|Session expired|Verified email required|Already subscribed|Invalid plan|No billing account)/.test(message)
  if (!safe) console.error(error)
  return respond(req, { error: safe ? message : 'This service is not configured or temporarily unavailable.' }, safe ? 400 : 503)
}
