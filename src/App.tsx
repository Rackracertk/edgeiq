import { calculateRecentHitRates } from "./analytics/hitRates";
import { useEffect, useState } from 'react'
import './App.css'

import { getPlayerPropValues, type NBAPlayerGame } from './analytics/nbaData'


import { getNBABoxScore, extractNBAPlayerStats, getRecentNBAGames, buildNBAPlayerHistory } from './analytics/espnData'



const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'Soccer', 'UFC']




function App() {

useEffect(() => {
  let cancelled = false
  async function loadPlayers() {
    setLoadingPlayers(true)
    setLoadError('')
    try {
      const games = (await getRecentNBAGames(60)).filter(
        (game: any) => game.status?.type?.completed === true
      )
      // Avoid hundreds of simultaneous requests and preserve game/box-score alignment.
      const boxScores: any[][] = []
      for (let i = 0; i < games.length; i += 8) {
        const batch = await Promise.all(
          games.slice(i, i + 8).map((game: any) =>
            getNBABoxScore(game.id).catch(() => [])
          )
        )
        boxScores.push(...batch)
      }
      if (cancelled) return
      const history = buildNBAPlayerHistory(games, boxScores)
      const uniquePlayers = new Map<string, ReturnType<typeof extractNBAPlayerStats>[number]>()
      boxScores.forEach((boxScore) => {
        extractNBAPlayerStats(boxScore).forEach((player) => {
          if (player.id && player.name) uniquePlayers.set(String(player.id), player)
        })
      })
      setPlayerHistory(history)
      setRealPlayers(Array.from(uniquePlayers.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ))
    } catch (error) {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load NBA data')
    } finally {
      if (!cancelled) setLoadingPlayers(false)
    }
  }
  void loadPlayers()
  return () => { cancelled = true }
}, [])




const [sport, setSport] = useState('NBA')

const [playerSearch, setPlayerSearch] = useState('')

const [selectedProp, setSelectedProp] = useState('Points')
const [propLine, setPropLine] = useState(20)


const [realPlayers, setRealPlayers] = useState<ReturnType<typeof extractNBAPlayerStats>>([])
const [loadingPlayers, setLoadingPlayers] = useState(true)
const [loadError, setLoadError] = useState('')
const [playerHistory, setPlayerHistory] = useState<ReturnType<typeof buildNBAPlayerHistory>>({})



const selectedPlayer = realPlayers.find(
  (player) =>
    player.name.toLowerCase() === playerSearch.trim().toLowerCase()
)


const playerGames: NBAPlayerGame[] = selectedPlayer
  ? playerHistory[String(selectedPlayer.id)] ?? []
  : []


const sampleGameStats = getPlayerPropValues(
  playerGames,
  selectedProp
)

const liveHitRates = calculateRecentHitRates(
  sampleGameStats,
  propLine,
  'over'
)


  return (
    <main style={{
      minHeight: '100vh',
      background: '#090f1d',
      color: '#f5f7fb',
      padding: '32px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <h1 style={{ color: '#6cf5a6', margin: 0 }}>
          EDGEIQ
        </h1>
        <span>Sports Intelligence Platform</span>
      </header>

      <section style={{ marginTop: 55 }}>
        <p style={{ color: '#6cf5a6' }}>
          SMARTER RESEARCH. BETTER DECISIONS.
        </p>
        <h2 style={{ fontSize: 'clamp(28px, 5vw, 48px)' }}>
          Your Sports Analytics Command Center
        </h2>
        <p style={{ color: '#aab6c8' }}>
          Research players, compare matchups, and explore
          data-driven insights.
        </p>
      </section>

      <section style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 35
      }}>
        {sports.map(item => (
          <button
            key={item}
            onClick={() => setSport(item)}
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: '1px solid #344154',
              cursor: 'pointer',
              background: sport === item ? '#6cf5a6' : '#172235',
              color: sport === item ? '#09111b' : '#ffffff'
            }}
          >
            {item}
          </button>
        ))}
      </section>

      <section style={{
        background: '#172235',
        padding: 28,
        borderRadius: 16,
        marginTop: 30,
        border: '1px solid #344154'
      }}>
        <p style={{ color: '#6cf5a6' }}>{sport} ANALYTICS</p>
        <h2>{sport} Research Center</h2>
        <input
  type="text"

value={playerSearch}
onChange={(e) => setPlayerSearch(e.target.value)}

  placeholder="Search NBA players..."
  style={{
    width: '100%',
    maxWidth: 400,
    padding: 12,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 8,
    border: '1px solid #344154',
    background: '#10243b',
    color: 'white',
    fontSize: 16
  }}
/>
{playerSearch.trim() !== '' && (
  <div style={{ marginTop: 8, marginBottom: 20 }}>
   {realPlayers
      .filter((player) =>
        player.name.toLowerCase().includes(playerSearch.toLowerCase().trim())
      )
      .slice(0, 12)
      .map((player) => (
        <div
          key={String(player.id)}
          onClick={() => setPlayerSearch(player.name)}
          style={{
            padding: 12,
            marginBottom: 6,
            background: '#10243b',
            color: 'white',
            border: '1px solid #344154',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          {player.name}
        </div>
      ))}
  </div>
)}
        <select
  value={selectedProp}
  onChange={(e) => setSelectedProp(e.target.value)}
  style={{
    padding: 12,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 8,
    background: '#10243b',
    color: 'white',
    border: '1px solid #344154',
    fontSize: 16
  }}
>
  <option value="Points">Points</option>
  <option value="Rebounds">Rebounds</option>
  <option value="Assists">Assists</option>
  <option value="3-Pointers Made">3-Pointers Made</option>
  <option value="PRA">PRA</option>
</select>
<div style={{ marginTop: 16, marginBottom: 16 }}>
  <label style={{ marginRight: 12 }}>
    Prop Line:
  </label>
  <input
    type="number"
    min="0"
    value={propLine}
    onChange={(e) => setPropLine(Number(e.target.value))}
    style={{
      padding: 12,
      width: 100,
      borderRadius: 8,
      border: '1px solid #344154',
      background: '#10243b',
      color: 'white',
      fontSize: 16
    }}
  />
</div>

        <p style={{ color: '#aab6c8' }}>
          {loadingPlayers
            ? 'Loading NBA player history. This may take a moment...'
            : loadError
              ? `NBA data error: ${loadError}`
              : `${realPlayers.length} players loaded. Search for a player to see historical hit rates.`}
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
  {(['L5', 'L10', 'L20'] as const).map((period) => {
    
const rate = liveHitRates[period];

    const color = rate === null ? '#94a3b8' : rate >= 80 ? '#22c55e' : rate >= 60 ? '#facc15' : '#f87171';
    return (
      <div key={period} style={{ flex: '1 1 150px', background: '#10243b', border: '1px solid #28516a', borderRadius: 12, padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#8ba8bf', fontSize: 13 }}>LAST {period.slice(1)} GAMES</p>
        <h2 style={{ color, fontSize: 32, margin: '10px 0' }}>
          {rate === null ? 'N/A' : `${rate}%`}
        </h2>
       
<p style={{ color: '#a7b9c9', fontSize: 12 }}>
  {selectedPlayer
    ? `${selectedPlayer.name} • ${selectedProp} ${propLine}+`
    : 'Search for a player to view hit rates'}
</p>
</div>
)
})}
</div>
</section>


      <footer style={{
        marginTop: 70,
        color: '#8290a6',
        fontSize: 13
      }}>
        EDGEIQ © 2026 · Analytics for research and education
      </footer>
    </main>
  )
}

export default App
