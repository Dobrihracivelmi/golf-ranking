import { useState, useEffect, useMemo } from 'react'
import { calculateRankings, fmtDate, fmtScore } from '../utils/ranking'
import { TEE_LABELS } from '../utils/courses'
import { resolveStatus } from './ChallengesTab'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPlayerRounds(playerName, allRounds) {
  const result = []
  for (const round of allRounds) {
    const p = round.players.find(pl => pl.name === playerName)
    if (!p) continue
    result.push({
      id:              round.id,
      date:            round.date,
      course:          round.course,
      tee:             round.tee             ?? null,
      adjustment:      round.courseAdjustment ?? 0,
      is9holes:        p.is9holes ?? round.is9holes ?? false,
      wonLd:           Array.isArray(round.longestDrive) ? round.longestDrive.includes(playerName) : round.longestDrive === playerName,
      wonNp:           Array.isArray(round.nearestPin)  ? round.nearestPin.includes(playerName)  : round.nearestPin   === playerName,
      note:            round.note ?? null,
      aiComment:       round.aiComment ?? null,
      strokes:         p.strokes,
      adjustedStrokes: p.adjustedStrokes      ?? p.strokes,
      allPlayers:      round.players,
    })
  }
  return result.sort((a, b) => b.date.localeCompare(a.date))
}

function computeStats(playerRounds) {
  if (playerRounds.length === 0) return null
  const scores = playerRounds.map(r => r.adjustedStrokes)
  const best   = Math.min(...scores)
  const worst  = Math.max(...scores)
  const avg    = scores.reduce((s, n) => s + n, 0) / scores.length
  // Brutto stats from 18-hole rounds only
  const full18 = playerRounds.filter(r => !r.is9holes)
  const bestBrutto  = full18.length > 0 ? Math.min(...full18.map(r => r.strokes)) : null
  const worstBrutto = full18.length > 0 ? Math.max(...full18.map(r => r.strokes)) : null
  const avgBrutto   = full18.length > 0 ? full18.reduce((s, r) => s + r.strokes, 0) / full18.length : null
  return {
    total:      playerRounds.length,
    best,
    worst,
    avg,
    bestRound:       playerRounds.find(r => r.adjustedStrokes === best),
    worstRound:      playerRounds.find(r => r.adjustedStrokes === worst),
    bestBrutto,
    bestBruttoRound:  bestBrutto  != null ? full18.find(r => r.strokes === bestBrutto)  : null,
    worstBrutto,
    worstBruttoRound: worstBrutto != null ? full18.find(r => r.strokes === worstBrutto) : null,
    avgBrutto,
  }
}

function computeH2H(playerName, playerRounds, rankMap) {
  const myRank = rankMap[playerName]
  const encounters = []
  for (const round of playerRounds) {
    const myScore = round.adjustedStrokes
    for (const opp of round.allPlayers) {
      if (opp.name === playerName) continue
      const oppScore = opp.adjustedStrokes ?? opp.strokes
      const iWon    = myScore < oppScore
      const isDraw  = myScore === oppScore
      const result  = isDraw ? 'draw' : iWon ? 'win' : 'loss'

      const oppRank = rankMap[opp.name]
      let h2hDelta = 0
      if (!isDraw && myRank != null && oppRank != null) {
        if (iWon && myRank > oppRank) {
          h2hDelta = myRank - oppRank          // upset win — gain points
        } else if (!iWon && oppRank > myRank) {
          h2hDelta = -(oppRank - myRank)       // lost to underdog — lose points
        }
      }

      encounters.push({
        date: round.date, course: round.course, tee: round.tee,
        myScore, oppName: opp.name, oppScore, result, h2hDelta,
      })
    }
  }
  return encounters
}

function computeScoreHistory(playerName, allRounds, captainAwards) {
  const chronological = [...allRounds].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.id || '').localeCompare(b.id || '')
  })

  const history = []
  let playerStarted = false

  for (let i = 0; i < chronological.length; i++) {
    if (!playerStarted) {
      if (chronological[i].players.some(p => p.name === playerName)) {
        playerStarted = true
      } else {
        continue
      }
    }
    // Only record data points when the player plays
    if (!chronological[i].players.some(p => p.name === playerName)) continue

    const roundsUpToNow = chronological.slice(0, i + 1)
    const roundDate     = chronological[i].date
    const awardsUpToNow = captainAwards.filter(a => !a.date || a.date <= roundDate)

    const { ranked } = calculateRankings(roundsUpToNow, awardsUpToNow)
    const entry = ranked.find(p => p.name === playerName)

    if (entry) {
      const d = new Date(roundDate + 'T00:00:00')
      history.push({
        date:        roundDate,
        label:       `${d.getDate()}.${d.getMonth() + 1}.`,
        finalScore:  Math.round(entry.finalScore * 10) / 10,
        strokeScore: Math.round(entry.strokeScore * 10) / 10,
      })
    }
  }

  return history
}

