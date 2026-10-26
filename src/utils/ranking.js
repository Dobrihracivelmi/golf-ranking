export const ALL_PLAYERS = [
  'Miro M', 'Miky', 'Domčo', 'Poli', 'Andros', 'Maso', 'Bekis', 'Dobrák',
  'Pešóóó', 'Denys', 'FF', 'Zelíí', 'Kurto', 'Bitkár', 'Ondro', 'Molči',
  'Havajko', 'Kubo M', 'Gašpi', 'Viťo',
]

export const DEFAULT_CAPTAIN_CATEGORIES = [
  { id: 'def-1', name: 'Štýl kola',          emoji: '🎩', points:  2 },
  { id: 'def-2', name: 'Najväčšie zlepšenie', emoji: '🚀', points:  3 },
  { id: 'def-3', name: 'Výhovorka kola',      emoji: '😤', points: -1 },
  { id: 'def-4', name: 'Najhorší moment',     emoji: '💩', points: -2 },
  { id: 'def-5', name: 'Pomalá hra',          emoji: '🐢', points: -1 },
  { id: 'def-6', name: 'Výnimočný úder',      emoji: '🎯', points:  2 },
  { id: 'def-7', name: 'Výstrek',             emoji: '💦', points: -2 },
  { id: 'def-8', name: 'Longest Drive',       emoji: '🏌️', points:  1 },
  { id: 'def-9', name: 'Nearest to the Pin',  emoji: '📍', points:  1 },
]

// Stroke-only rank map (used by History component)
export function strokeRankMap(rnds) {
  const scores = {}
  for (const r of rnds) {
    for (const p of r.players) {
      if (!scores[p.name]) scores[p.name] = []
      scores[p.name].push({ date: r.date, adj: p.adjustedStrokes ?? p.strokes })
    }
  }
  for (const n in scores) scores[n].sort((a, b) => new Date(b.date) - new Date(a.date))
  const totals = {}
  for (const n in scores) {
    const s = scores[n].slice(0, 3).map(r => r.adj)
    totals[n] = s.length === 1 ? s[0] * 3
              : s.length === 2 ? ((s[0] + s[1]) / 2) * 3
              : s[0] + s[1] + s[2]
  }
  const sorted = Object.keys(totals).sort((a, b) => totals[a] - totals[b])
  const rm = {}
  sorted.forEach((n, i) => { rm[n] = i + 1 })
  return rm
}

// Apply H2H rule to a single pair of players.
// Winner = fewer adjusted strokes. If winner was worse-ranked (higher rank number),
// winner gains (winnerRank − loserRank) and loser loses the same. Otherwise: 0.
function h2hPair(winner, loser, preRankMap, out) {
  const winnerRank = preRankMap[winner.name]
  const loserRank  = preRankMap[loser.name]
  if (winnerRank > loserRank) {
    const pts = winnerRank - loserRank
    out[winner.name] = (out[winner.name] || 0) + pts
    out[loser.name]  = (out[loser.name]  || 0) - pts
  }
}

// Compute H2H delta for a single new round.
// Pre-round ranks come from calculateRankings with all the same inputs as
// the live VÝSLEDOK column, so the rank used is always what the player sees.
// Returns { delta, preRankMap }.
export function computeH2HDeltaForNewRound(
  existingRounds, newRound, currentH2H, captainAwards = [],
  h2hAdjustments = {}, challenges = [], challengePointsStored = {}
) {
  const { ranked } = calculateRankings(
    existingRounds, captainAwards, h2hAdjustments, challenges, currentH2H, challengePointsStored
  )
  const preRankMap = {}
  ranked.forEach((p, i) => { preRankMap[p.name] = i + 1 })

  const delta = {}
  const participants = newRound.players.filter(p => preRankMap[p.name] != null)

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const a = participants[i]
      const b = participants[j]
      const aStrokes = a.adjustedStrokes ?? a.strokes
      const bStrokes = b.adjustedStrokes ?? b.strokes
      if (aStrokes === bStrokes) continue // tie → no points
      const [winner, loser] = aStrokes < bStrokes ? [a, b] : [b, a]
      h2hPair(winner, loser, preRankMap, delta)
    }
  }

  return { delta, preRankMap }
}

