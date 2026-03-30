import { useState } from 'react'
import { ALL_PLAYERS } from '../utils/ranking'
import { COURSES_SORTED, TEE_LABELS } from '../utils/courses'

const emptyPlayer = () => ({ name: '', strokes: '' })

export default function AddRound({ onAdd, onTabChange }) {
  const today = new Date().toISOString().split('T')[0]
  const [date,       setDate]       = useState(today)
  const [courseName, setCourseName] = useState('')
  const [tee,        setTee]        = useState('')
  const [players,    setPlayers]    = useState([emptyPlayer()])
  const [errors,     setErrors]     = useState({})
  const [saved,      setSaved]      = useState(false)

  // ── Derived from course + tee selection ───────────────────────────────────
  const selectedCourse = COURSES_SORTED.find(c => c.name === courseName) || null
  const availableTees  = selectedCourse
    ? ['white', 'yellow'].filter(t => selectedCourse[t] !== null)
    : []
  const adjustment = (selectedCourse && tee !== '') ? selectedCourse[tee] : null

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCourseChange = (name) => {
    setCourseName(name)
    setErrors(e => { const n = {...e}; delete n.course; delete n.tee; return n })
    const c = COURSES_SORTED.find(c => c.name === name)
    if (!c) { setTee(''); return }
    const tees = ['white', 'yellow'].filter(t => c[t] !== null)
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
    if (players.length < 4) setPlayers(ps => [...ps, emptyPlayer()])
  }

  const removePlayerRow = (idx) => {
    if (players.length > 1) setPlayers(ps => ps.filter((_, i) => i !== idx))
  }

  const validate = () => {
    const errs = {}
    if (!date)       errs.date   = 'Dátum je povinný'
    if (!courseName) errs.course = 'Vyberte ihrisko'
    if (!tee)        errs.tee    = 'Vyberte odpaliskoté'

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
    onAdd({
      date,
      course:           courseName,
      tee,
      courseAdjustment: adj,
      players: players
        .filter(p => p.name && p.strokes)
        .map(p => ({
          name:           p.name,
          strokes:        Number(p.strokes),
          adjustedStrokes: Number(p.strokes) + adj,
        })),
    })

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setDate(today)
      setCourseName('')
      setTee('')
      setPlayers([emptyPlayer()])
      setErrors({})
      onTabChange('ranking')
    }, 1400)
  }

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

        {/* Odpaliskoté (tee) — shown only after a course is selected */}
        {selectedCourse && (
          <div className="form-group">
            <label className="form-label">Odpaliskoté</label>
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
            <span className="players-count">{players.length} / 4</span>
          </div>

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
                  {/* Live adjusted strokes preview */}
                  {adjustment !== null && player.strokes && !isNaN(Number(player.strokes)) && (
                    <div className="fg-adj-preview">
                      <span className="adj-preview-label">→</span>
                      <span className="adj-preview-value">
                        {Number(player.strokes) + adjustment}
                      </span>
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

          {players.length < 4 && (
            <button type="button" className="add-player-btn" onClick={addPlayerRow}>
              + Pridať hráča
            </button>
          )}
        </div>

        <button
          type="submit"
          className={`submit-btn${saved ? ' submit-saved' : ''}`}
          disabled={saved}
        >
          {saved ? '✓ Kolo uložené!' : 'Uložiť kolo'}
        </button>
      </form>
    </div>
  )
}
