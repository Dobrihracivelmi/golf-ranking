import { useState } from 'react'
import { ALL_PLAYERS, fmtDate } from '../utils/ranking'
import { TEE_LABELS } from '../utils/courses'

export default function CoursesTab({ rounds }) {
  const [expanded, setExpanded] = useState(null)

  // Build course stats from all rounds
  const courseMap = {}
  for (const round of rounds) {
    const key = round.course
    if (!courseMap[key]) {
      courseMap[key] = { name: key, rounds: [], players: new Set() }
    }
    courseMap[key].rounds.push(round)
    for (const p of round.players) courseMap[key].players.add(p.name)
  }

  const courses = Object.values(courseMap)
    .map(c => {
      const allScores = c.rounds
        .flatMap(r => r.players
          .filter(p => !(p.is9holes ?? r.is9holes))
          .map(p => ({ name: p.name, strokes: p.strokes, date: r.date }))
        )

      let best = null, worst = null, avg = null
      if (allScores.length > 0) {
        best = allScores.reduce((a, b) => a.strokes < b.strokes ? a : b)
        worst = allScores.reduce((a, b) => a.strokes > b.strokes ? a : b)
        avg = allScores.reduce((s, x) => s + x.strokes, 0) / allScores.length
      }

      const neverPlayed = ALL_PLAYERS.filter(n => !c.players.has(n))

      return { ...c, best, worst, avg, neverPlayed, count: c.rounds.length }
    })
    .sort((a, b) => b.count - a.count)

  if (courses.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⛳</div>
        <h2>Zatiaľ žiadne kolá</h2>
        <p>Po pridaní prvého kola sa tu zobrazia ihriská.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <div className="section-header">
          <h2 className="section-title">⛳ Ihriská</h2>
          <span className="section-meta">{courses.length} ihrísk</span>
        </div>
      </div>

      <div className="courses-list">
        {courses.map(c => {
          const isOpen = expanded === c.name

          const sortedRounds = [...c.rounds].sort((a, b) => b.date.localeCompare(a.date))

          return (
            <div key={c.name} className="course-card">
              <button
                className="course-header"
                onClick={() => setExpanded(isOpen ? null : c.name)}
              >
                <div className="course-header-left">
                  <span className="course-name">{c.name}</span>
                  <span className="course-meta">
                    {c.count}× hrané · {c.players.size} hráčov
                  </span>
                </div>
                <span className={`course-expand ${isOpen ? 'course-expand-open' : ''}`}>▾</span>
              </button>

              <div className="course-stats">
                {c.best && (
                  <div className="course-stat">
                    <span className="course-stat-label">Najlepšie brutto</span>
                    <span className="course-stat-val pos">{c.best.strokes}</span>
                    <span className="course-stat-sub">{c.best.name}</span>
                  </div>
                )}
                {c.worst && (
                  <div className="course-stat">
                    <span className="course-stat-label">Najhoršie brutto</span>
                    <span className="course-stat-val neg">{c.worst.strokes}</span>
                    <span className="course-stat-sub">{c.worst.name}</span>
                  </div>
                )}
                {c.avg != null && (
                  <div className="course-stat">
                    <span className="course-stat-label">Priemer skupiny</span>
                    <span className="course-stat-val">{c.avg.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {c.neverPlayed.length > 0 && (
                <div className="course-never">
                  <span className="course-never-label">Ešte nehrali:</span>
                  {c.neverPlayed.map(n => (
                    <span key={n} className="course-never-tag">{n}</span>
                  ))}
                </div>
              )}

              {isOpen && (
                <div className="course-history">
                  {sortedRounds.map(round => {
                    const byScore = [...round.players].sort(
                      (a, b) => (a.adjustedStrokes ?? a.strokes) - (b.adjustedStrokes ?? b.strokes)
                    )
                    const teeLabel = round.tee ? TEE_LABELS[round.tee] : null
                    return (
                      <div key={round.id} className="course-round">
                        <div className="course-round-header">
                          <span className="course-round-date">{fmtDate(round.date)}</span>
                          {teeLabel && <span className="course-round-tee">{teeLabel.toLowerCase()}</span>}
                          {round.is9holes && <span className="hc-9j">9j</span>}  {/* legacy round-level */}
                        </div>
                        <div className="course-round-players">
                          {byScore.map((p, idx) => (
                            <span key={p.name} className={`course-round-player ${idx === 0 ? 'course-round-winner' : ''}`}>
                              {idx === 0 && '🏆 '}{p.name} {p.strokes}
                              {p.adjustedStrokes != null && p.adjustedStrokes !== p.strokes && (
                                <span className="hc-adj"> ({p.adjustedStrokes})</span>
                              )}
                              {(p.is9holes ?? round.is9holes) && <span className="hc-9j">9j</span>}
                            </span>
                          ))}
                        </div>
                        {round.aiComment && (
                          <div className="hc-commentary" style={{ paddingLeft: 0 }}>
                            <span className="hc-commentary-icon">🎙️</span>
                            <span className="hc-commentary-text">{round.aiComment}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
