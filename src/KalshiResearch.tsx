import { useState } from 'react'
import type { CheatPick } from './cheatSheetData'

type Props = { picks: CheatPick[] }
const kalshiUrl = 'https://kalshi.com/markets'
export default function KalshiResearch({ picks }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [contractLine, setContractLine] = useState('')
  const [yesPrice, setYesPrice] = useState('')
  const [copied, setCopied] = useState(false)
  const selected = picks.find(p => p.id === selectedId) ?? picks[0]
  const price = yesPrice.trim() === '' ? null : Number(yesPrice)
  const validPrice = price !== null && Number.isFinite(price) && price > 0 && price < 100
  const line = contractLine.trim() === '' ? null : Number(contractLine)
  const exact = selected && line !== null && Number.isFinite(line) && line === selected.line
  const binary = selected && ['Double-Double','Triple-Double'].includes(selected.category)
  const lookup = selected ? [selected.player, selected.category, selected.sport].join(' ') : ''
  const search = async () => {
    if (!selected) return
    try { await navigator.clipboard.writeText(lookup); setCopied(true) } catch { setCopied(false) }
    window.open(kalshiUrl, '_blank', 'noopener,noreferrer')
  }
  return <section className="panel" style={{padding:20,marginBottom:16}} aria-label="Kalshi contract research">
    <span className="eyebrow gold">KALSHI MODE · CONTRACT MATCHING</span>
    <h2 style={{margin:'8px 0'}}>Use EDGEIQ research with Kalshi</h2>
    <p>Choose a researched prop, find the corresponding Kalshi event, and compare its <b>exact settlement condition</b> and quoted Yes price. EDGEIQ does not place trades, connect to your Kalshi account, or claim a Kalshi contract exists.</p>
    {selected ? <div style={{display:'grid',gap:12,maxWidth:660}}>
      <label>EDGEIQ research pick
        <select style={{display:'block',width:'100%',marginTop:6}} value={selected.id} onChange={e=>{setSelectedId(e.target.value);setContractLine('');setYesPrice('');setCopied(false)}}>
          {picks.slice(0,80).map(p=><option key={p.id} value={p.id}>{p.player} · {p.direction.toUpperCase()} {p.line} {p.category} · {p.opponent}</option>)}
        </select>
      </label>
      <div><b>Research threshold:</b> {selected.direction.toUpperCase()} {selected.line} {selected.category} · L5 {selected.l5Hits}/{selected.l5Games} · L{selected.recentGames} {selected.recentHits}/{selected.recentGames}</div>
      <button className="cta" onClick={()=>void search()}>Open Kalshi markets and {copied ? 'copy search again' : 'copy player search'} ↗</button>
      <small>{copied ? 'Player search copied. Paste it into Kalshi search.' : 'Search Kalshi for the player and market. Verify event, game, player, settlement rules, and available contracts yourself.'}</small>
      {!binary && <label>Kalshi contract's numeric threshold
        <input style={{display:'block',width:'100%',marginTop:6}} type="number" step="0.5" placeholder="Enter the exact contract threshold" value={contractLine} onChange={e=>setContractLine(e.target.value)}/>
      </label>}
      <label>Kalshi Yes price (cents, 1–99)
        <input style={{display:'block',width:'100%',marginTop:6}} type="number" min="1" max="99" step="0.1" placeholder="Example: 63" value={yesPrice} onChange={e=>setYesPrice(e.target.value)}/>
      </label>
      <p role="status">{binary ? 'For milestone contracts, compare the exact Yes/No settlement wording.' : line === null ? 'Enter Kalshi’s threshold to check whether it matches the EDGEIQ research line.' : exact ? '✓ Numeric threshold matches. Confirm whether Kalshi’s settlement wording uses the same strict over/under rule.' : '⚠ Different threshold: EDGEIQ’s displayed hit rate does not apply to this Kalshi contract.'}</p>
      {validPrice && <p><b>Yes price: {price}¢</b> · gross break-even {(price!).toFixed(1)}% · No at the complementary quoted price would be {(100-price!).toFixed(1)}¢ before spread/fees. <b>This is not a win prediction or expected value.</b> Kalshi’s actual No price, fees and fill price may differ.</p>}
      <small>Research only. Contracts can settle using different definitions, and Kalshi markets may be unavailable in your jurisdiction. Prices are user-entered, not live. No automatic betting or guaranteed returns.</small>
    </div> : <p>No qualifying NBA/NFL research picks are available to compare with Kalshi yet.</p>}
  </section>
}
