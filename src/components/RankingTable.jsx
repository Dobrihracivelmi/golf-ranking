import { useState } from 'react'
import { calculateRankings, fmtScore } from '../utils/ranking'
import { TEE_LABELS } from '../utils/courses'
import PlayerModal from './PlayerModal'

const MEDALS = ['🥇', '🥈', '🥉']

function buildAwardMap(captainAwards) {
  const map = {}
  for (const a of captainAwards) {
    if (!map[a.playerName]) map[a.playerName] = []
    map[a.playerName].push(a)
  }
  return map
}

function RoundCell({ r }) {
  const teeLabel = r.tee ? TEE_LABELS[r.tee] : null

  if (r.is9holes) {
    // For 9-hole rounds: show adjustedStrokes (= raw×2 + courseAdj) as main number
    return (
      <div className="round-pill">
        <span className="rp-strokes">{r.adjustedStrokes}</span>
        <span className="rp-9j">9j</span>
        <span className="rp-course">
          {r.course}
          {teeLabel && <span className="rp-tee"> · {teeLabel.toLowerCase()}</span>}
        </span>
      </div>
    )
  }

  const hasAdj = r.adjustedStrokes !== undefined && r.adjustedStrokes !== r.strokes
  return (
    <div className="round-pill">
      <span className="rp-strokes">{r.strokes}</span>
      {hasAdj && (
        <span className="rp-adjusted">({r.adjustedStrokes})</span>
      )}
      <span className="rp-course">
        {r.course}
        {teeLabel && <span className="rp-tee"> · {teeLabel.toLowerCase()}</span>}
      </span>
    </div>
  )
}

