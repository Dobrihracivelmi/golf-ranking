import { useState } from 'react'
import { ALL_PLAYERS } from '../utils/ranking'

const emptyPlayer = () => ({ name: '', strokes: '' })

export default function AddRound({ onAdd, courses, onTabChange }) {
  const today = new Date().toISOString().split('T')[0]
  const [date,    setDate]    = useState(today)
  const [course,  setCourse]  = useState('')
  const [players, setPlayers] = useState([emptyPlayer()])
  const [errors,  setErrors]  = useState({})
  const [saved,   setSaved]   = useState(false)

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
    if (!date) errs.date = 'Dátum je povinný'
    if (!course.trim()) errs.course = 'Názov ihriska je povinný'

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

    onAdd({
      date,
      course: course.trim(),
      players: players
        .filter(p => p.name && p.strokes)
        .map(p => ({ name: p.name, strokes: Number(p.strokes) })),
    })

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setDate(today)
      setCourse('')
      setPlayers([emptyPlayer()])
      setErrors({})
      onTabChange('ranking')
    }, 1400)
  }

  const usedNames   = new Set(players.map(p => p.name).filter(Boolean))
  const availableFor = (idx) =>
    ALL_PLAYERS.filter(n => n === players[idx].name || !usedNames.has(n))

  return (
    <div className="card">
      <h2 className="section-title">Pridať nové kolo</h2>

      <form onSubmit={handleSubmit} className="round-form" noValidate>
        {/* Dátum + Ihrisko */}
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label">Dátum</label>
            <input
              type="date"
              className={`form-input${errors.date ? ' input-error' : ''}`}
              value={date}
              max={today}
              onChange={e => { setDate(e.target.value); setErrors(prev => { const n = {...prev}; delete n.date; return n }) }}
            />
            {errors.date && <span className="err-msg">{errors.date}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Golfové ihrisko</label>
            <input
              type="text"
              list="course-options"
              className={`form-input${errors.course ? ' input-error' : ''}`}
              value={course}
              onChange={e => { setCourse(e.target.value); setErrors(prev => { const n = {...prev}; delete n.course; return n }) }}
              placeholder="napr. Augusta National"
              autoComplete="off"
            />
            <datalist id="course-options">
              {courses.map(c => <option key={c} value={c} />)}
            </datalist>
            {errors.course && <span className="err-msg">{errors.course}</span>}
          </div>
        </div>

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
