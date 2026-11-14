import { adminRequest, authorizedUser, preflight, publicError, requireEnv, respond, stripe } from '../_shared/core.ts'

const plans: Record<string, string> = {
  weekly: 'STRIPE_PRICE_WEEKLY',
  monthly: 'STRIPE_PRICE_MONTHLY',
  annual: 'STRIPE_PRICE_ANNUAL',
}

Deno.serve(async (req: Request) => {
  const blocked = preflight(req)
  if (blocked) return blocked
  if (req.method !== 'POST') return respond(req, { error: 'Method not allowed' }, 405)
  try {
    if (Deno.env.get('SPORTS_LICENSE_APPROVED') !== 'true') throw new Error('Subscriptions are not available until licensed research data is enabled')
    const feeds = await adminRequest('sports_cache?select=sport,refreshed_at') as Array<{sport: string; refreshed_at: string}>
    const fresh = feeds.filter(row => Date.now() - Date.parse(row.refreshed_at) < 24 * 60 * 60 * 1000).map(row => row.sport)
    if (!fresh.includes('NBA') || !fresh.includes('NFL')) throw new Error('Research feed is not ready for billing')
    const user = await authorizedUser(req)
    const payload = await req.json()
    const plan = typeof payload.plan === 'string' ? payload.plan : ''
    if (!Object.hasOwn(plans, plan)) throw new Error('Invalid plan')
    const price = requireEnv(plans[plan])
    const appUrl = requireEnv('APP_URL').replace(/\/$/, '')
    const rows = await adminRequest('subscriptions?user_id=eq.' + encodeURIComponent(user.id) + '&select=stripe_customer_id,status,current_period_end') as Array<{
      stripe_customer_id: string | null; status: string; current_period_end: string | null
    }>
    const existing = rows?.[0]
    if (existing && ['active', 'trialing'].includes(existing.status) && existing.current_period_end && Date.parse(existing.current_period_end) > Date.now()) {
      throw new Error('Already subscribed; manage your plan in Account')
    }
    const customer = existing?.stripe_customer_id || (await stripe('customers', {
      email: user.email, 'metadata[edgeiq_user_id]': user.id,
    }, 'edgeiq-customer-' + user.id)).id
    const session = await stripe('checkout/sessions', {
      mode: 'subscription',
      customer: String(customer),
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      client_reference_id: user.id,
      'metadata[edgeiq_user_id]': user.id,
      'subscription_data[metadata][edgeiq_user_id]': user.id,
      success_url: appUrl + '/?billing=return',
      cancel_url: appUrl + '/?billing=cancel',
    })
    return respond(req, { url: session.url })
  } catch (error) {
    return publicError(req, error)
  }
})
