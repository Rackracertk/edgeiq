
import { useState } from 'react'
import './App.css'

const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'Soccer', 'UFC']

function App() {
  const [sport, setSport] = useState('NBA')

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
        <p style={{ color: '#aab6c8' }}>
          Player statistics, matchup ratings, projections,
          and trends will appear here once data sources
          are connected.
        </p>
        <p style={{ color: '#6cf5a6' }}>
          Dashboard preview — live data not connected yet.
        </p>
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
