import { fmtDate } from '../utils/ranking'

function pluralKolo(n) {
  if (n === 1) return 'kolo'
  if (n >= 2 && n <= 4) return 'kolá'
  return 'kôl'
}

export default function History({ rounds, onDelete }) {
  const sorted = [...rounds].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    return b.id.localeCompare(a.id)
  })

  const handleDelete = (round) => {
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

  // Group rounds by month for visual separation
  const grouped = []
  let currentMonth = null
  for (const round of sorted) {
    const month = round.date.slice(0, 7) // YYYY-MM
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
          const byScore = [...round.players].sort((a, b) => a.strokes - b.strokes)
          return (
            <div key={round.id} className="history-card">
              <div className="hc-header">
                <div className="hc-meta">
                  <span className="hc-course">⛳ {round.course}</span>
                  <span className="hc-date">{fmtDate(round.date)}</span>
                </div>
                <button
                  className="hc-delete"
                  onClick={() => handleDelete(round)}
                  title="Zmazať kolo"
                >
                  🗑
                </button>
              </div>

              <div className="hc-players">
                {byScore.map((p, idx) => (
                  <div key={p.name} className={`hc-player${idx === 0 ? ' hc-winner' : ''}`}>
                    {idx === 0 && <span className="hc-win-icon">🏆</span>}
                    <span className="hc-pname">{p.name}</span>
                    <span className="hc-strokes">{p.strokes}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
