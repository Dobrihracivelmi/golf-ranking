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

// Helper: compute stroke-based rank map from a set of rounds
export function strokeRankMap(rnds) {
  const pm = {}
  for (const r of rnds) {
    for (const p of r.players) {
      if (!pm[p.name]) pm[p.name] = []
      pm[p.name].push({ date: r.date, adj: p.adjustedStrokes ?? p.strokes })
    }
  }
  for (const n in pm) pm[n].sort((a, b) => new Date(b.date) - new Date(a.date))

  const sc = {}
  for (const n in pm) {
    const s = pm[n].slice(0, 3).map(r => r.adj)
    sc[n] = s.length === 1 ? s[0] * 3
          : s.length === 2 ? ((s[0] + s[1]) / 2) * 3
          : s[0] + s[1] + s[2]
  }
  const sorted = Object.keys(sc).sort((a, b) => sc[a] - sc[b])
  const rm = {}
  sorted.forEach((n, i) => { rm[n] = i + 1 })
  return rm
}

export function calculateRankings(rounds, captainAwards = [], h2hAdjustments = {}, challenges = []) {
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

  // Rank by stroke score (lower = better = rank 1)
  const sortedByStroke = Object.keys(strokeScores).sort(
    (a, b) => strokeScores[a] - strokeScores[b]
  )
  const rankMap = {}
  sortedByStroke.forEach((name, i) => { rankMap[name] = i + 1 })

  // H2H: use pre-round rankings so upset bonuses are based on standings
  // BEFORE the round was played, not after.
  const roundsChron = [...rounds].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.id || '').localeCompare(b.id || '')
  })

  const h2hPoints = {}
  for (const name in playerRoundsMap) h2hPoints[name] = 0

  for (let ri = 0; ri < roundsChron.length; ri++) {
    const round = roundsChron[ri]
    // Ranks based on all rounds played before this one
    const preRankMap = strokeRankMap(roundsChron.slice(0, ri))

    const rp = round.players.filter(p => preRankMap[p.name] != null)
    for (let i = 0; i < rp.length; i++) {
      for (let j = i + 1; j < rp.length; j++) {
        const a = rp[i], b = rp[j]
        const aAdj = a.adjustedStrokes ?? a.strokes
        const bAdj = b.adjustedStrokes ?? b.strokes
        if (aAdj === bAdj) continue

        const [winner, loser] = aAdj < bAdj ? [a, b] : [b, a]
        const winnerRank = preRankMap[winner.name]
        const loserRank  = preRankMap[loser.name]

        if (winnerRank > loserRank) {
          const diff = winnerRank - loserRank
          h2hPoints[winner.name] += diff
          h2hPoints[loser.name]  -= diff
        }
      }
    }
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

  // Challenge penalty points: -2 for each challenged player on expired challenges
  const challengePointsMap = {}
  for (const name in playerRoundsMap) challengePointsMap[name] = 0
  const today = new Date().toISOString().split('T')[0]
  for (const ch of challenges) {
    // Only penalise expired challenges (pending ones that passed their expiry)
    if (ch.status === 'fulfilled' || ch.status === 'failed') continue
    const expiry = ch.expiry || (() => {
      const d = new Date(ch.date + 'T00:00:00')
      d.setDate(d.getDate() + 14)
      return d.toISOString().split('T')[0]
    })()
    if (expiry >= today) continue // not expired yet
    // Each challenged player gets -2
    for (const name of ch.challenged) {
      if (challengePointsMap[name] != null) challengePointsMap[name] -= 2
    }
  }

  // Final Score = Stroke − H2H − Captain − LD/NP − Challenge (lower is better)
  const ranked = Object.keys(strokeScores).map(name => {
    const last3 = playerRoundsMap[name].slice(0, 3)
    const totalAdjustment = last3.reduce((sum, r) => sum + (r.adjustment ?? 0), 0)
    const ld = ldPointsMap[name] || 0
    const np = npPointsMap[name] || 0
    const chPts = challengePointsMap[name] || 0
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
      finalScore:      strokeScores[name] - (h2hPoints[name] || 0) - (captainPointsMap[name] || 0) - ld - np - chPts,
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
