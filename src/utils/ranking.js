export const ALL_PLAYERS = [
  'Miro M', 'Miky', 'Domčo', 'Poli', 'Andros', 'Maso', 'Bekis', 'Dobrák',
  'Pešóóó', 'Denys', 'FF', 'Zelíí', 'Kurto', 'Bitkár', 'Ondro', 'Molči',
  'Havajko', 'Kubo M', 'Gašpi',
]

export const DEFAULT_CAPTAIN_CATEGORIES = [
  { id: 'def-1', name: 'Štýl kola',          emoji: '🎩', points:  2 },
  { id: 'def-2', name: 'Najväčšie zlepšenie', emoji: '🚀', points:  3 },
  { id: 'def-3', name: 'Výhovorka kola',      emoji: '😤', points: -1 },
  { id: 'def-4', name: 'Najhorší moment',     emoji: '💩', points: -2 },
  { id: 'def-5', name: 'Pomalá hra',          emoji: '🐢', points: -1 },
  { id: 'def-6', name: 'Výnimočný úder',      emoji: '🎯', points:  2 },
  { id: 'def-7', name: 'Výstrek',             emoji: '💦', points: -2 },
]

export function calculateRankings(rounds, captainAwards = []) {
  // Build per-player list of rounds with adjusted strokes, sorted newest first
  const playerRoundsMap = {}
  for (const round of rounds) {
    for (const p of round.players) {
      if (!playerRoundsMap[p.name]) playerRoundsMap[p.name] = []
      playerRoundsMap[p.name].push({
        id:             round.id,
        date:           round.date,
        course:         round.course,
        tee:            round.tee            ?? null,
        adjustment:     round.courseAdjustment ?? 0,
        strokes:        p.strokes,
        // Fall back to raw strokes for rounds recorded before course adjustments
        adjustedStrokes: p.adjustedStrokes  ?? p.strokes,
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

  // H2H: compare adjusted strokes so course difficulty is accounted for
  const h2hPoints = {}
  for (const name in playerRoundsMap) h2hPoints[name] = 0

  for (const round of rounds) {
    const rp = round.players.filter(p => rankMap[p.name] != null)
    for (let i = 0; i < rp.length; i++) {
      for (let j = i + 1; j < rp.length; j++) {
        const a = rp[i], b = rp[j]
        const aAdj = a.adjustedStrokes ?? a.strokes
        const bAdj = b.adjustedStrokes ?? b.strokes
        if (aAdj === bAdj) continue

        const [winner, loser] = aAdj < bAdj ? [a, b] : [b, a]
        const winnerRank = rankMap[winner.name]
        const loserRank  = rankMap[loser.name]

        if (winnerRank > loserRank) {
          const diff = winnerRank - loserRank
          h2hPoints[winner.name] += diff
          h2hPoints[loser.name]  -= diff
        }
      }
    }
  }

  // Captain points
  const captainPointsMap = {}
  for (const name in playerRoundsMap) captainPointsMap[name] = 0
  for (const award of captainAwards) {
    if (captainPointsMap[award.playerName] != null) {
      captainPointsMap[award.playerName] += award.points
    }
  }

  // Final Score = Stroke − H2H − Captain (lower is better)
  const ranked = Object.keys(strokeScores).map(name => {
    const last3 = playerRoundsMap[name].slice(0, 3)
    const totalAdjustment = last3.reduce((sum, r) => sum + (r.adjustment ?? 0), 0)
    return {
      name,
      strokeScore:     strokeScores[name],
      totalAdjustment,
      h2hPoints:       h2hPoints[name]       || 0,
      captainPoints:   captainPointsMap[name] || 0,
      finalScore:      strokeScores[name] - (h2hPoints[name] || 0) - (captainPointsMap[name] || 0),
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
