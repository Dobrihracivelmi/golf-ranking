import { useState } from 'react'

const COURSE_PAR = 72

// WHS table: [minRounds, maxRounds, lowestCount, adjustment]
const WHS_TABLE = [
  [3,  3,  1, -2.0],
  [4,  4,  1, -1.0],
  [5,  5,  1,  0.0],
  [6,  6,  2, -1.0],
  [7,  8,  2,  0.0],
  [9,  11, 3,  0.0],
  [12, 14, 4,  0.0],
  [15, 16, 5,  0.0],
  [17, 18, 6,  0.0],
  [19, 19, 7,  0.0],
  [20, 20, 8,  0.0],
]

function getWHSParams(n) {
  for (const [min, max, count, adj] of WHS_TABLE) {
    if (n >= min && n <= max) return { count, adj }
  }
  return null
}

// Returns { hcp, selected, roundsUsed } or null if < 3 rounds
// entries: [{ score, course, date }] in chronological order
function computeHcpDetails(entries) {
  if (entries.length < 3) return null
  const recent = entries.slice(-20)
  const n = recent.length
  const params = getWHSParams(n)
  if (!params) return null

  // Find the lowest `count` scores
  const sorted = [...recent].sort((a, b) => a.score - b.score)
  const selected = sorted.slice(0, params.count)

  const avg = selected.reduce((s, e) => s + e.score, 0) / selected.length
  const hcp = Math.round((avg + params.adj - COURSE_PAR) * 10) / 10

  // Sort selected by date for display
  const selectedByDate = [...selected].sort((a, b) => a.date.localeCompare(b.date))

  return { hcp, selected: selectedByDate, roundsUsed: n }
}

