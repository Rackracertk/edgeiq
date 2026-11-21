import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from './supabaseClient'

type Plan = 'weekly' | 'monthly' | 'annual' | 'undecided'

type Props = {
  userId: string | null
}

export default function ProInterest({ userId }: Props) {
  const [preferredPlan, setPreferredPlan] = useState<Plan>('monthly')
  const [registered, setRegistered] = useState(false)
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!supabase || !userId) {
      setRegistered(false)
      setLoading(false)
      setMessage('')
      return
    }

    setLoading(true)
    setMessage('')
    void supabase.from('pro_interest')
      .select('preferred_plan')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setMessage('Interest list unavailable: ' + error.message)
        setRegistered(!!data && !error)
        if (data?.preferred_plan && ['weekly', 'monthly', 'annual', 'undecided'].includes(data.preferred_plan)) {
          setPreferredPlan(data.preferred_plan as Plan)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !userId || !consent || loading || busy) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('pro_interest').upsert({
      user_id: userId,
      preferred_plan: preferredPlan,
      notify_on_launch: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) {
      setMessage('Unable to save your interest: ' + error.message)
    } else {
      setRegistered(true)
      setMessage('Your interest is saved. No payment was taken or scheduled.')
    }
    setBusy(false)
  }

  async function withdraw() {
    if (!supabase || !userId || busy) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('pro_interest').delete().eq('user_id', userId)
    if (error) {
      setMessage('Unable to remove you: ' + error.message)
    } else {
      setRegistered(false)
      setConsent(false)
      setMessage('You have been removed from the Pro interest list.')
    }
    setBusy(false)
  }

  return (
    <section className="panel" aria-label="Free Pro launch interest list" style={{ padding: 24, marginBottom: 22 }}>
      <div className="panel-title">
        <div>
          <span className="eyebrow gold">FREE BETA · NO PAYMENT DETAILS</span>
          <h3>Interested in EDGEIQ Pro?</h3>
        </div>
        <span className="small-tag">{registered ? 'INTEREST SAVED' : 'NO CHARGE'}</span>
      </div>
      <p style={{ color: '#aec8b6', fontSize: 13, lineHeight: 1.7 }}>
        Help us decide whether to launch Pro. Tell us which plan you would consider.
        This is an interest list, not a reservation or subscription. You will not be charged.
      </p>
      {!supabase ? <p className="footnote">Account services are unavailable.</p>
        : !userId ? <p className="footnote">Sign in above with your free account to register your interest.</p>
          : loading ? <p className="footnote" role="status">Checking your interest status…</p>
            : <form onSubmit={event => { void register(event) }} style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
              <label htmlFor="edgeiq-pro-preference">Which plan would you consider?</label>
              <select id="edgeiq-pro-preference" value={preferredPlan} disabled={busy} onChange={event => setPreferredPlan(event.target.value as Plan)}>
                <option value="weekly">$3.99 per week</option>
                <option value="monthly">$12.99 per month</option>
                <option value="annual">$79.99 per year</option>
                <option value="undecided">I'm not sure yet</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, lineHeight: 1.6 }}>
                <input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} style={{ marginTop: 4 }} />
                I agree to receive a one-time email at my account address when Pro is ready.
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="cta" type="submit" disabled={busy || !consent}>
                  {busy ? 'Saving…' : registered ? 'Update my interest' : 'Join free interest list'}
                </button>
                {registered && <button className="nav" type="button" disabled={busy} onClick={() => { void withdraw() }}>Remove me</button>}
              </div>
              <p className="footnote" style={{ margin: 0 }}>
                No credit card required. Joining does not start a trial or paid plan.
                You can remove yourself at any time. No launch emails are sent automatically yet.
              </p>
            </form>}
      {message && <p role="status" className="info-note">{message}</p>}
    </section>
  )
}
