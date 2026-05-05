import { useState, useRef, useEffect, useCallback } from 'react'
import RankingTable from './components/RankingTable'
import AddRound from './components/AddRound'
import History from './components/History'
import CaptainPanel from './components/CaptainPanel'
import H2HTab from './components/H2HTab'
import CoursesTab from './components/CoursesTab'
import ChallengesTab from './components/ChallengesTab'
import { useAppData } from './useAppData'

export default function App() {
  console.log('[App] render start')

  const {
    data,
    loading,
    error,
    addRound,
    deleteRound,
    addCaptainAward,
    deleteCaptainAward,
    addCaptainCategory,
    editCaptainCategory,
    deleteCaptainCategory,
    addChallenge,
    updateChallenge,
    deleteChallenge,
    setClaudeApiKey,
    restoreData,
  } = useAppData()

  console.log('[App] loading:', loading, '| error:', error, '| data:', data ? 'present' : 'null')

  const [tab, setTab] = useState('ranking')

  // Tab scroll-fade indicators
  const navRef     = useRef(null)
  const wrapperRef = useRef(null)
  const updateFade = useCallback(() => {
    const el = navRef.current
    const wr = wrapperRef.current
    if (!el || !wr) return
    const canScrollLeft  = el.scrollLeft > 2
    const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    wr.classList.toggle('fade-left',  canScrollLeft)
    wr.classList.toggle('fade-right', canScrollRight)
  }, [])
  useEffect(() => { updateFade() }, [tab, updateFade])
  useEffect(() => {
    window.addEventListener('resize', updateFade)
    return () => window.removeEventListener('resize', updateFade)
  }, [updateFade])

  // Captain auth state (session-only, not persisted)
  const [captainModalOpen, setCaptainModalOpen] = useState(false)
  const [captainAuth,      setCaptainAuth]      = useState(false)
  const [captainPanelOpen, setCaptainPanelOpen] = useState(false)
  const [pwInput,          setPwInput]          = useState('')
  const [pwError,          setPwError]          = useState(false)

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    console.log('[App] rendering loading screen')
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p className="loading-text">Načítavam dáta…</p>
        <p className="loading-sub">Pripájam sa k Firebase…</p>
      </div>
    )
  }

  // ── Error screen ──────────────────────────────────────────────────────────
  if (error) {
    console.error('[App] rendering error screen:', error)
    return (
      <div className="loading-screen">
        <div style={{ fontSize: '2.5rem' }}>⚠️</div>
        <h2 className="error-title">Chyba pripojenia</h2>
        <p className="error-msg">{error}</p>
        <button className="submit-btn" style={{ marginTop: 8 }} onClick={() => window.location.reload()}>
          Skúsiť znova
        </button>
      </div>
    )
  }

  // ── Safety net: data should never be null here, but guard anyway ──────────
  if (!data) {
    console.error('[App] loading=false, error=null, but data is still null — unexpected state')
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p className="loading-text">Inicializujem…</p>
      </div>
    )
  }

  console.log('[App] rendering main UI, tab:', tab)

  // ── Captain handlers ──────────────────────────────────────────────────────
  const openCaptainLogin = () => {
    setPwInput('')
    setPwError(false)
    setCaptainModalOpen(true)
  }

  const handleCrownClick = () => {
    if (captainAuth) {
      setCaptainPanelOpen(true)
    } else {
      openCaptainLogin()
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

  // ─────────────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'ranking', label: 'Rebríček',    icon: '🏆' },
    { id: 'add',     label: 'Pridať kolo', icon: '➕' },
    { id: 'history', label: 'História',    icon: '📋' },
    { id: 'h2h',     label: 'H2H',         icon: '🤺' },
    { id: 'challenges', label: 'Výzvy',   icon: '⚔️' },
    { id: 'courses', label: 'Ihriská',    icon: '⛳' },
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

      <div className="tab-nav-wrapper" ref={wrapperRef}>
        <nav className="tab-nav" ref={navRef} onScroll={updateFade}>
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
      </div>

      <main className="site-main">
        {tab === 'ranking' && (
          <RankingTable rounds={data.rounds} captainAwards={data.captainAwards} h2hAdjustments={data.h2hAdjustments} challenges={data.challenges} />
        )}
        {tab === 'add' && (
          <AddRound onAdd={addRound} onTabChange={setTab} captainAuth={captainAuth} challenges={data.challenges} onUpdateChallenge={updateChallenge} />
        )}
        {tab === 'history' && (
          <History
            rounds={data.rounds}
            onDelete={deleteRound}
            captainAuth={captainAuth}
            onRequestAuth={openCaptainLogin}
          />
        )}
        {tab === 'h2h' && (
          <H2HTab rounds={data.rounds} captainAwards={data.captainAwards} h2hAdjustments={data.h2hAdjustments} challenges={data.challenges} />
        )}
        {tab === 'challenges' && (
          <ChallengesTab
            challenges={data.challenges}
            captainAuth={captainAuth}
            onAdd={addChallenge}
            onDelete={deleteChallenge}
          />
        )}
        {tab === 'courses' && (
          <CoursesTab rounds={data.rounds} />
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
              rounds={data.rounds}
              onAddAward={addCaptainAward}
              onDeleteAward={deleteCaptainAward}
              onAddCategory={addCaptainCategory}
              onEditCategory={editCaptainCategory}
              onDeleteCategory={deleteCaptainCategory}
              onRestore={restoreData}
              claudeApiKey={data.claudeApiKey}
              onSetClaudeApiKey={setClaudeApiKey}
            />
          </div>
        </div>
      )}
    </div>
  )
}
