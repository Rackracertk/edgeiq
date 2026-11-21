import { adminRequest, authorizedUser, preflight, publicError, requireEnv, respond, stripe } from '../_shared/core.ts'

Deno.serve(async (req: Request) => {
  const blocked = preflight(req)
  if (blocked) return blocked
  if (req.method !== 'POST') return respond(req, { error: 'Method not allowed' }, 405)
  try {
    const user = await authorizedUser(req)
    const rows = await adminRequest('subscriptions?user_id=eq.' + encodeURIComponent(user.id) + '&select=stripe_customer_id') as Array<{stripe_customer_id: string | null}>
    const customer = rows?.[0]?.stripe_customer_id
    if (!customer) throw new Error('No billing account found')
    const session = await stripe('billing_portal/sessions', {
      customer, return_url: requireEnv('APP_URL').replace(/\/$/, '') + '/',
    })
    return respond(req, { url: session.url })
  } catch (error) {
    return publicError(req, error)
  }
})
