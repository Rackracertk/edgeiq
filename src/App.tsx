import { useState } from 'react'
import './App.css'
import TheScript from './TheScript'
import type { ScriptSport } from './analytics/scriptSports'

export default function App(){
 const [sport,setSport]=useState<ScriptSport>('NBA')
 return <div className="shell script-only-shell"><main className="main script-only-main">
  <header className="topbar script-only-header"><div className="brand script-wordmark" aria-label="EDGEIQ">EDGEIQ</div><span className="free-beta-pill">FREE ACCESS</span></header>
  <TheScript selectedSport={sport} onSportChange={setSport}/>
  <footer>EDGEIQ © 2026 · Independent sports research · No guaranteed outcomes · 18+ where applicable</footer>
 </main></div>
}
