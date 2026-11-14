import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { usingLicensedFeed } from './verifiedFeed'

type Plan = 'weekly' | 'monthly' | 'annual'
type Subscription = { status: string; current_period_end: string | null; cancel_at_period_end: boolean; stripe_customer_id: string | null }
type Saved = { id: string; sport: string; player_name: string; stat_category: string; prop_line: number; direction: string }
type Research = { sport: 'NBA' | 'NFL'; playerId: string; playerName: string; statCategory: string; line: number; direction: 'over' | 'under' }
type Props = { mode: 'pricing' | 'account'; currentResearch: Research | null; onResearch: () => void }

const plans: { id: Plan; label: string; price: string; term: string }[] = [
  { id: 'weekly', label: 'Weekly', price: '$3.99', term: '/week' },
  { id: 'monthly', label: 'Monthly', price: '$12.99', term: '/month' },
  { id: 'annual', label: 'Annual', price: '$79.99', term: '/year' },
]

export default function AccountCenter({ mode, currentResearch, onResearch }: Props) {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [saved, setSaved] = useState<Saved[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase) { setLoaded(true); return }
    const client = supabase
    const { data, error } = await client.auth.getUser()
    const person = error ? null : data.user
    setUser(person)
    if (!person) {
      setSubscription(null)
      setSaved([])
      setLoaded(true)
      return
    }
    const [subResponse, savedResponse] = await Promise.all([
      client.from('subscriptions').select('status,current_period_end,cancel_at_period_end,stripe_customer_id').eq('user_id', person.id).maybeSingle(),
      client.from('saved_research').select('id,sport,player_name,stat_category,prop_line,direction').order('created_at', { ascending: false }).limit(100),
    ])
    if (subResponse.error) setNotice('Subscription lookup unavailable: ' + subResponse.error.message)
    if (savedResponse.error) setNotice('Saved research unavailable: ' + savedResponse.error.message)
    setSubscription(subResponse.data ?? null)
    setSaved(savedResponse.data ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(() => {
      // Avoid calling the Supabase API synchronously inside the auth callback.
      setTimeout(() => { void refresh() }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  const isPro = subscription != null
    && ['active', 'trialing'].includes(subscription.status)
    && !!subscription.current_period_end
    && Date.parse(subscription.current_period_end) > Date.now()

  async function login(event: FormEvent) {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setNotice('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
      setNotice('Check your email for a secure sign-in link. Use the same browser to finish signing in.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Sign-in unavailable')
    } finally { setBusy(false) }
  }

  async function billing(action: 'create-checkout' | 'manage-billing', plan?: Plan) {
    if (!supabase || busy || !user) return
    setBusy(true)
    setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke(action, { body: plan ? { plan } : {} })
      if (error) throw error
      if (typeof data?.url !== 'string') throw new Error(data?.error ?? 'Billing service is not ready')
      const target = new URL(data.url)
      if (target.protocol !== 'https:' || !(target.hostname === 'stripe.com' || target.hostname.endsWith('.stripe.com'))) {
        throw new Error('Billing service returned an invalid destination')
      }
      window.location.assign(target.toString())
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Billing unavailable')
      setBusy(false)
    }
  }

  async function saveResearch() {
    if (!supabase || !user || !currentResearch || !isPro) return
    setBusy(true)
    setNotice('')
    const { error } = await supabase.from('saved_research').insert({
      user_id: user.id,
      sport: currentResearch.sport,
      player_id: currentResearch.playerId,
      player_name: currentResearch.playerName,
      stat_category: currentResearch.statCategory,
      prop_line: currentResearch.line,
      direction: currentResearch.direction,
    })
    if (error) setNotice(error.code === '23505' ? 'This research is already saved.' : error.message)
    else setNotice('Saved to your Pro research list.')
    await refresh()
    setBusy(false)
  }

  async function removeSaved(id: string) {
    if (!supabase || !user || busy) return
    setBusy(true)
    const { error } = await supabase.from('saved_research').delete().eq('id', id).eq('user_id', user.id)
    if (error) setNotice(error.message)
    await refresh()
    setBusy(false)
  }

  const serviceReady = !!supabase
  const checkoutReady = serviceReady && usingLicensedFeed
  const hasCustomer = !!subscription?.stripe_customer_id

  return (
    <>
      <section className="hero">
        <div className="eyebrow gold">EDGEIQ {mode === 'pricing' ? 'PRO MEMBERSHIP' : 'ACCOUNT CENTER'}</div>
        <h1>{mode === 'pricing' ? <>Research your <span className="gold">way.</span></> : <>Your research <span className="gold">workspace.</span></>}</h1>
        <p>Free player research for everyone. Pro adds private saved research and subscriber tools as they become available.</p>
      </section>
      {!serviceReady && <section className="panel" role="status" style={{ padding: 22, marginBottom: 20 }}>
        <strong>Account services are being connected.</strong>
        <p>Sign-in and payments are disabled until the site owner configures the production Supabase and Stripe services. No payments are being taken.</p>
      </section>}
      {notice && <p className="info-note" role="status">{notice}</p>}
      <section className="panel" style={{ padding: 24, marginBottom: 22 }}>
        <div className="panel-title"><h3>Account & billing</h3><span className="small-tag">{!loaded ? 'CHECKING' : isPro ? 'PRO ACTIVE' : user ? 'FREE ACCOUNT' : 'GUEST'}</span></div>
        {user ? <>
          <p>Signed in as <strong>{user.email}</strong></p>
          <p>{isPro ? 'Pro membership active' : 'Free membership'}{subscription?.current_period_end ? ' · Current period ends ' + new Date(subscription.current_period_end).toLocaleDateString() : ''}{subscription?.cancel_at_period_end ? ' · Cancels at period end' : ''}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {hasCustomer && <button className="cta" disabled={busy} onClick={() => void billing('manage-billing')}>Manage billing</button>}
            <button className="nav" disabled={busy} onClick={() => { void supabase?.auth.signOut() }}>Sign out</button>
            <button className="nav" disabled={busy} onClick={() => void refresh()}>Refresh membership</button>
          </div>
        </> : <form onSubmit={event => void login(event)} style={{ display: 'grid', gap: 12, maxWidth: 460 }}>
          <label htmlFor="edgeiq-login">Email address</label>
          <input id="edgeiq-login" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} disabled={!serviceReady || busy} />
          <button className="cta" disabled={!serviceReady || busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
          <p className="footnote">Password-free email sign-in. You must confirm your address to create or access an account.</p>
        </form>}
      </section>
      {mode === 'pricing' ? <>
        <div className="pricing-grid">
          <div className="panel price-card"><span className="eyebrow">FREE</span><h2>$0</h2><p>NBA and NFL player research, recent game logs and historical hit rates.</p><button className="cta" onClick={onResearch}>Start researching</button></div>
          {plans.map(plan => <div className="panel price-card" key={plan.id}>
            <span className="eyebrow gold">EDGEIQ PRO · {plan.label.toUpperCase()}</span><h2>{plan.price}<small>{plan.term}</small></h2>
            <p>Private saved research. Additional Pro analytics will be released only when verified and available.</p>
            <button className="cta" disabled={!checkoutReady || !user || busy || isPro} onClick={() => void billing('create-checkout', plan.id)}>
              {isPro ? 'Already a Pro member' : !checkoutReady ? 'Payments pending licensed data connection' : !user ? 'Sign in above to subscribe' : 'Continue to secure checkout'}
            </button>
          </div>)}
        </div>
        <p className="footnote">Subscriptions renew automatically until canceled. Prices displayed in USD. Review final billing terms in Stripe Checkout; manage or cancel in your account. Historical hit rates do not predict future results.</p>
      </> : <>
        <section className="panel" style={{ padding: 24 }}>
          <div className="panel-title"><h3>Saved player research</h3><span className="small-tag">{isPro ? 'PRO' : 'PRO FEATURE'}</span></div>
          {!user ? <p>Sign in to access your account.</p> : !isPro ? <p>Private saved research requires an active Pro subscription.</p> : <>
            {currentResearch ? <p>Selected: {currentResearch.playerName} · {currentResearch.statCategory} {currentResearch.direction} {currentResearch.line}</p> : <p>Choose an NBA player in Player Research, then return here to save the selection.</p>}
            <button className="cta" disabled={busy || !currentResearch} onClick={() => void saveResearch()}>Save selected player research</button>
            <div style={{ display: 'grid', gap: 9, marginTop: 20 }}>
              {saved.map(row => <div key={row.id} className="summary-row"><span>{row.sport} · {row.player_name} · {row.stat_category} {row.direction} {row.prop_line}</span><button className="nav" disabled={busy} onClick={() => void removeSaved(row.id)}>Remove</button></div>)}
              {!saved.length && <p className="footnote">Nothing saved yet.</p>}
            </div>
          </>}
        </section>
      </>}
    </>
  )
}
