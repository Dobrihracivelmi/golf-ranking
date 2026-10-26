/**
 * season-stats.mjs  —  read-only season statistics report
 * Run:  node scripts/season-stats.mjs
 *
 * Reads golf/appData from Firestore and prints season stats.
 * Does NOT write anything to Firestore.
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc } from 'firebase/firestore'

// ─── Firebase config ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAB7WNY2CApH4k3sUKGq99SpE5NxoiOsu4',
  authDomain:        'golf-ranking-63716.firebaseapp.com',
  projectId:         'golf-ranking-63716',
  storageBucket:     'golf-ranking-63716.firebasestorage.app',
  messagingSenderId: '549351533657',
  appId:             '1:549351533657:web:a0ca7d0cf9e8300c6f1548',
}

// ─── Ranking logic (faithfully ported from src/utils/ranking.js) ──────────────

function h2hPairDelta(winner, loser, preRankMap, out) {
  const winnerRank = preRankMap[winner.name]
  const loserRank  = preRankMap[loser.name]
  if (winnerRank > loserRank) {
    const pts = winnerRank - loserRank
    out[winner.name] = (out[winner.name] || 0) + pts
    out[loser.name]  = (out[loser.name]  || 0) - pts
  }
}

function computeAllH2HPoints(rounds) {
  const roundsChron = [...rounds].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : (a.id || '').localeCompare(b.id || '')
  )
  const cumulative = {}
  for (const round of rounds)
    for (const p of round.players)
      if (cumulative[p.name] == null) cumulative[p.name] = 0

  for (let ri = 0; ri < roundsChron.length; ri++) {
    const round = roundsChron[ri]
    const { ranked } = calculateRankings(roundsChron.slice(0, ri), [], {}, [], { ...cumulative }, {})
    const preRankMap = {}
    ranked.forEach((p, i) => { preRankMap[p.name] = i + 1 })
    const participants = round.players.filter(p => preRankMap[p.name] != null)
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const a = participants[i], b = participants[j]
        const aAdj = a.adjustedStrokes ?? a.strokes
        const bAdj = b.adjustedStrokes ?? b.strokes
        if (aAdj === bAdj) continue
        const [winner, loser] = aAdj < bAdj ? [a, b] : [b, a]
        h2hPairDelta(winner, loser, preRankMap, cumulative)
      }
    }
  }
  return cumulative
}

function calculateRankings(
  rounds, captainAwards = [], h2hAdjustments = {},
  challenges = [], h2hPointsStored = null, challengePointsStored = {}
) {
  const playerRoundsMap = {}
  for (const round of rounds) {
    for (const p of round.players) {
      if (!playerRoundsMap[p.name]) playerRoundsMap[p.name] = []
      playerRoundsMap[p.name].push({
        id:              round.id,
        date:            round.date,
        is9holes:        p.is9holes ?? round.is9holes ?? false,
        adjustedStrokes: p.adjustedStrokes ?? p.strokes,
        adjustment:      round.courseAdjustment ?? 0,
      })
    }
  }
  for (const name in playerRoundsMap)
    playerRoundsMap[name].sort((a, b) => new Date(b.date) - new Date(a.date))

  const strokeScores = {}
  for (const name in playerRoundsMap) {
    const s = playerRoundsMap[name].slice(0, 3).map(r => r.adjustedStrokes)
    strokeScores[name] = s.length === 1 ? s[0] * 3
                       : s.length === 2 ? ((s[0] + s[1]) / 2) * 3
                       : s[0] + s[1] + s[2]
  }

  let h2hPoints
  if (h2hPointsStored && Object.keys(h2hPointsStored).length > 0) {
    h2hPoints = {}
    for (const name in playerRoundsMap) h2hPoints[name] = h2hPointsStored[name] || 0
  } else {
    h2hPoints = computeAllH2HPoints(rounds)
  }
  for (const name in h2hAdjustments)
    if (h2hPoints[name] != null) h2hPoints[name] += h2hAdjustments[name]

  const captainPointsMap = {}, captainPointsAllMap = {}
  for (const name in playerRoundsMap) { captainPointsMap[name] = 0; captainPointsAllMap[name] = 0 }
  const last3DateRange = {}
  for (const name in playerRoundsMap) {
    const dates = playerRoundsMap[name].slice(0, 3).map(r => r.date)
    if (dates.length > 0) last3DateRange[name] = { from: [...dates].sort()[0] }
  }
  for (const award of captainAwards) {
    if (captainPointsAllMap[award.playerName] != null) captainPointsAllMap[award.playerName] += award.points
    const range = last3DateRange[award.playerName]
    if (captainPointsMap[award.playerName] != null && award.date && range && award.date >= range.from)
      captainPointsMap[award.playerName] += award.points
  }

  const ldPointsMap = {}, npPointsMap = {}
  for (const name in playerRoundsMap) { ldPointsMap[name] = 0; npPointsMap[name] = 0 }
  const last3IdsMap = {}
  for (const name in playerRoundsMap)
    last3IdsMap[name] = new Set(playerRoundsMap[name].slice(0, 3).map(r => r.id))
  for (const round of rounds) {
    const ldNames = Array.isArray(round.longestDrive) ? round.longestDrive : round.longestDrive ? [round.longestDrive] : []
    const npNames = Array.isArray(round.nearestPin)   ? round.nearestPin   : round.nearestPin   ? [round.nearestPin]   : []
    for (const name of ldNames) if (ldPointsMap[name] != null && last3IdsMap[name]?.has(round.id)) ldPointsMap[name]++
    for (const name of npNames) if (npPointsMap[name] != null && last3IdsMap[name]?.has(round.id)) npPointsMap[name]++
  }

  const challengePointsMap = {}
  for (const name in playerRoundsMap) challengePointsMap[name] = 0
  for (const ch of challenges) {
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
    if (ch.expiredResolution) {
      const { plusPlayer, minusPlayer } = ch.expiredResolution
      if (plusPlayer  && challengePointsMap[plusPlayer]  != null) challengePointsMap[plusPlayer]  += 1
      if (minusPlayer && challengePointsMap[minusPlayer] != null) challengePointsMap[minusPlayer] -= 1
    }
  }

  const inactivityMap = {}
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (const name in playerRoundsMap) {
    const lastDate = new Date(playerRoundsMap[name][0].date + 'T00:00:00')
    const periods = Math.floor(Math.floor((today - lastDate) / 86400000) / 30)
    inactivityMap[name] = periods > 0 ? periods * -3 : 0
  }

  const ranked = Object.keys(strokeScores).map(name => {
    const ld   = ldPointsMap[name] || 0
    const np   = npPointsMap[name] || 0
    const chPts = (challengePointsMap[name] || 0) + (challengePointsStored?.[name] || 0)
    const inact = inactivityMap[name] || 0
    return {
      name,
      strokeScore:      strokeScores[name],
      h2hPoints:        h2hPoints[name]        || 0,
      captainPoints:    captainPointsMap[name]  || 0,
      captainPointsAll: captainPointsAllMap[name] || 0,
      ldPoints: ld, npPoints: np,
      challengePoints:  chPts,
      inactivityPoints: inact,
      finalScore: strokeScores[name] - (h2hPoints[name] || 0) - (captainPointsMap[name] || 0) - ld - np - chPts - inact,
      totalRounds: playerRoundsMap[name].length,
    }
  })
  ranked.sort((a, b) => a.finalScore !== b.finalScore ? a.finalScore - b.finalScore : a.strokeScore - b.strokeScore)
  return { ranked }
}

// ─── Print helpers ────────────────────────────────────────────────────────────

function section(title) {
  console.log('\n' + '═'.repeat(62))
  console.log('  ' + title)
  console.log('═'.repeat(62))
}

function sub(title) {
  console.log('\n' + title)
  console.log('─'.repeat(title.length))
}

function adjScore(p) { return p.adjustedStrokes ?? p.strokes }
function is18hole(round, player) { return !(player?.is9holes ?? round.is9holes ?? false) }
function pairKey(a, b) { return [a, b].sort().join(' :: ') }

// ─── Fetch data ───────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

console.log('Fetching golf/appData from Firestore...')
const snap = await getDoc(doc(db, 'golf', 'appData'))
if (!snap.exists()) { console.error('Document golf/appData does not exist'); process.exit(1) }

const data                  = snap.data()
const rounds                = Array.isArray(data.rounds)            ? data.rounds            : []
const captainAwards         = Array.isArray(data.captainAwards)     ? data.captainAwards     : []
const captainCategories     = Array.isArray(data.captainCategories) ? data.captainCategories : []
const challenges            = Array.isArray(data.challenges)        ? data.challenges        : []
const h2hPointsStored       = data.h2hPointsStored       || {}
const h2hAdjustments        = data.h2hAdjustments         || {}
const challengePointsStored = data.challengePointsStored  || {}

const roundsChron = [...rounds].sort((a, b) =>
  a.date !== b.date ? a.date.localeCompare(b.date) : (a.id || '').localeCompare(b.id || '')
)

console.log(`Loaded: ${rounds.length} rounds | ${captainAwards.length} captain awards | ${challenges.length} challenges`)

// ─── Final rankings ───────────────────────────────────────────────────────────

const { ranked: finalRanked } = calculateRankings(
  rounds, captainAwards, h2hAdjustments, challenges, h2hPointsStored, challengePointsStored
)
const finalRankMap = {}
finalRanked.forEach((p, i) => { finalRankMap[p.name] = i + 1 })

// ─── Initial rank per player (from h2hSnapshot.preRoundRank in their 1st round) ─

const playerInitialRank = {}   // rank before the player's very first round
for (const r of roundsChron) {
  const snapshot = r.h2hSnapshot || {}
  for (const p of r.players) {
    if (playerInitialRank[p.name] == null) {
      const sn = snapshot[p.name]
      if (sn?.preRoundRank != null) playerInitialRank[p.name] = sn.preRoundRank
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════
section('PERFORMANCE')

// --- Best netto round (18-hole) ---
sub('Best netto round of the season  (18-hole only)')
let bestNetto = null
for (const r of rounds) {
  for (const p of r.players) {
    if (!is18hole(r, p)) continue
    const score = adjScore(p)
    if (bestNetto === null || score < bestNetto.score)
      bestNetto = { player: p.name, score, course: r.course, date: r.date }
  }
}
if (bestNetto) console.log(`${bestNetto.player}  |  netto ${bestNetto.score}  |  ${bestNetto.course}  |  ${bestNetto.date}`)
else            console.log('No 18-hole rounds found.')

// --- Best brutto round (18-hole) ---
sub('Best brutto round of the season  (18-hole only)')
let bestBrutto = null
for (const r of rounds) {
  for (const p of r.players) {
    if (!is18hole(r, p)) continue
    const score = p.strokes
    if (bestBrutto === null || score < bestBrutto.score)
      bestBrutto = { player: p.name, score, course: r.course, date: r.date }
  }
}
if (bestBrutto) console.log(`${bestBrutto.player}  |  brutto ${bestBrutto.score}  |  ${bestBrutto.course}  |  ${bestBrutto.date}`)
else             console.log('No 18-hole rounds found.')

// --- Rounds played + average netto (all rounds) ---
sub('Rounds played  &  average netto per player  (all rounds)')
const playerRoundCount = {}, playerNettoSum = {}, playerNettoCount18 = {}, playerNetto18Sum = {}
for (const r of rounds) {
  for (const p of r.players) {
    playerRoundCount[p.name]  = (playerRoundCount[p.name] || 0) + 1
    playerNettoSum[p.name]    = (playerNettoSum[p.name]   || 0) + adjScore(p)
    if (is18hole(r, p)) {
      playerNettoCount18[p.name] = (playerNettoCount18[p.name] || 0) + 1
      playerNetto18Sum[p.name]   = (playerNetto18Sum[p.name]   || 0) + adjScore(p)
    }
  }
}
const byRounds = Object.entries(playerRoundCount).sort((a, b) => b[1] - a[1])
console.log(`${'Player'.padEnd(14)} Rounds  Avg netto (all)  Avg netto (18h)`)
for (const [name, count] of byRounds) {
  const avgAll = (playerNettoSum[name] / count).toFixed(1)
  const avg18  = playerNettoCount18[name] ? (playerNetto18Sum[name] / playerNettoCount18[name]).toFixed(1) : 'n/a'
  console.log(`  ${name.padEnd(12)} ${String(count).padStart(4)}    ${String(avgAll).padStart(5)}            ${String(avg18).padStart(5)}`)
}

// --- Biggest rank climb ---
sub('Biggest rank climb over the season')
const climbs = []
for (const p of finalRanked) {
  const finalRank   = finalRankMap[p.name]
  const initialRank = playerInitialRank[p.name]
  if (initialRank != null) {
    const climb = initialRank - finalRank  // positive = moved up
    climbs.push({ name: p.name, initialRank, finalRank, climb })
  }
}
climbs.sort((a, b) => b.climb - a.climb)
if (climbs.length > 0) {
  const best = climbs[0]
  console.log(`Best: ${best.name}  ${best.climb > 0 ? '+' : ''}${best.climb} positions  (rank ${best.initialRank} → ${best.finalRank})`)
  console.log()
  console.log(`(initial rank = rank before each player's first-ever round in the data)`)
  console.log(`${'Player'.padEnd(14)} Init  Final  Change`)
  for (const c of climbs) {
    const arrow = c.climb > 0 ? `+${c.climb}` : String(c.climb)
    console.log(`  ${c.name.padEnd(12)} ${String(c.initialRank).padStart(4)}  ${String(c.finalRank).padStart(4)}   ${arrow}`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HEAD-TO-HEAD
// ═══════════════════════════════════════════════════════════════════════════════
section('HEAD-TO-HEAD')

// Build per-pair win/loss records and collect upset candidates
const pairRecords = {}  // pairKey -> { a, b, aWins, bWins, draws }
const upsets = []       // { magnitude, winner, loser, winnerRank, loserRank, course, date }

for (const r of roundsChron) {
  const players  = r.players
  const snapshot = r.h2hSnapshot || {}

  // Build pre-round rank map from stored snapshot
  const preRankMap = {}
  for (const [name, info] of Object.entries(snapshot))
    if (info?.preRoundRank != null) preRankMap[name] = info.preRoundRank

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j]
      const aAdj = adjScore(a), bAdj = adjScore(b)
      const key = pairKey(a.name, b.name)

      if (!pairRecords[key]) {
        const [first, second] = [a.name, b.name].sort()
        pairRecords[key] = { a: first, b: second, aWins: 0, bWins: 0, draws: 0 }
      }
      const rec = pairRecords[key]

      if (aAdj === bAdj) {
        rec.draws++
      } else {
        const [winner, loser] = aAdj < bAdj ? [a, b] : [b, a]
        if (rec.a === winner.name) rec.aWins++; else rec.bWins++

        // Upset detection: lower-ranked (higher rank number) player wins
        const wRank = preRankMap[winner.name]
        const lRank = preRankMap[loser.name]
        if (wRank != null && lRank != null && wRank > lRank) {
          upsets.push({
            magnitude: wRank - lRank,
            winner: winner.name, loser: loser.name,
            winnerRank: wRank, loserRank: lRank,
            course: r.course, date: r.date,
          })
        }
      }
    }
  }
}

// --- Biggest upset ---
sub('Biggest upset  (underdog win with largest pre-round rank gap)')
upsets.sort((a, b) => b.magnitude - a.magnitude)
if (upsets.length > 0) {
  const u = upsets[0]
  console.log(`${u.winner} (rank ${u.winnerRank}) beat ${u.loser} (rank ${u.loserRank})  —  rank gap: ${u.magnitude}`)
  console.log(`  Course: ${u.course}  |  Date: ${u.date}`)
  if (upsets.length > 1) {
    console.log('\n  Top 5 upsets:')
    for (const up of upsets.slice(0, 5))
      console.log(`    gap ${up.magnitude}: ${up.winner}(#${up.winnerRank}) beat ${up.loser}(#${up.loserRank})  ${up.course}  ${up.date}`)
  }
} else {
  console.log('No upset data (h2hSnapshot.preRoundRank not available).')
}

// --- Most H2H points gained / lost ---
sub('Most H2H points gained  /  most lost  (stored + adjustments)')
const h2hTotals = {}
for (const [name, pts] of Object.entries(h2hPointsStored))
  h2hTotals[name] = pts + (h2hAdjustments[name] || 0)
const h2hSorted = Object.entries(h2hTotals).sort((a, b) => b[1] - a[1])
if (h2hSorted.length > 0) {
  const [topName, topPts] = h2hSorted[0]
  const [botName, botPts] = h2hSorted[h2hSorted.length - 1]
  console.log(`Most gained:  ${topName}  +${topPts} pts`)
  console.log(`Most lost:    ${botName}   ${botPts} pts`)
  console.log()
  console.log('Full leaderboard:')
  for (const [name, pts] of h2hSorted)
    console.log(`  ${name.padEnd(12)} ${pts >= 0 ? '+' : ''}${pts}`)
}

// --- Most lopsided record ---
sub('Most lopsided head-to-head record  (any number of meetings)')
let lopsided = null, lopsidedDiff = -1
for (const rec of Object.values(pairRecords)) {
  const diff = Math.abs(rec.aWins - rec.bWins)
  if (diff > lopsidedDiff) {
    lopsidedDiff = diff
    lopsided = rec
  }
}
if (lopsided) {
  const [lead, trail, lW, tW] = lopsided.aWins >= lopsided.bWins
    ? [lopsided.a, lopsided.b, lopsided.aWins, lopsided.bWins]
    : [lopsided.b, lopsided.a, lopsided.bWins, lopsided.aWins]
  const drawStr = lopsided.draws ? `  (${lopsided.draws} draw${lopsided.draws > 1 ? 's' : ''})` : ''
  const total = lopsided.aWins + lopsided.bWins + lopsided.draws
  console.log(`${lead} vs ${trail}:  ${lW}-${tW}${drawStr}  [${total} meetings]`)
}

// --- Closest record (≥4 meetings) ---
sub('Closest head-to-head record  (at least 4 meetings)')
let closest = null, closestDiff = Infinity, closestTotal = 0
for (const rec of Object.values(pairRecords)) {
  const total = rec.aWins + rec.bWins + rec.draws
  if (total < 4) continue
  const diff = Math.abs(rec.aWins - rec.bWins)
  if (diff < closestDiff || (diff === closestDiff && total > closestTotal)) {
    closestDiff = diff; closestTotal = total; closest = rec
  }
}
if (closest) {
  const drawStr = closest.draws ? `  (${closest.draws} draw${closest.draws > 1 ? 's' : ''})` : ''
  const total = closest.aWins + closest.bWins + closest.draws
  console.log(`${closest.a} vs ${closest.b}:  ${closest.aWins}-${closest.bWins}${drawStr}  [${total} meetings]`)
} else {
  console.log('No pair has met 4 or more times.')
}

// --- Rivalry of the season ---
sub('Rivalry of the season  (most meetings between any pair)')
const rivalries = Object.values(pairRecords)
  .map(rec => ({ ...rec, total: rec.aWins + rec.bWins + rec.draws }))
  .sort((a, b) => b.total - a.total)
if (rivalries.length > 0) {
  const r = rivalries[0]
  const drawStr = r.draws ? `  (${r.draws} draw${r.draws > 1 ? 's' : ''})` : ''
  console.log(`${r.a} vs ${r.b}:  ${r.total} meetings  —  ${r.aWins}-${r.bWins}${drawStr}`)
}

// --- All pairs with ≥3 meetings ---
sub('All pairs with 3 or more meetings')
const pairs3plus = Object.values(pairRecords)
  .map(rec => ({ ...rec, total: rec.aWins + rec.bWins + rec.draws }))
  .filter(rec => rec.total >= 3)
  .sort((a, b) => b.total - a.total || a.a.localeCompare(b.a))
if (pairs3plus.length === 0) {
  console.log('No pair has met 3 or more times.')
} else {
  console.log(`${'Pair'.padEnd(28)} Record  Draws  Meetings`)
  for (const rec of pairs3plus) {
    const pair = `${rec.a} vs ${rec.b}`
    const drawStr = rec.draws ? ` (${rec.draws}d)` : ''
    console.log(`  ${pair.padEnd(26)} ${rec.aWins}-${rec.bWins}${drawStr.padEnd(7)} ${rec.total}`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CAPTAIN & BONUSES
// ═══════════════════════════════════════════════════════════════════════════════
section('CAPTAIN & BONUSES')

// --- Captain points totals per player ---
sub('Captain points  —  most gained  &  most lost  (all awards)')
const captainGained = {}, captainLost = {}, captainTotal = {}
const categoryFreq = {}

for (const award of captainAwards) {
  const { playerName, points, categoryName } = award
  captainTotal[playerName]  = (captainTotal[playerName] || 0) + points
  if (points > 0) captainGained[playerName] = (captainGained[playerName] || 0) + points
  if (points < 0) captainLost[playerName]   = (captainLost[playerName]   || 0) + points
  categoryFreq[categoryName] = (categoryFreq[categoryName] || 0) + 1
}

const sortedGained = Object.entries(captainGained).sort((a, b) => b[1] - a[1])
const sortedLost   = Object.entries(captainLost).sort((a, b) => a[1] - b[1])   // most negative first
if (sortedGained.length > 0) console.log(`Most gained:  ${sortedGained[0][0]}  +${sortedGained[0][1]} pts`)
if (sortedLost.length   > 0) console.log(`Most lost:    ${sortedLost[0][0]}    ${sortedLost[0][1]} pts`)

console.log()
console.log('All-time captain point totals:')
const captainTotalSorted = Object.entries(captainTotal).sort((a, b) => b[1] - a[1])
for (const [name, pts] of captainTotalSorted)
  console.log(`  ${name.padEnd(12)} ${pts >= 0 ? '+' : ''}${pts}`)

// --- Most frequently awarded category ---
sub('Most frequently awarded captain category')
const catSorted = Object.entries(categoryFreq).sort((a, b) => b[1] - a[1])
for (const [cat, count] of catSorted)
  console.log(`  ${cat.padEnd(26)} ${count}x`)

// --- Longest Drive & Nearest to Pin (all-time, from round data) ---
sub('Longest Drive  &  Nearest to Pin  —  all-time award count')
const ldCount = {}, npCount = {}
for (const r of rounds) {
  const ldNames = Array.isArray(r.longestDrive) ? r.longestDrive : r.longestDrive ? [r.longestDrive] : []
  const npNames = Array.isArray(r.nearestPin)   ? r.nearestPin   : r.nearestPin   ? [r.nearestPin]   : []
  for (const name of ldNames) ldCount[name] = (ldCount[name] || 0) + 1
  for (const name of npNames) npCount[name] = (npCount[name] || 0) + 1
}
const ldSorted = Object.entries(ldCount).sort((a, b) => b[1] - a[1])
const npSorted = Object.entries(npCount).sort((a, b) => b[1] - a[1])
if (ldSorted.length > 0) console.log(`Most Longest Drive:       ${ldSorted[0][0]}  ${ldSorted[0][1]}x`)
if (npSorted.length > 0) console.log(`Most Nearest to the Pin:  ${npSorted[0][0]}  ${npSorted[0][1]}x`)
console.log()
console.log(`${'Longest Drive'.padEnd(24)} | Nearest to Pin`)
console.log(`${'─'.repeat(24)}-+-${'─'.repeat(24)}`)
const maxRows = Math.max(ldSorted.length, npSorted.length)
for (let i = 0; i < maxRows; i++) {
  const ldStr = ldSorted[i] ? `${ldSorted[i][0]} (${ldSorted[i][1]}x)` : ''
  const npStr = npSorted[i] ? `${npSorted[i][0]} (${npSorted[i][1]}x)` : ''
  console.log(`  ${ldStr.padEnd(22)} |   ${npStr}`)
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════════
section('CHALLENGES')

const challengeIssued  = {}  // by challenger name
const challengeWonMap  = {}  // total wins regardless of role
let expiredCount = 0, expiredNoAction = 0

for (const ch of challenges) {
  // Issued
  challengeIssued[ch.challenger] = (challengeIssued[ch.challenger] || 0) + 1

  // Wins: fulfilled = challenger wins; failed = each challenged player wins
  if (ch.status === 'fulfilled') {
    challengeWonMap[ch.challenger] = (challengeWonMap[ch.challenger] || 0) + 1
  }
  if (ch.status === 'failed') {
    for (const cName of ch.challenged)
      challengeWonMap[cName] = (challengeWonMap[cName] || 0) + 1
  }

  // Expired
  if (ch.status === 'expired') {
    expiredCount++
    if (!ch.expiredResolution || ch.expiredResolution.noPoints) expiredNoAction++
  }
}

sub('Who issued the most challenges')
const issuedSorted = Object.entries(challengeIssued).sort((a, b) => b[1] - a[1])
for (const [name, count] of issuedSorted)
  console.log(`  ${name.padEnd(12)} ${count} issued`)

sub('Who won the most challenges  (as challenger or as challenged)')
const wonSorted = Object.entries(challengeWonMap).sort((a, b) => b[1] - a[1])
if (wonSorted.length > 0) {
  for (const [name, count] of wonSorted)
    console.log(`  ${name.padEnd(12)} ${count} won`)
} else {
  console.log('No resolved challenges yet.')
}

sub('Expired challenges')
console.log(`Total expired:         ${expiredCount}`)
console.log(`  - No action taken:   ${expiredNoAction}`)
console.log(`  - Captain resolved:  ${expiredCount - expiredNoAction}`)

// Summary by status
const statusCount = {}
for (const ch of challenges)
  statusCount[ch.status] = (statusCount[ch.status] || 0) + 1
console.log()
console.log('Challenge status breakdown:')
for (const [status, count] of Object.entries(statusCount).sort((a, b) => b[1] - a[1]))
  console.log(`  ${status.padEnd(12)} ${count}`)

// ═══════════════════════════════════════════════════════════════════════════════
//  COURSES
// ═══════════════════════════════════════════════════════════════════════════════
section('COURSES')

const courseRoundCount  = {}  // number of rounds played at each course
const coursePlayerScores = {} // all player adjusted scores (18h only) at each course

for (const r of rounds) {
  courseRoundCount[r.course] = (courseRoundCount[r.course] || 0) + 1
  for (const p of r.players) {
    if (!is18hole(r, p)) continue
    if (!coursePlayerScores[r.course]) coursePlayerScores[r.course] = []
    coursePlayerScores[r.course].push(adjScore(p))
  }
}

// Most played course
sub('Most played courses  (by number of rounds)')
const courseSorted = Object.entries(courseRoundCount).sort((a, b) => b[1] - a[1])
for (const [course, count] of courseSorted)
  console.log(`  ${course.padEnd(34)} ${count} round${count > 1 ? 's' : ''}`)

// Best and worst netto average (≥2 rounds)
sub('Group netto average by course  (18-hole rounds, ≥2 rounds played)')
const courseAvgs = []
for (const [course, scores] of Object.entries(coursePlayerScores)) {
  if ((courseRoundCount[course] || 0) < 2) continue
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  courseAvgs.push({ course, avg, rounds: courseRoundCount[course] || 0 })
}
courseAvgs.sort((a, b) => a.avg - b.avg)

if (courseAvgs.length > 0) {
  const best  = courseAvgs[0]
  const worst = courseAvgs[courseAvgs.length - 1]
  console.log(`Best avg netto:   ${best.course}  —  ${best.avg.toFixed(1)} avg  (${best.rounds} rounds)`)
  console.log(`Worst avg netto:  ${worst.course}  —  ${worst.avg.toFixed(1)} avg  (${worst.rounds} rounds)`)
  console.log()
  console.log(`${'Course'.padEnd(34)} Avg netto  Rounds`)
  for (const c of courseAvgs)
    console.log(`  ${c.course.padEnd(32)} ${String(c.avg.toFixed(1)).padStart(5)}      ${c.rounds}`)
} else {
  console.log('Not enough data (need at least 2 rounds per course).')
}

console.log('\n' + '═'.repeat(62))
console.log('  Done.')
console.log('═'.repeat(62) + '\n')
process.exit(0)