// Compute cumulative H2H points from scratch across all rounds in order.
// Used only by the migration script — not called at runtime when h2hPointsStored is populated.
export function computeAllH2HPoints(rounds, captainAwards = [], h2hAdjustments = {}, challenges = []) {
  const roundsChron = [...rounds].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.id || '').localeCompare(b.id || '')
  })

  const cumulative = {}
  for (const round of rounds) {
    for (const p of round.players) {
      if (cumulative[p.name] == null) cumulative[p.name] = 0
    }
  }

  for (let ri = 0; ri < roundsChron.length; ri++) {
    const round = roundsChron[ri]
    // Pass a snapshot of cumulative so calculateRankings uses the stored-H2H path
    const { ranked } = calculateRankings(
      roundsChron.slice(0, ri), captainAwards, h2hAdjustments, challenges, { ...cumulative }
    )
    const preRankMap = {}
    ranked.forEach((p, i) => { preRankMap[p.name] = i + 1 })

    const participants = round.players.filter(p => preRankMap[p.name] != null)
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const a = participants[i]
        const b = participants[j]
        const aStrokes = a.adjustedStrokes ?? a.strokes
        const bStrokes = b.adjustedStrokes ?? b.strokes
        if (aStrokes === bStrokes) continue
        const [winner, loser] = aStrokes < bStrokes ? [a, b] : [b, a]
        h2hPair(winner, loser, preRankMap, cumulative)
      }
    }
  }

  return cumulative
}