function Rules() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rules-card">
      <button className="rules-toggle" onClick={() => setOpen(o => !o)}>
        <span>📋 Pravidlá rebríčka</span>
        <span className={`rules-chevron${open ? ' rules-chevron-open' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="rules-body">
          <h3 className="rules-heading">Ako sa počíta celkové skóre</h3>
          <p>Čím nižšie skóre, tým lepšie — ako v golfe.</p>
          <p className="rules-formula">Finálne skóre = Rany − H2H body − Kapitánske body − LD/NP body − Body za výzvy</p>

          <h3 className="rules-heading">🏌️ Rany (základ)</h3>
          <p>Vždy sa berú posledné 3 kolá. Ak si odohral len 1 kolo, násobí sa ×3. Ak 2 kolá, vypočíta sa priemer ×3. Od 3 kôl vyššie sa berie súčet posledných troch. Skóre sa upravuje podľa náročnosti ihriska a odpaliska — v tabuľke vidíš surové rany aj upravené v zátvorkách.</p>
          <h4 className="rules-subheading">Odpalisko</h4>
          <p>Pri zadávaní výsledku sa vyberá odpalisko — biele, žlté alebo čierne. Každá kombinácia ihriska a odpaliska má vlastnú úpravu náročnosti voči referenčnému ihrisku Hainburg.</p>
          <h4 className="rules-subheading">9 jamiek</h4>
          <p>Ak sa hralo len 9 jamiek, skóre sa automaticky násobí ×2. V tabuľke je označené <span className="rules-badge-9j">9j</span>.</p>

          <h3 className="rules-heading">⚔️ H2H body</h3>
          <p>Počítajú sa kumulatívne zo všetkých kôl. Ak porazíš hráča ktorý bol pred týmto kolom vyššie v tabuľke, získaš toľko bodov koľko je rozdiel vašich pozícií — a on o toľko príde. Ak vyšší porazí nižšieho, žiadne H2H body sa nepočítajú. H2H sa počíta podľa poradia PRED odohraním kola.</p>

          <h3 className="rules-heading">🏌️ Longest Drive & 📍 Nearest to the Pin</h3>
          <p>Pri každom kole môže byť ocenený jeden hráč za najdlhší drive a jeden za najbližší úder k jamke. Pri 5 a viac hráčoch môžu byť ocenení dvaja za každú kategóriu. Každé ocenenie = 1 bod. Počítajú sa len z posledných 3 kôl.</p>

          <h3 className="rules-heading">👑 Kapitánske body</h3>
          <p>Kapitán Bekis môže udeľovať bonusové body za rôzne situácie. Do výsledného skóre sa počítajú len body, ktorých dátum spadá do rozsahu dátumov posledných 3 kôl hráča (od najstaršieho po najnovšie). V profile hráča sa zobrazuje celkový súčet všetkých kapitánskych bodov.</p>
          <p className="rules-cats">
            <strong>Kategórie:</strong>{' '}
            🎩 Štýl kola (+2), 🚀 Najväčšie zlepšenie (+3), 😤 Výhovorka kola (-1), 💩 Najhorší moment (-2), 🐢 Pomalá hra (-1), 🎯 Výnimočný úder (+2), 💦 Výstrek (-2), 🏌️ Longest Drive (+1), 📍 Nearest to the Pin (+1)
          </p>

          <h3 className="rules-heading">⚔️ Výzvy</h3>
          <p>Hráč môže vyzvať až 3 súperov naraz na priamy súboj. Výzva má platnosť 14 dní. Ak vyzvaný hráč výzvu nesplní a tá expiruje, dostane -2 body do celkového skóre. Výzvy zadáva len kapitán Bekis.</p>
        </div>
      )}
    </div>
  )
}

export default function RankingTable({ rounds, captainAwards = [], h2hAdjustments = {}, challenges = [] }) {
  const { ranked, unranked } = calculateRankings(rounds, captainAwards, h2hAdjustments, challenges)
  const awardMap = buildAwardMap(captainAwards)

  const rankMap = {}
  ranked.forEach((p, i) => { rankMap[p.name] = i + 1 })

  const [modalData, setModalData] = useState(null) // { player, rank }

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
                <th title="Normalizovaný 3-kolový súčet (upravené rany)">Rany</th>
                <th title="Súčet úprav za posledné 3 kolá">Úprava</th>
                <th title="H2H bonus za upset">H2H</th>
                <th title="Longest Drive + Nearest to Pin body">🏌️📍</th>
                <th title="Body za výzvy (penalizácia za expiráciu)">⚔️ Výzvy</th>
                <th title="Kapitánske body">👑 Kapitán</th>
                <th title="Výsledok = Rany − H2H − Kapitán">Výsledok</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((player, idx) => (
                <tr key={player.name} className={idx < 3 ? `top-${idx + 1}` : ''}>
                  <td className="td-rank">
                    {MEDALS[idx] ?? <span className="rank-bubble">{idx + 1}</span>}
                  </td>

                  <td className="td-name">
                    <button
                      className="player-name-btn"
                      onClick={() => setModalData({ player, rank: idx + 1 })}
                      title={`Zobraziť profil: ${player.name}`}
                    >
                      {player.name}
                    </button>
                    {player.captainPoints !== 0 && (
                      <span
                        className="captain-badge"
                        title={`Kapitánske body: ${player.captainPoints > 0 ? '+' : ''}${player.captainPoints}`}
                      >👑</span>
                    )}
                    <span className="rounds-played">{player.totalRounds}K</span>
                  </td>

                  {[0, 1, 2].map(i => (
                    <td key={i} className="td-round">
                      {player.lastRounds[i]
                        ? <RoundCell r={player.lastRounds[i]} />
                        : <span className="no-data">—</span>}
                    </td>
                  ))}

                  <td className="td-stroke">{fmtScore(player.strokeScore)}</td>

                  <td className={`td-adj ${player.totalAdjustment < 0 ? 'pos' : player.totalAdjustment > 0 ? 'neg' : ''}`}>
                    {player.totalAdjustment === 0
                      ? '—'
                      : player.totalAdjustment > 0
                        ? `+${player.totalAdjustment}`
                        : player.totalAdjustment}
                  </td>

                  <td className={`td-h2h ${player.h2hPoints > 0 ? 'pos' : player.h2hPoints < 0 ? 'neg' : ''}`}>
                    {player.h2hPoints > 0 ? `+${player.h2hPoints}` : player.h2hPoints || '0'}
                  </td>

                  <td className="td-ldnp">
                    {player.ldnpPoints > 0 ? (
                      <>
                        <span className="ldnp-total">+{player.ldnpPoints}</span>
                        <div className="ldnp-breakdown">
                          {player.ldPoints > 0 && <span>🏌️×{player.ldPoints}</span>}
                          {player.npPoints > 0 && <span>📍×{player.npPoints}</span>}
                        </div>
                      </>
                    ) : (
                      <span className="no-data">—</span>
                    )}
                  </td>

                  <td className={`td-challenge ${player.challengePoints < 0 ? 'neg' : ''}`}>
                    {player.challengePoints < 0
                      ? player.challengePoints
                      : <span className="no-data">—</span>}
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
        <span>Rany = súčet upravených skóre za posledné 3 kolá</span>
        <span className="legend-sep">·</span>
        <span>Úprava = súčet korekcií ihrísk (záporné = ľahšie)</span>
        <span className="legend-sep">·</span>
        <span>H2H = bonus za upset</span>
        <span className="legend-sep">·</span>
        <span>🏌️📍 = Longest Drive + Nearest to Pin (+1 každý)</span>
        <span className="legend-sep">·</span>
        <span>⚔️ = penalizácia za expirované výzvy (−2 za každú)</span>
        <span className="legend-sep">·</span>
        <span>Výsledok = Rany − H2H − 🏌️📍 − Výzvy − Kapitán (nižšie je lepšie)</span>
      </div>

      <Rules />

      {/* ── Player profile modal ── */}
      {modalData && (
        <PlayerModal
          playerName={modalData.player.name}
          rank={modalData.rank}
          player={modalData.player}
          allRounds={rounds}
          captainAwards={captainAwards}
          rankMap={rankMap}
          onClose={() => setModalData(null)}
          challenges={challenges}
        />
      )}
    </div>
  )
}
