import { useState } from 'react'
import { calculateRankings, fmtDate, fmtScore } from '../utils/ranking'
import { TEE_LABELS } from '../utils/courses'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEncounters(rounds, p1, p2, rankMap) {
  const shared = rounds.filter(r => {
    const names = r.players.map(p => p.name)
    return names.includes(p1) && names.includes(p2)
  }).sort((a, b) => b.date.localeCompare(a.date))

  const rank1 = rankMap[p1]
  const rank2 = rankMap[p2]

  return shared.map(round => {
    const pp1 = round.players.find(p => p.name === p1)
    const pp2 = round.players.find(p => p.name === p2)
    const s1  = pp1.adjustedStrokes ?? pp1.strokes
    const s2  = pp2.adjustedStrokes ?? pp2.strokes

    const winner = s1 < s2 ? p1 : s2 < s1 ? p2 : null // null = draw

    let h2hFor1 = 0
    if (winner && rank1 != null && rank2 != null) {
      if (winner === p1 && rank1 > rank2) {
        h2hFor1 = rank1 - rank2   // p1 upset win
      } else if (winner === p2 && rank2 > rank1) {
        h2hFor1 = -(rank2 - rank1) // p2 upset win
      }
    }

    return {
      id:       round.id,
      date:     round.date,
      course:   round.course,
      tee:      round.tee ?? null,
      is9p1: pp1.is9holes ?? round.is9holes ?? false,
      is9p2: pp2.is9holes ?? round.is9holes ?? false,
      s1, s2, winner, h2hFor1,
    }
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function H2HTab({ rounds, captainAwards, h2hAdjustments = {}, challenges = [] }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')

  // Players who have played at least one round, sorted
  const playerNames = [...new Set(rounds.flatMap(r => r.players.map(p => p.name)))]
    .sort((a, b) => a.localeCompare(b, 'sk'))

  // Need ranks for H2H points calculation
  const { ranked } = calculateRankings(rounds, captainAwards, h2hAdjustments, challenges)
  const rankMap = {}
  ranked.forEach((p, i) => { rankMap[p.name] = i + 1 })

  const showResult = p1 && p2 && p1 !== p2
  const encounters = showResult ? buildEncounters(rounds, p1, p2, rankMap) : []

  const wins1  = encounters.filter(e => e.winner === p1).length
  const wins2  = encounters.filter(e => e.winner === p2).length
  const draws  = encounters.filter(e => e.winner === null).length
  const h2hBal = encounters.reduce((s, e) => s + e.h2hFor1, 0) // positive = p1 advantage

  const avg1 = encounters.length > 0
    ? encounters.reduce((s, e) => s + e.s1, 0) / encounters.length : null
  const avg2 = encounters.length > 0
    ? encounters.reduce((s, e) => s + e.s2, 0) / encounters.length : null
  const best1 = encounters.length > 0 ? Math.min(...encounters.map(e => e.s1)) : null
  const best2 = encounters.length > 0 ? Math.min(...encounters.map(e => e.s2)) : null

  return (
    <div>
      <div className="card">
        <h2 className="section-title">⚔️ H2H Porovnanie</h2>

        {/* Player selectors */}
        <div className="h2h-selectors">
          <select
            className="form-input h2h-select"
            value={p1}
            onChange={e => { setP1(e.target.value); if (e.target.value === p2) setP2('') }}
          >
            <option value="">Vyber hráča 1…</option>
            {playerNames.filter(n => n !== p2).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <span className="h2h-vs">vs</span>

          <select
            className="form-input h2h-select"
            value={p2}
            onChange={e => { setP2(e.target.value); if (e.target.value === p1) setP1('') }}
          >
            <option value="">Vyber hráča 2…</option>
            {playerNames.filter(n => n !== p1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── No selection yet ── */}
      {!showResult && (
        <div className="empty-state">
          <div className="empty-icon">⚔️</div>
          <h2>Vyber dvoch hráčov</h2>
          <p>Zobrazí sa ich kompletná vzájomná história.</p>
        </div>
      )}

      {/* ── Both selected but no shared rounds ── */}
      {showResult && encounters.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🤷</div>
          <h2>Žiadne spoločné kolá</h2>
          <p>{p1} a {p2} ešte nehrali spolu.</p>
        </div>
      )}

      {/* ── Results ── */}
      {showResult && encounters.length > 0 && (
        <>
          {/* Overall record header */}
          <div className="card h2h-scoreboard">
            <div className="h2h-sb-players">
              <div className={`h2h-sb-side ${wins1 > wins2 ? 'h2h-winner' : ''}`}>
                <span className="h2h-sb-name">{p1}</span>
                <span className="h2h-sb-wins">{wins1}</span>
              </div>
              <div className="h2h-sb-middle">
                {draws > 0 && <span className="h2h-sb-draws">{draws} R</span>}
                <span className="h2h-sb-dash">—</span>
                <span className="h2h-sb-total">{encounters.length} kôl</span>
              </div>
              <div className={`h2h-sb-side h2h-sb-right ${wins2 > wins1 ? 'h2h-winner' : ''}`}>
                <span className="h2h-sb-wins">{wins2}</span>
                <span className="h2h-sb-name">{p2}</span>
              </div>
            </div>
            {h2hBal !== 0 && (
              <div className="h2h-sb-pts">
                H2H body:&nbsp;
                <span className="pos">{p1} {h2hBal > 0 ? `+${h2hBal}` : h2hBal}</span>
                {' · '}
                <span className="neg">{p2} {h2hBal > 0 ? -h2hBal : `+${-h2hBal}`}</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="card">
            <h3 className="section-title-sm" style={{ marginBottom: 12 }}>Štatistiky vzájomných kôl</h3>
            <div className="h2h-stat-grid">
              <div className="h2h-stat-col">
                <span className="h2h-stat-player">{p1}</span>
                <div className="h2h-stat-row">
                  <span className="h2h-stat-label">Priemer</span>
                  <span className="h2h-stat-val">{avg1 != null ? avg1.toFixed(1) : '—'}</span>
                </div>
                <div className="h2h-stat-row">
                  <span className="h2h-stat-label">Najlepšie kolo</span>
                  <span className="h2h-stat-val pos">{best1 ?? '—'}</span>
                </div>
                <div className="h2h-stat-row">
                  <span className="h2h-stat-label">Výhry</span>
                  <span className="h2h-stat-val pos">{wins1}</span>
                </div>
              </div>
              <div className="h2h-stat-divider" />
              <div className="h2h-stat-col h2h-stat-col-right">
                <span className="h2h-stat-player">{p2}</span>
                <div className="h2h-stat-row h2h-stat-row-r">
                  <span className="h2h-stat-val">{avg2 != null ? avg2.toFixed(1) : '—'}</span>
                  <span className="h2h-stat-label">Priemer</span>
                </div>
                <div className="h2h-stat-row h2h-stat-row-r">
                  <span className="h2h-stat-val pos">{best2 ?? '—'}</span>
                  <span className="h2h-stat-label">Najlepšie kolo</span>
                </div>
                <div className="h2h-stat-row h2h-stat-row-r">
                  <span className="h2h-stat-val pos">{wins2}</span>
                  <span className="h2h-stat-label">Výhry</span>
                </div>
              </div>
            </div>
          </div>

          {/* Round-by-round list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="section-header" style={{ padding: '16px 20px 12px' }}>
              <h3 className="section-title-sm">Spoločné kolá</h3>
              <span className="section-meta">{encounters.length}</span>
            </div>

            <div className="h2h-rounds">
              {encounters.map(enc => {
                const p1won = enc.winner === p1
                const p2won = enc.winner === p2
                const teeLabel = enc.tee ? TEE_LABELS[enc.tee]?.toLowerCase() : null
                return (
                  <div key={enc.id} className="h2h-round-row">
                    {/* Left player score */}
                    <div className={`h2h-rr-score h2h-rr-left ${p1won ? 'h2h-rr-win' : p2won ? 'h2h-rr-loss' : 'h2h-rr-draw'}`}>
                      {p1won && <span className="h2h-rr-crown">🏆</span>}
                      <span className="h2h-rr-num">{enc.s1}</span>
                      {enc.is9p1 && <span className="hc-9j">9j</span>}
                    </div>

                    {/* Middle: course + date */}
                    <div className="h2h-rr-mid">
                      <span className="h2h-rr-course">
                        {enc.course}
                        {teeLabel && <span className="h2h-rr-tee"> · {teeLabel}</span>}
                      </span>
                      <span className="h2h-rr-date">{fmtDate(enc.date)}</span>
                      {enc.h2hFor1 !== 0 && (
                        <span className={`h2h-rr-pts ${enc.h2hFor1 > 0 ? 'pos' : 'neg'}`}>
                          H2H: {enc.h2hFor1 > 0 ? `${p1} +${enc.h2hFor1}` : `${p2} +${-enc.h2hFor1}`}
                        </span>
                      )}
                    </div>

                    {/* Right player score */}
                    <div className={`h2h-rr-score h2h-rr-right ${p2won ? 'h2h-rr-win' : p1won ? 'h2h-rr-loss' : 'h2h-rr-draw'}`}>
                      <span className="h2h-rr-num">{enc.s2}</span>
                      {enc.is9p2 && <span className="hc-9j">9j</span>}
                      {p2won && <span className="h2h-rr-crown">🏆</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
