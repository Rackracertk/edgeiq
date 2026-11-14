import { adminRequest, requireEnv } from '../_shared/core.ts'

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')
}
async function isSigned(raw: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',').map(x => x.trim())
  const timestamp = parts.find(x => x.startsWith('t='))?.slice(2) ?? ''
  const provided = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3))
  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300 || !provided.length) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + raw)))
  return provided.some(value => {
    if (value.length !== expected.length) return false
    let mismatch = 0
    for (let i = 0; i < value.length; i++) mismatch |= value.charCodeAt(i) ^ expected.charCodeAt(i)
    return mismatch === 0
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const raw = await req.text()
  const verified = await isSigned(raw, req.headers.get('stripe-signature') ?? '', requireEnv('STRIPE_WEBHOOK_SECRET'))
  if (!verified) return new Response('Invalid signature', { status: 400 })
  try {
    const event = JSON.parse(raw)
    if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      return new Response('ignored', { status: 200 })
    }
    const sub = event.data?.object
    const userId = sub?.metadata?.edgeiq_user_id
    if (typeof userId !== 'string' || !/^[a-f0-9-]{36}$/i.test(userId)) {
      console.error('Subscription missing verified EDGEIQ user ID', event.id)
      return new Response('Unmapped subscription', { status: 422 })
    }
    const unix = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : String(sub.status ?? 'incomplete')
    const periodEnd = typeof unix === 'number' && Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : null
    const priceId = sub.items?.data?.[0]?.price?.id ?? null
    await adminRequest('subscriptions?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        stripe_customer_id: String(sub.customer),
        stripe_subscription_id: String(sub.id),
        status,
        price_id: priceId,
        current_period_end: periodEnd,
        cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      }),
    })
    return new Response('ok', { status: 200 })
  } catch (error) {
    console.error('Webhook processing failed', error)
    return new Response('Retry later', { status: 500 })
  }
})