function fmtDate(dateStr) {
  // dateStr: "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function HcpTab({ rounds }) {
  const [expandedPlayer, setExpandedPlayer] = useState(null)

  // Collect per-player round entries in chronological order
  const playerEntriesMap = {}
  const chronological = [...rounds].sort((a, b) => a.date.localeCompare(b.date))

  for (const round of chronological) {
    for (const player of round.players) {
      const score = player.adjustedStrokes ?? player.strokes
      if (score == null) continue
      if (!playerEntriesMap[player.name]) playerEntriesMap[player.name] = []
      playerEntriesMap[player.name].push({ score, course: round.course, date: round.date })
    }
  }

  const results = Object.entries(playerEntriesMap).map(([name, entries]) => {
    const details = computeHcpDetails(entries)
    return { name, details, totalRounds: entries.length }
  })

  const ranked = results
    .filter(r => r.details !== null)
    .sort((a, b) => a.details.hcp - b.details.hcp)

  const insufficient = results
    .filter(r => r.details === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'sk'))

  if (ranked.length === 0 && insufficient.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⛳</div>
        <h2>Žiadne kolá ešte neodohraté</h2>
        <p>Pridajte prvé kolo pre výpočet HCP.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <div className="section-header">
          <h2 className="section-title">Rebríček HCP</h2>
          <span className="section-meta">Metóda WHS · netto − {COURSE_PAR}</span>
        </div>
        <div className="table-wrapper">
          <table className="ranking-table hcp-table">
            <thead>
              <tr>
                <th className="th-rank">#</th>
                <th>Hráč</th>
                <th title="Počet kôl zahrnutých do výpočtu (max 20)">Kolá</th>
                <th title="HCP Index = priemer najlepších kôl + korekcia WHS − par 72">HCP Index</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((player, idx) => {
                const { hcp, selected, roundsUsed } = player.details
                const isExpanded = expandedPlayer === player.name
                return (
                  <>
                    <tr
                      key={player.name}
                      className={`hcp-player-row${idx < 3 ? ` top-${idx + 1}` : ''}${isExpanded ? ' hcp-row-expanded' : ''}`}
                      onClick={() => setExpandedPlayer(isExpanded ? null : player.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="td-rank">
                        {MEDALS[idx] ?? <span className="rank-bubble">{idx + 1}</span>}
                      </td>
                      <td className="td-name">
                        <span>{player.name}</span>
                        <span className="rounds-played">{player.totalRounds}K</span>
                        <span className="hcp-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                      </td>
                      <td className="td-hcp-rounds">{roundsUsed}</td>
                      <td className="td-hcp-value">{hcp.toFixed(1)}</td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${player.name}-detail`} className="hcp-detail-row">
                        <td colSpan={4}>
                          <div className="hcp-detail-box">
                            <div className="hcp-detail-title">
                              Použité kolá ({selected.length} najlepších z posledných {roundsUsed})
                            </div>
                            <div className="hcp-detail-rounds">
                              {selected.map((e, i) => (
                                <div key={i} className="hcp-detail-round">
                                  <span className="hcp-detail-score">{e.score}</span>
                                  <span className="hcp-detail-sep">−</span>
                                  <span className="hcp-detail-par">{COURSE_PAR}</span>
                                  <span className="hcp-detail-diff">
                                    = {e.score - COURSE_PAR > 0 ? '+' : ''}{e.score - COURSE_PAR}
                                  </span>
                                  <span className="hcp-detail-course">{e.course}</span>
                                  <span className="hcp-detail-date">{fmtDate(e.date)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="hcp-detail-formula">
                              Priemer diferenciálov:{' '}
                              <strong>
                                {(selected.reduce((s, e) => s + (e.score - COURSE_PAR), 0) / selected.length).toFixed(1)}
                              </strong>
                              {' '}→ HCP Index: <strong>{hcp.toFixed(1)}</strong>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {insufficient.length > 0 && (
        <div className="card card-muted">
          <h3 className="section-title-sm">Nedostatok kôl (menej ako 3)</h3>
          <div className="tag-list">
            {insufficient.map(p => (
              <span key={p.name} className="player-tag">
                {p.name}
                <span className="hcp-insuf-count"> ({p.totalRounds} {p.totalRounds === 1 ? 'kolo' : 'kolá'})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="legend">
        <span>HCP = WHS metóda · posledných 20 kôl · diferenciál = netto − par {COURSE_PAR}</span>
        <span className="legend-sep">·</span>
        <span>Nižší HCP = lepší hráč</span>
      </div>

      <HcpRules />
    </div>
  )
}

function HcpRules() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rules-card">
      <button className="rules-toggle" onClick={() => setOpen(o => !o)}>
        <span>📋 Ako sa počíta HCP</span>
        <span className={`rules-chevron${open ? ' rules-chevron-open' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="rules-body">
          <p>HCP sa počíta podľa oficiálneho svetového handicapového systému (WHS) z netto výsledkov (upravených podľa náročnosti ihriska). Výsledné číslo je priemer najlepších výsledkov mínus 72 (par ihriska), zaokrúhlené na jedno desatinné miesto.</p>
          <h3 className="rules-heading">Podľa počtu odohraných kôl sa berie:</h3>
          <ul className="hcp-rules-list">
            <li>3 kolá — najlepší 1 výsledok, mínus 2.0</li>
            <li>4 kolá — najlepší 1 výsledok, mínus 1.0</li>
            <li>5 kôl — najlepší 1 výsledok</li>
            <li>6 kôl — priemer 2 najlepších, mínus 1.0</li>
            <li>7–8 kôl — priemer 2 najlepších</li>
            <li>9–11 kôl — priemer 3 najlepších</li>
            <li>12–14 kôl — priemer 4 najlepších</li>
            <li>15–16 kôl — priemer 5 najlepších</li>
            <li>17–18 kôl — priemer 6 najlepších</li>
            <li>19 kôl — priemer 7 najlepších</li>
            <li>20 kôl — priemer 8 najlepších</li>
          </ul>
          <p>Vždy sa berie posledných 20 kôl. Hráči s menej ako 3 kolami zatiaľ nemajú HCP.</p>
        </div>
      )}
    </div>
  )
}
