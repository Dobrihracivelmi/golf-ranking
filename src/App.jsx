import { useState, useEffect } from 'react'
import RankingTable from './components/RankingTable'
import AddRound from './components/AddRound'
import History from './components/History'
import CaptainPanel from './components/CaptainPanel'
import { DEFAULT_CAPTAIN_CATEGORIES } from './utils/ranking'

const STORAGE_KEY = 'golfGroupData'

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      rounds:            parsed.rounds            || [],
      captainCategories: parsed.captainCategories || DEFAULT_CAPTAIN_CATEGORIES,
      captainAwards:     parsed.captainAwards     || [],
    }
  } catch {
    return { rounds: [], captainCategories: DEFAULT_CAPTAIN_CATEGORIES, captainAwards: [] }
  }
}

export default function App() {
  const [tab, setTab] = useState('ranking')
  const [data, setData] = useState(loadData)

  // Captain auth state (not persisted — cleared on refresh)
  const [captainModalOpen, setCaptainModalOpen] = useState(false)
  const [captainAuth,      setCaptainAuth]      = useState(false)
  const [captainPanelOpen, setCaptainPanelOpen] = useState(false)
  const [pwInput,          setPwInput]          = useState('')
  const [pwError,          setPwError]          = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const addRound = (round) => {
    setData(prev => ({
      ...prev,
      rounds: [...prev.rounds, { ...round, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }],
    }))
  }

  const deleteRound = (id) => {
    setData(prev => ({ ...prev, rounds: prev.rounds.filter(r => r.id !== id) }))
  }

  const getCourses = () => Array.from(new Set(data.rounds.map(r => r.course).filter(Boolean)))

  // ── Captain handlers ──────────────────────────────────────────────────────
  const handleCrownClick = () => {
    if (captainAuth) {
      setCaptainPanelOpen(true)
    } else {
      setPwInput('')
      setPwError(false)
      setCaptainModalOpen(true)
    }
  }

  const handleCaptainLogin = () => {
    if (pwInput === 'bekis2025') {
      setCaptainAuth(true)
      setCaptainModalOpen(false)
      setCaptainPanelOpen(true)
      setPwInput('')
      setPwError(false)
    } else {
      setPwError(true)
      setPwInput('')
    }
  }

  const addCaptainAward = (award) => {
    setData(prev => ({ ...prev, captainAwards: [...prev.captainAwards, award] }))
  }

  const addCaptainCategory = (cat) => {
    setData(prev => ({ ...prev, captainCategories: [...prev.captainCategories, cat] }))
  }

  const editCaptainCategory = (cat) => {
    setData(prev => ({
      ...prev,
      captainCategories: prev.captainCategories.map(c => c.id === cat.id ? cat : c),
    }))
  }

  const deleteCaptainCategory = (id) => {
    setData(prev => ({
      ...prev,
      captainCategories: prev.captainCategories.filter(c => c.id !== id),
    }))
  }
  // ─────────────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'ranking', label: 'Rebríček',    icon: '🏆' },
    { id: 'add',     label: 'Pridať kolo', icon: '➕' },
    { id: 'history', label: 'História',    icon: '📋' },
  ]

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          <span className="site-logo">⛳</span>
          <div className="site-header-text">
            <h1 className="site-title">Dobrí veľmi hráči ☝🏽🍀⛳️</h1>
            <p className="site-sub">Sezónne poradie · H2H výkon</p>
          </div>
          <button
            className={`crown-btn${captainAuth ? ' crown-btn-active' : ''}`}
            onClick={handleCrownClick}
            title="Kapitánsky panel"
          >
            👑
          </button>
        </div>
      </header>

      <nav className="tab-nav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? ' tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="site-main">
        {tab === 'ranking' && (
          <RankingTable rounds={data.rounds} captainAwards={data.captainAwards} />
        )}
        {tab === 'add' && (
          <AddRound onAdd={addRound} courses={getCourses()} onTabChange={setTab} />
        )}
        {tab === 'history' && (
          <History rounds={data.rounds} onDelete={deleteRound} />
        )}
      </main>

      {/* ── Captain login modal ── */}
      {captainModalOpen && (
        <div className="modal-overlay" onClick={() => setCaptainModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">👑 Kapitánsky prístup</div>
            <p className="modal-sub">Zadajte heslo pre prístup kapitána Bekisa</p>
            <input
              type="password"
              className={`form-input${pwError ? ' input-error' : ''}`}
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false) }}
              placeholder="Heslo…"
              onKeyDown={e => e.key === 'Enter' && handleCaptainLogin()}
              autoFocus
            />
            {pwError && <span className="err-msg">Nesprávne heslo. Skúste znova.</span>}
            <div className="modal-actions">
              <button className="submit-btn" onClick={handleCaptainLogin}>Prihlásiť sa</button>
              <button className="cancel-btn" onClick={() => setCaptainModalOpen(false)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Captain panel side-drawer ── */}
      {captainPanelOpen && (
        <div className="captain-overlay" onClick={() => setCaptainPanelOpen(false)}>
          <div className="captain-overlay-inner" onClick={e => e.stopPropagation()}>
            <button
              className="captain-close-btn"
              onClick={() => setCaptainPanelOpen(false)}
              title="Zavrieť"
            >
              ✕
            </button>
            <CaptainPanel
              categories={data.captainCategories}
              awards={data.captainAwards}
              onAddAward={addCaptainAward}
              onAddCategory={addCaptainCategory}
              onEditCategory={editCaptainCategory}
              onDeleteCategory={deleteCaptainCategory}
            />
          </div>
        </div>
      )}
    </div>
  )
}
