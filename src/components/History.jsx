import { fmtDate, strokeRankMap } from '../utils/ranking'
import { TEE_LABELS } from '../utils/courses'

function pluralKolo(n) {
  if (n === 1) return 'kolo'
  if (n >= 2 && n <= 4) return 'kolá'
  return 'kôl'
}

export default function History({ rounds, onDelete, captainAuth, onRequestAuth }) {
  const sorted = [...rounds].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    return b.id.localeCompare(a.id)
  })

  const handleDelete = (round) => {
    if (!captainAuth) {
      onRequestAuth()
      return
    }
    const label = `${round.course} — ${fmtDate(round.date)}`
    if (window.confirm(`Zmazať kolo: ${label}?\n\nToto prepočíta celý rebríček.`)) {
      onDelete(round.id)
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <h2>Zatiaľ žiadne kolá</h2>
        <p>Pridajte prvé kolo pre zobrazenie histórie.</p>
      </div>
    )
  }

  // Compute pre-round rank map for each round
  const chronological = [...rounds].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.id || '').localeCompare(b.id || '')
  })
  const preRankByRoundId = {}
  for (let i = 0; i < chronological.length; i++) {
    preRankByRoundId[chronological[i].id] = strokeRankMap(chronological.slice(0, i))
  }

  const grouped = []
  let currentMonth = null
  for (const round of sorted) {
    const month = round.date.slice(0, 7)
    if (month !== currentMonth) {
      currentMonth = month
      const d = new Date(round.date + 'T00:00:00')
      grouped.push({
        type:  'month',
        label: d.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' }),
      })
    }
    grouped.push({ type: 'round', round })
  }

  return (
    <div>
      <div className="card">
        <div className="section-header">
          <h2 className="section-title">História kôl</h2>
          <span className="section-meta">{sorted.length} {pluralKolo(sorted.length)}</span>
        </div>
      </div>

      <div className="history-list">
        {grouped.map((item, i) => {
          if (item.type === 'month') {
            return (
              <div key={`month-${i}`} className="month-divider">
                <span>{item.label}</span>
              </div>
            )
          }
          const { round } = item
          const byScore = [...round.players].sort(
            (a, b) => (a.adjustedStrokes ?? a.strokes) - (b.adjustedStrokes ?? b.strokes)
          )
          const teeLabel = round.tee ? TEE_LABELS[round.tee] : null

          return (
            <div key={round.id} className="history-card">
              <div className="hc-header">
                <div className="hc-meta">
                  <span className="hc-course">
                    ⛳ {round.course}
                    {teeLabel && <span className="hc-tee"> · {teeLabel.toLowerCase()}</span>}
                  </span>
                  <span className="hc-date">{fmtDate(round.date)}</span>
                </div>
                {captainAuth && (
                  <button
                    className="hc-delete"
                    onClick={() => handleDelete(round)}
                    title="Zmazať kolo"
                  >
                    🗑
                  </button>
                )}
              </div>

              <div className="hc-players">
                {byScore.map((p, idx) => {
                  const hasAdj = p.adjustedStrokes !== undefined && p.adjustedStrokes !== p.strokes
                  const preRank = preRankByRoundId[round.id]?.[p.name]
                  return (
                    <div key={p.name} className={`hc-player${idx === 0 ? ' hc-winner' : ''}`}>
                      {idx === 0 && <span className="hc-win-icon">🏆</span>}
                      {preRank != null && <span className="hc-prerank">#{preRank}</span>}
                      <span className="hc-pname">{p.name}</span>
                      <span className="hc-strokes">
                        {p.strokes}
                        {hasAdj && <span className="hc-adj"> ({p.adjustedStrokes})</span>}
                        {(p.is9holes ?? round.is9holes) && <span className="hc-9j">9j</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
              {round.note && (
                <div className="hc-note">
                  <span className="hc-note-icon">📝</span>
                  <span className="hc-note-text">{round.note}</span>
                </div>
              )}
              {round.aiComment && (
                <div className="hc-commentary">
                  <span className="hc-commentary-icon">🎙️</span>
                  <span className="hc-commentary-text">{round.aiComment}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
