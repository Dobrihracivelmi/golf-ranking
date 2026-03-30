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
  // Build per-player list of rounds, sorted newest first
  const playerRoundsMap = {}
  for (const round of rounds) {
    for (const p of round.players) {
      if (!playerRoundsMap[p.name]) playerRoundsMap[p.name] = []
      playerRoundsMap[p.name].push({
        id: round.id,
        date: round.date,
        course: round.course,
        strokes: p.strokes,
      })
    }
  }
  for (const name in playerRoundsMap) {
    playerRoundsMap[name].sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  // Stroke score: last 3 rounds normalised to 3-round equivalent
  const strokeScores = {}
  for (const name in playerRoundsMap) {
    const last3 = playerRoundsMap[name].slice(0, 3)
    if (last3.length === 1) {
      strokeScores[name] = last3[0].strokes * 3
    } else if (last3.length === 2) {
      strokeScores[name] = ((last3[0].strokes + last3[1].strokes) / 2) * 3
    } else {
      strokeScores[name] = last3[0].strokes + last3[1].strokes + last3[2].strokes
    }
  }

  // Rank by stroke score to determine H2H upsets (lower score = better = rank 1)
  const sortedByStroke = Object.keys(strokeScores).sort(
    (a, b) => strokeScores[a] - strokeScores[b]
  )
  const rankMap = {}
  sortedByStroke.forEach((name, i) => { rankMap[name] = i + 1 })

  // H2H: for each round, compare every pair who played together.
  // Upset = worse-ranked player (higher rank number) beats better-ranked player.
  const h2hPoints = {}
  for (const name in playerRoundsMap) h2hPoints[name] = 0

  for (const round of rounds) {
    const rp = round.players.filter(p => rankMap[p.name] != null)
    for (let i = 0; i < rp.length; i++) {
      for (let j = i + 1; j < rp.length; j++) {
        const a = rp[i], b = rp[j]
        if (a.strokes === b.strokes) continue

        const [winner, loser] = a.strokes < b.strokes ? [a, b] : [b, a]
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

  // Captain points: sum of all awards per player
  const captainPointsMap = {}
  for (const name in playerRoundsMap) captainPointsMap[name] = 0
  for (const award of captainAwards) {
    if (captainPointsMap[award.playerName] != null) {
      captainPointsMap[award.playerName] += award.points
    }
  }

  // Final Score = Stroke − H2H − Captain (lower is better)
  const ranked = Object.keys(strokeScores).map(name => ({
    name,
    strokeScore:   strokeScores[name],
    h2hPoints:     h2hPoints[name] || 0,
    captainPoints: captainPointsMap[name] || 0,
    finalScore:    strokeScores[name] - (h2hPoints[name] || 0) - (captainPointsMap[name] || 0),
    lastRounds:    playerRoundsMap[name].slice(0, 3),
    totalRounds:   playerRoundsMap[name].length,
  }))

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
