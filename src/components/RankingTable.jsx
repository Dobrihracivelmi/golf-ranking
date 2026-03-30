import { calculateRankings, fmtScore } from '../utils/ranking'

const MEDALS = ['🥇', '🥈', '🥉']

function buildAwardMap(captainAwards) {
  const map = {}
  for (const a of captainAwards) {
    if (!map[a.playerName]) map[a.playerName] = []
    map[a.playerName].push(a)
  }
  return map
}

export default function RankingTable({ rounds, captainAwards = [] }) {
  const { ranked, unranked } = calculateRankings(rounds, captainAwards)
  const awardMap = buildAwardMap(captainAwards)

  if (ranked.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⛳</div>
        <h2>Žiadne kolá ešte neodohraté</h2>
        <p>Prejdite na <em>Pridať kolo</em> a zaznamenajte prvú hru!</p>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <div className="section-header">
          <h2 className="section-title">Sezónny rebríček</h2>
          <span className="section-meta">{ranked.length} hráčov v rebríčku</span>
        </div>
        <div className="table-wrapper">
          <table className="ranking-table">
            <thead>
              <tr>
                <th className="th-rank">#</th>
                <th>Hráč</th>
                <th>Kolo 1</th>
                <th>Kolo 2</th>
                <th>Kolo 3</th>
                <th title="Normalizovaný 3-kolový ekvivalent">Rany</th>
                <th title="H2H bonus za upset">H2H</th>
                <th title="Kapitánske body">👑 Kapitán</th>
                <th title="Výsledok = Rany − H2H − Kapitán">Výsledok</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((player, idx) => (
                <tr key={player.name} className={idx < 3 ? `top-${idx + 1}` : ''}>
                  <td className="td-rank">
                    {MEDALS[idx] ?? (
                      <span className="rank-bubble">{idx + 1}</span>
                    )}
                  </td>
                  <td className="td-name">
                    <span className="player-name">{player.name}</span>
                    {player.captainPoints !== 0 && (
                      <span
                        className="captain-badge"
                        title={`Kapitánske body: ${player.captainPoints > 0 ? '+' : ''}${player.captainPoints}`}
                      >
                        👑
                      </span>
                    )}
                    <span className="rounds-played">{player.totalRounds}K</span>
                  </td>
                  {[0, 1, 2].map(i => (
                    <td key={i} className="td-round">
                      {player.lastRounds[i] ? (
                        <div className="round-pill">
                          <span className="rp-strokes">{player.lastRounds[i].strokes}</span>
                          <span className="rp-course">{player.lastRounds[i].course}</span>
                        </div>
                      ) : (
                        <span className="no-data">—</span>
                      )}
                    </td>
                  ))}
                  <td className="td-stroke">{fmtScore(player.strokeScore)}</td>
                  <td className={`td-h2h ${player.h2hPoints > 0 ? 'pos' : player.h2hPoints < 0 ? 'neg' : ''}`}>
                    {player.h2hPoints > 0 ? `+${player.h2hPoints}` : player.h2hPoints || '0'}
                  </td>
                  <td className="td-captain">
                    {player.captainPoints === 0 && !awardMap[player.name] ? (
                      <span className="no-data">—</span>
                    ) : (
                      <>
                        <span className={`cap-total ${player.captainPoints > 0 ? 'pos' : player.captainPoints < 0 ? 'neg' : ''}`}>
                          {player.captainPoints > 0 ? `+${player.captainPoints}` : player.captainPoints}
                        </span>
                        {(awardMap[player.name] || []).map(a => (
                          <div key={a.id} className="cap-award-line">
                            <span className="cap-award-emoji">{a.categoryEmoji}</span>
                            <span className="cap-award-name">{a.categoryName}</span>
                            <span className={`cap-award-pts ${a.points > 0 ? 'pos' : 'neg'}`}>
                              {a.points > 0 ? `+${a.points}` : a.points}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </td>
                  <td className="td-final">{fmtScore(player.finalScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unranked.length > 0 && (
        <div className="card card-muted">
          <h3 className="section-title-sm">Čaká na prvé kolo</h3>
          <div className="tag-list">
            {unranked.map(name => (
              <span key={name} className="player-tag">{name}</span>
            ))}
          </div>
        </div>
      )}

      <div className="legend">
        <span>Rany = posledné 3 kolá normalizované na 3-kolový súčet</span>
        <span className="legend-sep">·</span>
        <span>H2H = bonus za upset (horší porazí lepšieho)</span>
        <span className="legend-sep">·</span>
        <span>👑 = kapitánske body</span>
        <span className="legend-sep">·</span>
        <span>Výsledok = Rany − H2H − Kapitán (nižšie je lepšie)</span>
      </div>
    </div>
  )
}
