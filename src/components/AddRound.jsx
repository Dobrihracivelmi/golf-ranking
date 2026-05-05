import { useState } from 'react'
import { ALL_PLAYERS } from '../utils/ranking'
import { COURSES_SORTED, TEE_LABELS } from '../utils/courses'
import { resolveStatus } from './ChallengesTab'

const emptyPlayer = () => ({ name: '', strokes: '', is9holes: false })

export default function AddRound({ onAdd, onTabChange, captainAuth, challenges = [], onUpdateChallenge }) {
  const today = new Date().toISOString().split('T')[0]
  const [date,       setDate]       = useState(today)
  const [courseName, setCourseName] = useState('')
  const [tee,        setTee]        = useState('')
  const [longestDrive, setLongestDrive] = useState([]) // array of player indices
  const [nearestPin,   setNearestPin]   = useState([]) // array of player indices
  const [players,      setPlayers]      = useState([emptyPlayer()])
  const [note,         setNote]         = useState('')
  const [isChallenge,  setIsChallenge]  = useState(false)
  const [challengeId,  setChallengeId]  = useState('')
  const [errors,       setErrors]       = useState({})
  const [saved,        setSaved]        = useState(false)

  // ── Derived from course + tee selection ───────────────────────────────────
  const selectedCourse = COURSES_SORTED.find(c => c.name === courseName) || null
  const availableTees  = selectedCourse
    ? ['white', 'yellow', 'black'].filter(t => selectedCourse[t] != null)
    : []
  const adjustment = (selectedCourse && tee !== '') ? selectedCourse[tee] : null

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCourseChange = (name) => {
    setCourseName(name)
    setErrors(e => { const n = {...e}; delete n.course; delete n.tee; return n })
    const c = COURSES_SORTED.find(c => c.name === name)
    if (!c) { setTee(''); return }
    const tees = ['white', 'yellow', 'black'].filter(t => c[t] != null)
    // Auto-select if only one tee available
    setTee(tees.length === 1 ? tees[0] : '')
  }

  const handleTeeChange = (t) => {
    setTee(t)
    setErrors(e => { const n = {...e}; delete n.tee; return n })
  }

  const updatePlayer = (idx, field, value) => {
    setPlayers(ps => ps.map((p, i) => i === idx ? { ...p, [field]: value } : p))
    setErrors(e => {
      const next = { ...e }
      delete next[`p_${idx}_${field}`]
      delete next.players
      return next
    })
  }

  const addPlayerRow = () => {
    if (players.length < 8) setPlayers(ps => [...ps, emptyPlayer()])
  }

  const removePlayerRow = (idx) => {
    if (players.length > 1) {
      setPlayers(ps => ps.filter((_, i) => i !== idx))
      const adjustIndices = (prev) =>
        prev.filter(i => i !== idx).map(i => i > idx ? i - 1 : i)
      setLongestDrive(adjustIndices)
      setNearestPin(adjustIndices)
    }
  }

  const maxAwards = players.length >= 5 ? 2 : 1

  const toggleAward = (setter, idx) => {
    setter(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx)
      if (prev.length >= maxAwards) return [...prev.slice(1), idx]
      return [...prev, idx]
    })
  }

  const validate = () => {
    const errs = {}
    if (!date)       errs.date   = 'Dátum je povinný'
    if (!courseName) errs.course = 'Vyberte ihrisko'
    if (!tee)        errs.tee    = 'Vyberte odpalisko'

    let filled = 0
    players.forEach((p, i) => {
      if (!p.name) errs[`p_${i}_name`] = 'Vyberte hráča'
      if (!p.strokes || isNaN(Number(p.strokes)) || Number(p.strokes) < 1 || !Number.isInteger(Number(p.strokes))) {
        errs[`p_${i}_strokes`] = 'Zadajte platné rany'
      }
      if (p.name && p.strokes && !isNaN(Number(p.strokes))) filled++
    })
    if (filled < 1) errs.players = 'Vyžaduje sa aspoň 1 úplne vyplnený hráč'
    const names = players.map(p => p.name).filter(Boolean)
    if (names.length !== new Set(names).size) errs.players = 'Duplikovaní hráči nie sú povolení'
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const adj = adjustment ?? 0
    const roundPlayers = players
      .filter(p => p.name && p.strokes)
      .map(p => ({
        name:            p.name,
        strokes:         Number(p.strokes),
        is9holes:        p.is9holes || false,
        adjustedStrokes: Number(p.strokes) * (p.is9holes ? 2 : 1) + adj,
      }))

    onAdd({
      date,
      course:           courseName,
      tee,
      courseAdjustment: adj,
      note:         note.trim() || null,
      longestDrive: longestDrive.map(i => players[i]?.name).filter(Boolean),
      nearestPin:   nearestPin.map(i => players[i]?.name).filter(Boolean),
      players: roundPlayers,
    })

    // Resolve selected challenge (captain only)
    if (isChallenge && challengeId && onUpdateChallenge && captainAuth) {
      const ch = challenges.find(c => c.id === challengeId)
      if (ch) {
        const challengerResult = roundPlayers.find(p => p.name === ch.challenger)
        const challengedResults = roundPlayers.filter(p => ch.challenged.includes(p.name))
        if (challengerResult && challengedResults.length > 0) {
          const challengerAdj = challengerResult.adjustedStrokes
          const allBeaten = challengedResults.every(p => challengerAdj < p.adjustedStrokes)
          onUpdateChallenge(challengeId, {
            status: allBeaten ? 'fulfilled' : 'failed',
            roundId: `resolved-${Date.now()}`,
          })
        }
      }
    }

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setDate(today)
      setCourseName('')
      setTee('')
      setLongestDrive([])
      setNearestPin([])
      setNote('')
      setPlayers([emptyPlayer()])
      setIsChallenge(false)
      setChallengeId('')
      setErrors({})
      onTabChange('ranking')
    }, 1400)
  }

  // Active challenges that match current players
  const playerNames = new Set(players.map(p => p.name).filter(Boolean))
  const activeChallenges = challenges.filter(ch => {
    if (resolveStatus(ch) !== 'pending') return false
    // Challenger and at least one challenged player must be in this round
    if (!playerNames.has(ch.challenger)) return false
    return ch.challenged.some(n => playerNames.has(n))
  })

  const usedNames    = new Set(players.map(p => p.name).filter(Boolean))
  const availableFor = (idx) =>
    ALL_PLAYERS.filter(n => n === players[idx].name || !usedNames.has(n))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="card">
      <h2 className="section-title">Pridať nové kolo</h2>

      <form onSubmit={handleSubmit} className="round-form" noValidate>

        {/* Dátum */}
        <div className="form-group">
          <label className="form-label">Dátum</label>
          <input
            type="date"
            className={`form-input${errors.date ? ' input-error' : ''}`}
            value={date}
            max={today}
            onChange={e => { setDate(e.target.value); setErrors(p => { const n={...p}; delete n.date; return n }) }}
          />
          {errors.date && <span className="err-msg">{errors.date}</span>}
        </div>

        {/* Ihrisko */}
        <div className="form-group">
          <label className="form-label">Ihrisko</label>
          <select
            className={`form-input${errors.course ? ' input-error' : ''}`}
            value={courseName}
            onChange={e => handleCourseChange(e.target.value)}
          >
            <option value="">Vybrať ihrisko…</option>
            {COURSES_SORTED.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          {errors.course && <span className="err-msg">{errors.course}</span>}
        </div>

        {/* Odpalisko (tee) — shown only after a course is selected */}
        {selectedCourse && (
          <div className="form-group">
            <label className="form-label">Odpalisko</label>
            <div className="tee-buttons">
              {availableTees.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`tee-btn tee-btn-${t}${tee === t ? ' tee-btn-selected' : ''}`}
                  onClick={() => handleTeeChange(t)}
                >
                  {TEE_LABELS[t]}
                </button>
              ))}
            </div>
            {errors.tee && <span className="err-msg">{errors.tee}</span>}
          </div>
        )}

        {/* Adjustment info */}
        {adjustment !== null && (
          <div className={`adj-info ${adjustment < 0 ? 'adj-neg' : adjustment > 0 ? 'adj-pos' : 'adj-zero'}`}>
            <span className="adj-info-label">Úprava pre toto kolo:</span>
            <span className="adj-info-value">
              {adjustment > 0 ? `+${adjustment}` : adjustment}
            </span>
            <span className="adj-info-hint">
              (upravené rany = vaše rany {adjustment >= 0 ? '+' : ''}{adjustment})
            </span>
          </div>
        )}

        {/* Hráči */}
        <div className="players-block">
          <div className="players-block-header">
            <h3 className="players-block-title">Hráči a výsledky</h3>
            <span className="players-count">{players.length} / 8</span>
          </div>

          {players.length >= 5 && (
            <div className="awards-max-hint">🏌️📍 Max 2 hráči na ocenenie</div>
          )}

          {errors.players && <div className="err-msg err-msg-block">{errors.players}</div>}

          <div className="player-rows">
            {players.map((player, idx) => (
              <div key={idx} className="player-row">
                <span className="player-row-num">{idx + 1}</span>
                <div className="player-row-inputs">
                  <div className="form-group fg-grow">
                    <select
                      className={`form-input${errors[`p_${idx}_name`] ? ' input-error' : ''}`}
                      value={player.name}
                      onChange={e => updatePlayer(idx, 'name', e.target.value)}
                    >
                      <option value="">Vybrať hráča…</option>
                      {availableFor(idx).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    {errors[`p_${idx}_name`] && (
                      <span className="err-msg">{errors[`p_${idx}_name`]}</span>
                    )}
                  </div>
                  <div className="form-group fg-strokes">
                    <input
                      type="number"
                      className={`form-input text-center${errors[`p_${idx}_strokes`] ? ' input-error' : ''}`}
                      value={player.strokes}
                      onChange={e => updatePlayer(idx, 'strokes', e.target.value)}
                      placeholder="Rany"
                      min="1"
                      max="200"
                    />
                    {errors[`p_${idx}_strokes`] && (
                      <span className="err-msg">{errors[`p_${idx}_strokes`]}</span>
                    )}
                  </div>
                  {/* Per-player 9 holes checkbox */}
                  <label className="award-check" title="9 jamiek (×2)">
                    <input
                      type="checkbox"
                      checked={player.is9holes || false}
                      onChange={e => updatePlayer(idx, 'is9holes', e.target.checked)}
                    />
                    <span className="award-check-label-9j">9j</span>
                  </label>
                  {/* Live adjusted strokes preview */}
                  {(adjustment !== null || player.is9holes) && player.strokes && !isNaN(Number(player.strokes)) && (
                    <div className="fg-adj-preview">
                      <span className="adj-preview-label">→</span>
                      <span className="adj-preview-value">
                        {Number(player.strokes) * (player.is9holes ? 2 : 1) + (adjustment ?? 0)}
                      </span>
                      {player.is9holes && <span className="adj-preview-9j">9j</span>}
                    </div>
                  )}
                  {/* LD / NP award checkboxes — only when 2+ players */}
                  {players.length >= 2 && (
                    <div className="player-row-awards">
                      <label className="award-check" title="Longest Drive">
                        <input
                          type="checkbox"
                          checked={longestDrive.includes(idx)}
                          onChange={() => toggleAward(setLongestDrive, idx)}
                        />
                        🏌️
                      </label>
                      <label className="award-check" title="Nearest to the Pin">
                        <input
                          type="checkbox"
                          checked={nearestPin.includes(idx)}
                          onChange={() => toggleAward(setNearestPin, idx)}
                        />
                        📍
                      </label>
                    </div>
                  )}
                </div>
                {players.length > 1 && (
                  <button
                    type="button"
                    className="remove-player-btn"
                    onClick={() => removePlayerRow(idx)}
                    title="Odstrániť hráča"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {players.length < 8 && (
            <button type="button" className="add-player-btn" onClick={addPlayerRow}>
              + Pridať hráča
            </button>
          )}
        </div>

        {/* Poznámka */}
        <div className="form-group">
          <label className="form-label">📝 Poznámka ku kolu (nepovinné)</label>
          <input
            type="text"
            className="form-input"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Napr. silný vietor, mokré ihrisko, výnimočný úder..."
          />
        </div>

        {/* Challenge linking */}
        <div className="ch-link-section">
          <label className="nine-holes-label">
            <input
              type="checkbox"
              checked={isChallenge}
              onChange={e => { setIsChallenge(e.target.checked); if (!e.target.checked) setChallengeId('') }}
            />
            🗡️ Táto hra je výzva
          </label>
          {isChallenge && (
            activeChallenges.length > 0 ? (
              <>
                <select
                  className="form-input"
                  value={challengeId}
                  onChange={e => setChallengeId(e.target.value)}
                  style={{ marginTop: 8 }}
                >
                  <option value="">— vybrať výzvu —</option>
                  {activeChallenges.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      {ch.challenger} → {ch.challenged.join(', ')}
                    </option>
                  ))}
                </select>
                {!captainAuth && (
                  <span className="ch-link-hint">Výzvu môže priradiť len kapitán 👑</span>
                )}
              </>
            ) : (
              <span className="ch-link-hint" style={{ marginTop: 6 }}>
                Žiadne aktívne výzvy pre týchto hráčov
              </span>
            )
          )}
        </div>

        {captainAuth ? (
          <button
            type="submit"
            className={`submit-btn${saved ? ' submit-saved' : ''}`}
            disabled={saved}
          >
            {saved ? '✓ Kolo uložené!' : 'Uložiť kolo'}
          </button>
        ) : (
          <div className="captain-gate-msg">
            Výsledok môže potvrdiť len kapitán 👑
          </div>
        )}
      </form>
    </div>
  )
}