export function calculateRankings(rounds, captainAwards = [], h2hAdjustments = {}, challenges = [], h2hPointsStored = null, challengePointsStored = {}) {
  // Build per-player list of rounds with adjusted strokes, sorted newest first
  const playerRoundsMap = {}
  for (const round of rounds) {
    for (const p of round.players) {
      if (!playerRoundsMap[p.name]) playerRoundsMap[p.name] = []
      playerRoundsMap[p.name].push({
        id:              round.id,
        date:            round.date,
        course:          round.course,
        tee:             round.tee             ?? null,
        adjustment:      round.courseAdjustment ?? 0,
        is9holes:        p.is9holes ?? round.is9holes ?? false,
        strokes:         p.strokes,
        // Fall back to raw strokes for rounds recorded before course adjustments
        adjustedStrokes: p.adjustedStrokes      ?? p.strokes,
      })
    }
  }
  for (const name in playerRoundsMap) {
    playerRoundsMap[name].sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  // Stroke score uses adjusted strokes, normalised to 3-round equivalent
  const strokeScores = {}
  for (const name in playerRoundsMap) {
    const last3 = playerRoundsMap[name].slice(0, 3)
    const s = last3.map(r => r.adjustedStrokes)
    if (s.length === 1) {
      strokeScores[name] = s[0] * 3
    } else if (s.length === 2) {
      strokeScores[name] = ((s[0] + s[1]) / 2) * 3
    } else {
      strokeScores[name] = s[0] + s[1] + s[2]
    }
  }

  // H2H: use stored values if populated, otherwise compute from scratch (fallback)
  let h2hPoints
  if (h2hPointsStored && Object.keys(h2hPointsStored).length > 0) {
    h2hPoints = {}
    for (const name in playerRoundsMap) {
      h2hPoints[name] = h2hPointsStored[name] || 0
    }
  } else {
    h2hPoints = computeAllH2HPoints(rounds, captainAwards)
  }

  // Apply manual H2H adjustments
  for (const name in h2hAdjustments) {
    if (h2hPoints[name] != null) h2hPoints[name] += h2hAdjustments[name]
  }

  // Captain points — last-3-rounds window (used in ranking score)
  const captainPointsMap = {}
  // Captain points — all-time total (used in player profile stats)
  const captainPointsAllMap = {}
  for (const name in playerRoundsMap) { captainPointsMap[name] = 0; captainPointsAllMap[name] = 0 }

  // Date range from each player's last 3 rounds (oldest date to newest date)
  const last3DateRange = {}
  for (const name in playerRoundsMap) {
    const dates = playerRoundsMap[name].slice(0, 3).map(r => r.date)
    if (dates.length > 0) {
      const sorted = [...dates].sort()
      last3DateRange[name] = { from: sorted[0] }
    }
  }
  for (const award of captainAwards) {
    if (captainPointsAllMap[award.playerName] != null) {
      captainPointsAllMap[award.playerName] += award.points
    }
    const range = last3DateRange[award.playerName]
    if (captainPointsMap[award.playerName] != null && award.date && range && award.date >= range.from) {
      captainPointsMap[award.playerName] += award.points
    }
  }

  // LD/NP points — only from the same last-3 rounds used for stroke score
  const ldPointsMap = {}
  const npPointsMap = {}
  for (const name in playerRoundsMap) { ldPointsMap[name] = 0; npPointsMap[name] = 0 }

  const last3IdsMap = {}
  for (const name in playerRoundsMap) {
    last3IdsMap[name] = new Set(playerRoundsMap[name].slice(0, 3).map(r => r.id))
  }
  for (const round of rounds) {
    // Normalize to arrays (backward compat: old rounds store a single string)
    const ldNames = Array.isArray(round.longestDrive) ? round.longestDrive
                  : round.longestDrive ? [round.longestDrive] : []
    const npNames = Array.isArray(round.nearestPin) ? round.nearestPin
                  : round.nearestPin ? [round.nearestPin] : []
    for (const name of ldNames) {
      if (ldPointsMap[name] != null && last3IdsMap[name]?.has(round.id)) ldPointsMap[name]++
    }
    for (const name of npNames) {
      if (npPointsMap[name] != null && last3IdsMap[name]?.has(round.id)) npPointsMap[name]++
    }
  }

  // Challenge bonus points — two sources:
  // 1) Completed (fulfilled/failed) challenges with stored rank data
  //    Higher-ranked wins: +1 winner, -1 loser
  //    Lower-ranked wins:  +2 winner, -2 loser
  // 2) Expired challenges resolved manually by captain (expiredResolution)
  //    Stores explicit plusPlayer (+1) and minusPlayer (-1)
  const challengePointsMap = {}
  for (const name in playerRoundsMap) challengePointsMap[name] = 0
  for (const ch of challenges) {
    // Source 1: completed challenges
    if (ch.resolvedDate && (ch.status === 'fulfilled' || ch.status === 'failed')) {
      const crRank = ch.challengerRank
      for (let ci = 0; ci < ch.challenged.length; ci++) {
        const cName = ch.challenged[ci]
        const cdRank = ch.challengedRanks?.[ci]
        if (crRank == null || cdRank == null) continue
        if (challengePointsMap[ch.challenger] == null || challengePointsMap[cName] == null) continue
        if (ch.status === 'fulfilled') {
          const pts = crRank < cdRank ? 1 : 2
          challengePointsMap[ch.challenger] += pts
          challengePointsMap[cName] -= pts
        } else {
          const pts = cdRank < crRank ? 1 : 2
          challengePointsMap[cName] += pts
          challengePointsMap[ch.challenger] -= pts
        }
      }
    }
    // Source 2: expired challenges with manual captain resolution
    if (ch.expiredResolution) {
      const { plusPlayer, minusPlayer } = ch.expiredResolution
      if (plusPlayer && challengePointsMap[plusPlayer] != null) challengePointsMap[plusPlayer] += 1
      if (minusPlayer && challengePointsMap[minusPlayer] != null) challengePointsMap[minusPlayer] -= 1
    }
  }

  // Inactivity penalty: -3 for every 30 days since last round
  const inactivityMap = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const name in playerRoundsMap) {
    const lastDate = new Date(playerRoundsMap[name][0].date + 'T00:00:00')
    const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24))
    const periods = Math.floor(daysSince / 30)
    inactivityMap[name] = periods > 0 ? periods * -3 : 0
  }

  // Final Score = Stroke − H2H − Captain − LD/NP − Challenges + Inactivity (lower is better)
  const ranked = Object.keys(strokeScores).map(name => {
    const last3 = playerRoundsMap[name].slice(0, 3)
    const totalAdjustment = last3.reduce((sum, r) => sum + (r.adjustment ?? 0), 0)
    const ld = ldPointsMap[name] || 0
    const np = npPointsMap[name] || 0
    const chPts = (challengePointsMap[name] || 0) + (challengePointsStored?.[name] || 0)
    const inactivity = inactivityMap[name] || 0
    return {
      name,
      strokeScore:     strokeScores[name],
      totalAdjustment,
      h2hPoints:       h2hPoints[name]       || 0,
      captainPoints:   captainPointsMap[name] || 0,
      captainPointsAll: captainPointsAllMap[name] || 0,
      ldPoints:        ld,
      npPoints:        np,
      ldnpPoints:      ld + np,
      challengePoints: chPts,
      inactivityPoints: inactivity,
      finalScore:      strokeScores[name] - (h2hPoints[name] || 0) - (captainPointsMap[name] || 0) - ld - np - chPts - inactivity,
      lastRounds:      last3,
      totalRounds:     playerRoundsMap[name].length,
    }
  })

  ranked.sort((a, b) => {
    if (a.finalScore !== b.finalScore) return a.finalScore - b.finalScore
    return a.strokeScore - b.strokeScore
  })

  const playedNames = new Set(Object.keys(playerRoundsMap))
  const unranked = ALL_PLAYERS.filter(name => !playedNames.has(name))

  return { ranked, unranked }
}

export function fmtScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('sk-SK', {
    weekday: 'short',
    year:    'numeric',
    month:   'short',
    day:     'numeric',
  })
}