// ── Component ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'rounds',  label: '⛳ Kolá' },
  { id: 'h2h',     label: '⚔️ H2H' },
  { id: 'captain', label: '👑 Kapitán' },
  { id: 'vyvoj',   label: '📈 Vývoj' },
  { id: 'stats',   label: '📊 Štatistiky' },
]

export default function PlayerModal({
  playerName, rank, player, allRounds, captainAwards, rankMap, onClose, challenges = [],
}) {
  const [activeTab, setActiveTab] = useState('rounds')
  const [chartView, setChartView] = useState('total') // 'total' | 'rounds'
  const [expandedComments, setExpandedComments] = useState({})

  const toggleComment = (id) => setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }))

  const playerRounds = buildPlayerRounds(playerName, allRounds)
  const stats        = computeStats(playerRounds)
  const h2h          = computeH2H(playerName, playerRounds, rankMap)
  const myAwards     = [...captainAwards.filter(a => a.playerName === playerName)]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))

  const scoreHistory = useMemo(
    () => computeScoreHistory(playerName, allRounds, captainAwards),
    [playerName, allRounds, captainAwards]
  )

  const bestHistorical = useMemo(() => {
    let best = null
    for (const pt of scoreHistory) {
      if (best === null || pt.finalScore < best.score) {
        best = { score: pt.finalScore, date: pt.date }
      }
    }
    return best
  }, [scoreHistory])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const h2hWins   = h2h.filter(e => e.result === 'win').length
  const h2hLosses = h2h.filter(e => e.result === 'loss').length
  const h2hDraws  = h2h.filter(e => e.result === 'draw').length

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pm-header">
          <div className="pm-header-main">
            <span className="pm-rank-badge">#{rank}</span>
            <h2 className="pm-player-name">{playerName}</h2>
            <span className="pm-final-score">{fmtScore(player.finalScore)}</span>
          </div>
          <div className="pm-chips">
            <span className="pm-chip">🏌️ {stats?.total ?? 0} kôl</span>
            <span className={`pm-chip${player.h2hPoints > 0 ? ' pos' : player.h2hPoints < 0 ? ' neg' : ''}`}>
              H2H: {player.h2hPoints > 0 ? `+${player.h2hPoints}` : player.h2hPoints || 0}
            </span>
            {player.ldnpPoints > 0 && (
              <span className="pm-chip pos">
                🏌️📍 +{player.ldnpPoints}
              </span>
            )}
            <span className={`pm-chip${player.captainPoints > 0 ? ' pos' : player.captainPoints < 0 ? ' neg' : ''}`}>
              👑 {player.captainPoints > 0 ? `+${player.captainPoints}` : player.captainPoints || 0}
            </span>
          </div>
          <button className="pm-close-btn" onClick={onClose} title="Zavrieť">✕</button>
        </div>

        {/* ── Tabs ── */}
        <div className="pm-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`pm-tab${activeTab === t.id ? ' pm-tab-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="pm-body">

          {/* ── Kolá ── */}
          {activeTab === 'rounds' && (() => {
            const myChallenges = challenges.filter(ch => {
              if (resolveStatus(ch) !== 'pending') return false
              return ch.challenger === playerName || ch.challenged.includes(playerName)
            })
            return (
            <div className="pm-rounds">
              {myChallenges.length > 0 && (
                <div className="pm-challenges-section">
                  <div className="pm-challenges-title">⚔️ Aktívne výzvy</div>
                  {myChallenges.map(ch => (
                    <div key={ch.id} className="pm-challenge-row">
                      <span className="ch-status-badge">🟡</span>
                      <div className="pm-challenge-info">
                        <span className="pm-challenge-names">
                          {ch.challenger === playerName
                            ? <>Vyzýva: <strong>{ch.challenged.join(', ')}</strong></>
                            : <>Vyzvaný od: <strong>{ch.challenger}</strong></>
                          }
                        </span>
                        <span className="pm-challenge-date">
                          {fmtDate(ch.date)} · exp. {fmtDate(ch.expiry)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {playerRounds.length === 0
                ? <p className="pm-empty">Žiadne kolá ešte neodohraté.</p>
                : playerRounds.map(r => (
                    <div key={r.id} className="pm-round-row">
                      <div className="pm-rr-top">
                        <div className="pm-rr-left">
                          <span className="pm-rr-date">{fmtDate(r.date)}</span>
                          <span className="pm-rr-course">
                            {r.course}
                            {r.tee && (
                              <span className="pm-rr-tee"> · {TEE_LABELS[r.tee]?.toLowerCase()}</span>
                            )}
                          </span>
                        </div>
                        <div className="pm-rr-right">
                          <span className="pm-rr-raw">{r.strokes}</span>
                          {r.adjustedStrokes !== r.strokes && (
                            <>
                              <span className="pm-rr-arrow">→</span>
                              <span className="pm-rr-adjval">{r.adjustedStrokes}</span>
                            </>
                          )}
                          {r.is9holes && <span className="pm-rr-9j">9j</span>}
                          {!r.is9holes && r.adjustment !== 0 && (
                            <span className={`pm-rr-delta ${r.adjustment < 0 ? 'pos' : 'neg'}`}>
                              ({r.adjustment > 0 ? `+${r.adjustment}` : r.adjustment})
                            </span>
                          )}
                          {r.wonLd && <span className="pm-rr-award" title="Longest Drive">🏌️</span>}
                          {r.wonNp && <span className="pm-rr-award" title="Nearest to the Pin">📍</span>}
                        </div>
                      </div>
                      {(r.note || r.aiComment) && (
                        expandedComments[r.id]
                          ? (
                            <>
                              {r.note && (
                                <div className="pm-rr-commentary">
                                  <span className="hc-note-icon">📝</span>
                                  <span className="hc-note-text">{r.note}</span>
                                </div>
                              )}
                              {r.aiComment && (
                                <div className="pm-rr-commentary">
                                  <span className="hc-commentary-icon">🎙️</span>
                                  <span className="hc-commentary-text">{r.aiComment}</span>
                                </div>
                              )}
                              <button className="pm-rr-toggle-comment" onClick={() => toggleComment(r.id)}>Skryť</button>
                            </>
                          )
                          : (
                            <button className="pm-rr-toggle-comment" onClick={() => toggleComment(r.id)}>
                              🎙️ Zobraziť komentár
                            </button>
                          )
                      )}
                    </div>
                  ))
              }
            </div>
            )
          })()}

          {/* ── H2H ── */}
          {activeTab === 'h2h' && (
            <div className="pm-h2h">
              {h2h.length === 0
                ? <p className="pm-empty">Žiadne H2H súboje.</p>
                : (
                  <>
                    <div className="pm-h2h-summary">
                      <span className="pos">{h2hWins}V</span>
                      <span className="pm-h2h-sum-sep">/</span>
                      <span className="neg">{h2hLosses}P</span>
                      {h2hDraws > 0 && (
                        <><span className="pm-h2h-sum-sep">/</span><span>{h2hDraws}R</span></>
                      )}
                    </div>
                    {h2h.map((enc, i) => (
                      <div key={i} className={`pm-h2h-row pm-h2h-${enc.result}`}>
                        <span className={`pm-h2h-badge pm-h2h-badge-${enc.result}`}>
                          {{ win: 'V', loss: 'P', draw: 'R' }[enc.result]}
                        </span>
                        <div className="pm-h2h-info">
                          <span className="pm-h2h-opp">{enc.oppName}</span>
                          <span className="pm-h2h-meta">
                            {enc.course}
                            {enc.tee ? ` · ${TEE_LABELS[enc.tee]?.toLowerCase()}` : ''}
                            {' · '}{fmtDate(enc.date)}
                          </span>
                        </div>
                        <div className="pm-h2h-scores">
                          <span className={enc.result === 'win' ? 'pos' : enc.result === 'loss' ? 'neg' : ''}>
                            {enc.myScore}
                          </span>
                          <span className="pm-h2h-sep">:</span>
                          <span className={enc.result === 'loss' ? 'pos' : enc.result === 'win' ? 'neg' : ''}>
                            {enc.oppScore}
                          </span>
                        </div>
                        {enc.h2hDelta !== 0 && (
                          <span className={`pm-h2h-pts ${enc.h2hDelta > 0 ? 'pos' : 'neg'}`}>
                            {enc.h2hDelta > 0 ? `+${enc.h2hDelta}` : enc.h2hDelta}
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                )
              }
            </div>
          )}

          {/* ── Kapitán ── */}
          {activeTab === 'captain' && (
            <div className="pm-captain">
              {myAwards.length === 0
                ? <p className="pm-empty">Žiadne kapitánske body.</p>
                : myAwards.map(a => (
                    <div key={a.id} className="pm-award-row">
                      <span className="pm-award-emoji">{a.categoryEmoji}</span>
                      <div className="pm-award-info">
                        <span className="pm-award-cat">{a.categoryName}</span>
                        {a.reason && <span className="pm-award-reason">„{a.reason}"</span>}
                        {a.date && <span className="pm-award-date">{fmtDate(a.date)}</span>}
                      </div>
                      <span className={`pm-award-pts ${a.points > 0 ? 'pos' : 'neg'}`}>
                        {a.points > 0 ? `+${a.points}` : a.points}
                      </span>
                    </div>
                  ))
              }
            </div>
          )}

          {/* ── Štatistiky ── */}
          {/* ── Vývoj ── */}
          {activeTab === 'vyvoj' && (() => {
            const roundChartData = [...playerRounds].filter(r => !r.is9holes).reverse().map(r => {
              const d = new Date(r.date + 'T00:00:00')
              return {
                date:     r.date,
                label:    `${d.getDate()}.${d.getMonth() + 1}.`,
                adjStrokes: r.strokes,
                course:   r.course,
              }
            })
            const hasTotal  = scoreHistory.length >= 2
            const hasRounds = roundChartData.length >= 2
            const tooltipStyle = { background: '#0d2b1a', border: '1px solid #245e3c', borderRadius: 8, fontSize: '0.82rem' }

            return (
              <div className="pm-chart">
                <div className="pm-chart-toggle">
                  <button
                    className={`pm-chart-btn${chartView === 'total' ? ' pm-chart-btn-active' : ''}`}
                    onClick={() => setChartView('total')}
                  >
                    Celkové skóre
                  </button>
                  <button
                    className={`pm-chart-btn${chartView === 'rounds' ? ' pm-chart-btn-active' : ''}`}
                    onClick={() => setChartView('rounds')}
                  >
                    Jednotlivé kolá brutto
                  </button>
                </div>

                {chartView === 'total' && (
                  !hasTotal
                    ? <p className="pm-empty">Nedostatok dát pre graf (min. 2 kolá).</p>
                    : (
                      <>
                        <p className="pm-chart-hint">Nižšie je lepšie</p>
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={scoreHistory} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8d4bc' }} />
                            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#a8d4bc' }} />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              labelStyle={{ color: '#a8d4bc' }}
                              formatter={(val, name) => [val, name]}
                              labelFormatter={(_, payload) => {
                                if (payload?.[0]?.payload?.date) return fmtDate(payload[0].payload.date)
                                return ''
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8 }} />
                            <Line type="monotone" dataKey="finalScore" name="Výsledok" stroke="#3ecf80" strokeWidth={2} dot={{ r: 4, fill: '#3ecf80' }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="strokeScore" name="Rany (3-kolový súčet)" stroke="#f0c040" strokeWidth={2} dot={{ r: 4, fill: '#f0c040' }} activeDot={{ r: 6 }} strokeDasharray="5 3" />
                          </LineChart>
                        </ResponsiveContainer>
                      </>
                    )
                )}

                {chartView === 'rounds' && (
                  !hasRounds
                    ? <p className="pm-empty">Nedostatok dát pre graf (min. 2 kolá).</p>
                    : (
                      <>
                        <p className="pm-chart-hint">Brutto rany za kolo · nižšie je lepšie</p>
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={roundChartData} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8d4bc' }} />
                            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#a8d4bc' }} />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              labelStyle={{ color: '#a8d4bc' }}
                              formatter={(val) => [val, 'Brutto rany']}
                              labelFormatter={(_, payload) => {
                                const pt = payload?.[0]?.payload
                                if (!pt) return ''
                                return `${pt.course} · ${fmtDate(pt.date)}`
                              }}
                            />
                            <Line type="monotone" dataKey="adjStrokes" name="Brutto rany" stroke="#3ecf80" strokeWidth={2} dot={{ r: 4, fill: '#3ecf80' }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </>
                    )
                )}
              </div>
            )
          })()}

          {/* ── Štatistiky ── */}
          {activeTab === 'stats' && (
            <div className="pm-stats">
              {!stats
                ? <p className="pm-empty">Žiadne štatistiky.</p>
                : (
                  <div className="pm-stat-grid">
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">Celkové kolá</span>
                      <span className="pm-stat-value">{stats.total}</span>
                    </div>
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">Historicky najlepšie kolo</span>
                      <span className="pm-stat-value pos">{stats.best}</span>
                      {stats.bestRound && (
                        <span className="pm-stat-sub">
                          {stats.bestRound.course} · {fmtDate(stats.bestRound.date)}
                        </span>
                      )}
                    </div>
                    {stats.bestBrutto != null && (
                      <div className="pm-stat-card">
                        <span className="pm-stat-label">Historicky najlepšie kolo brutto</span>
                        <span className="pm-stat-value pos">{stats.bestBrutto}</span>
                        {stats.bestBruttoRound && (
                          <span className="pm-stat-sub">
                            {stats.bestBruttoRound.course} · {fmtDate(stats.bestBruttoRound.date)}
                          </span>
                        )}
                      </div>
                    )}
                    {bestHistorical && (
                      <div className="pm-stat-card">
                        <span className="pm-stat-label">Historicky najlepšie skóre</span>
                        <span className="pm-stat-value pos">{fmtScore(bestHistorical.score)}</span>
                        {bestHistorical.date && (
                          <span className="pm-stat-sub">
                            {fmtDate(bestHistorical.date)}
                          </span>
                        )}
                      </div>
                    )}
                    {stats.worstBrutto != null && (
                      <div className="pm-stat-card">
                        <span className="pm-stat-label">Historicky najhoršie kolo brutto</span>
                        <span className="pm-stat-value neg">{stats.worstBrutto}</span>
                        {stats.worstBruttoRound && (
                          <span className="pm-stat-sub">
                            {stats.worstBruttoRound.course} · {fmtDate(stats.worstBruttoRound.date)}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">Priemer</span>
                      <span className="pm-stat-value">{stats.avg.toFixed(1)}</span>
                    </div>
                    {stats.avgBrutto != null && (
                      <div className="pm-stat-card">
                        <span className="pm-stat-label">Priemerné brutto (18j)</span>
                        <span className="pm-stat-value">{stats.avgBrutto.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">Výsledné skóre</span>
                      <span className="pm-stat-value">{fmtScore(player.finalScore)}</span>
                    </div>
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">H2H body</span>
                      <span className={`pm-stat-value ${player.h2hPoints > 0 ? 'pos' : player.h2hPoints < 0 ? 'neg' : ''}`}>
                        {player.h2hPoints > 0 ? `+${player.h2hPoints}` : player.h2hPoints || 0}
                      </span>
                    </div>
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">Kapitánske body (celkovo)</span>
                      <span className={`pm-stat-value ${player.captainPointsAll > 0 ? 'pos' : player.captainPointsAll < 0 ? 'neg' : ''}`}>
                        {player.captainPointsAll > 0 ? `+${player.captainPointsAll}` : player.captainPointsAll || 0}
                      </span>
                    </div>
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">H2H súboje</span>
                      <span className="pm-stat-value">{h2h.length}</span>
                      <span className="pm-stat-sub">
                        <span className="pos">{h2hWins}V</span>
                        {' / '}
                        <span className="neg">{h2hLosses}P</span>
                        {h2hDraws > 0 && <> / {h2hDraws}R</>}
                      </span>
                    </div>
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">🏌️ Longest Drive</span>
                      <span className={`pm-stat-value ${player.ldPoints > 0 ? 'pos' : ''}`}>
                        {player.ldPoints > 0 ? `+${player.ldPoints}` : player.ldPoints || 0}
                      </span>
                    </div>
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">📍 Nearest to Pin</span>
                      <span className={`pm-stat-value ${player.npPoints > 0 ? 'pos' : ''}`}>
                        {player.npPoints > 0 ? `+${player.npPoints}` : player.npPoints || 0}
                      </span>
                    </div>
                    <div className="pm-stat-card">
                      <span className="pm-stat-label">⚔️ Penalizácia výziev</span>
                      <span className={`pm-stat-value ${player.challengePoints < 0 ? 'neg' : ''}`}>
                        {player.challengePoints < 0 ? player.challengePoints : 0}
                      </span>
                    </div>
                  </div>
                )
              }
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
