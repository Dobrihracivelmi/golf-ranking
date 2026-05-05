// One-time migration: generate AI commentary for all rounds from 2026-04-17
// onwards that don't have an aiComment yet.

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            'AIzaSyAB7WNY2CApH4k3sUKGq99SpE5NxoiOsu4',
  authDomain:        'golf-ranking-63716.firebaseapp.com',
  projectId:         'golf-ranking-63716',
  storageBucket:     'golf-ranking-63716.firebasestorage.app',
  messagingSenderId: '549351533657',
  appId:             '1:549351533657:web:a0ca7d0cf9e8300c6f1548',
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)
const DATA_REF = doc(db, 'golf', 'appData')

// ── Inline ranking calculation (same as src/utils/ranking.js) ──────────────

function strokeRankMap(rnds) {
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
    sc[n] = s.length === 1 ? s[0] * 3 : s.length === 2 ? ((s[0] + s[1]) / 2) * 3 : s[0] + s[1] + s[2]
  }
  const sorted = Object.keys(sc).sort((a, b) => sc[a] - sc[b])
  const rm = {}
  sorted.forEach((n, i) => { rm[n] = i + 1 })
  return rm
}

function calculateRankings(rounds, captainAwards = []) {
  const playerRoundsMap = {}
  for (const round of rounds) {
    for (const p of round.players) {
      if (!playerRoundsMap[p.name]) playerRoundsMap[p.name] = []
      playerRoundsMap[p.name].push({
        id: round.id, date: round.date, course: round.course,
        tee: round.tee ?? null, adjustment: round.courseAdjustment ?? 0,
        is9holes: round.is9holes ?? false, strokes: p.strokes,
        adjustedStrokes: p.adjustedStrokes ?? p.strokes,
      })
    }
  }
  for (const name in playerRoundsMap)
    playerRoundsMap[name].sort((a, b) => new Date(b.date) - new Date(a.date))

  const strokeScores = {}
  for (const name in playerRoundsMap) {
    const s = playerRoundsMap[name].slice(0, 3).map(r => r.adjustedStrokes)
    strokeScores[name] = s.length === 1 ? s[0] * 3 : s.length === 2 ? ((s[0] + s[1]) / 2) * 3 : s[0] + s[1] + s[2]
  }

  const sortedByStroke = Object.keys(strokeScores).sort((a, b) => strokeScores[a] - strokeScores[b])
  const rankMap = {}
  sortedByStroke.forEach((name, i) => { rankMap[name] = i + 1 })

  const roundsChron = [...rounds].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.id || '').localeCompare(b.id || '')
  })
  const h2hPoints = {}
  for (const name in playerRoundsMap) h2hPoints[name] = 0
  for (let ri = 0; ri < roundsChron.length; ri++) {
    const round = roundsChron[ri]
    const preRankMap = strokeRankMap(roundsChron.slice(0, ri))
    const rp = round.players.filter(p => preRankMap[p.name] != null)
    for (let i = 0; i < rp.length; i++) {
      for (let j = i + 1; j < rp.length; j++) {
        const a = rp[i], b = rp[j]
        const aAdj = a.adjustedStrokes ?? a.strokes, bAdj = b.adjustedStrokes ?? b.strokes
        if (aAdj === bAdj) continue
        const [winner, loser] = aAdj < bAdj ? [a, b] : [b, a]
        const wR = preRankMap[winner.name], lR = preRankMap[loser.name]
        if (wR > lR) { const d = wR - lR; h2hPoints[winner.name] += d; h2hPoints[loser.name] -= d }
      }
    }
  }

  const captainPointsMap = {}
  for (const name in playerRoundsMap) captainPointsMap[name] = 0
  for (const award of captainAwards)
    if (captainPointsMap[award.playerName] != null) captainPointsMap[award.playerName] += award.points

  const last3IdsMap = {}
  for (const name in playerRoundsMap)
    last3IdsMap[name] = new Set(playerRoundsMap[name].slice(0, 3).map(r => r.id))
  const ldPointsMap = {}, npPointsMap = {}
  for (const name in playerRoundsMap) { ldPointsMap[name] = 0; npPointsMap[name] = 0 }
  for (const round of rounds) {
    const ldN = Array.isArray(round.longestDrive) ? round.longestDrive : round.longestDrive ? [round.longestDrive] : []
    const npN = Array.isArray(round.nearestPin) ? round.nearestPin : round.nearestPin ? [round.nearestPin] : []
    for (const n of ldN) if (ldPointsMap[n] != null && last3IdsMap[n]?.has(round.id)) ldPointsMap[n]++
    for (const n of npN) if (npPointsMap[n] != null && last3IdsMap[n]?.has(round.id)) npPointsMap[n]++
  }

  const ranked = Object.keys(strokeScores).map(name => {
    const last3 = playerRoundsMap[name].slice(0, 3)
    const ld = ldPointsMap[name] || 0, np = npPointsMap[name] || 0
    return {
      name, strokeScore: strokeScores[name],
      totalAdjustment: last3.reduce((s, r) => s + (r.adjustment ?? 0), 0),
      h2hPoints: h2hPoints[name] || 0, captainPoints: captainPointsMap[name] || 0,
      ldPoints: ld, npPoints: np, ldnpPoints: ld + np,
      finalScore: strokeScores[name] - (h2hPoints[name] || 0) - (captainPointsMap[name] || 0) - ld - np,
      lastRounds: last3, totalRounds: playerRoundsMap[name].length,
    }
  })
  ranked.sort((a, b) => a.finalScore !== b.finalScore ? a.finalScore - b.finalScore : a.strokeScore - b.strokeScore)
  return { ranked }
}

// ── Context building (same as src/utils/generateCommentary.js) ─────────────

function buildContext(round, allRounds, captainAwards) {
  const { ranked } = calculateRankings(allRounds, captainAwards)
  const rankMap = {}
  ranked.forEach((p, i) => { rankMap[p.name] = i + 1 })

  const sorted = [...round.players].sort((a, b) => (a.adjustedStrokes ?? a.strokes) - (b.adjustedStrokes ?? b.strokes))
  const winner = sorted[0]
  const ldNames = Array.isArray(round.longestDrive) ? round.longestDrive : round.longestDrive ? [round.longestDrive] : []
  const npNames = Array.isArray(round.nearestPin) ? round.nearestPin : round.nearestPin ? [round.nearestPin] : []

  let ctx = `=== VÝSLEDKY KOLA ===\nIhrisko: ${round.course}\nOdpalisko: ${round.tee ?? '?'}\nDátum: ${round.date}\nÚprava ihriska: ${round.courseAdjustment ?? 0}\n`
  if (round.is9holes) ctx += `9-jamkové kolo (skóre ×2)\n`
  ctx += `Víťaz: ${winner.name}\n`
  if (ldNames.length) ctx += `Longest Drive: ${ldNames.join(', ')}\n`
  if (npNames.length) ctx += `Nearest to Pin: ${npNames.join(', ')}\n`

  ctx += `\nHráči v tomto kole:\n`
  for (const p of sorted) ctx += `  ${p.name}: brutto ${p.strokes}, netto ${p.adjustedStrokes ?? p.strokes} (rebríček #${rankMap[p.name] ?? '?'})\n`

  ctx += `\n=== AKTUÁLNY REBRÍČEK ===\n`
  for (const p of ranked) ctx += `#${rankMap[p.name]} ${p.name}: skóre ${Math.round(p.finalScore * 10) / 10}, ${p.totalRounds} kôl\n`

  ctx += `\n=== FORMA HRÁČOV ===\n`
  for (const p of round.players) {
    const entry = ranked.find(r => r.name === p.name)
    if (entry?.lastRounds.length > 0) ctx += `${p.name}: posledné kolá: ${entry.lastRounds.map(r => `${r.adjustedStrokes} (${r.course})`).join(', ')}\n`
  }

  ctx += `\n=== H2H MEDZI HRÁČMI V KOLE ===\n`
  for (let i = 0; i < round.players.length; i++) {
    for (let j = i + 1; j < round.players.length; j++) {
      const n1 = round.players[i].name, n2 = round.players[j].name
      let w1 = 0, w2 = 0, draws = 0
      for (const r of allRounds) {
        const pp1 = r.players.find(p => p.name === n1), pp2 = r.players.find(p => p.name === n2)
        if (!pp1 || !pp2) continue
        const s1 = pp1.adjustedStrokes ?? pp1.strokes, s2 = pp2.adjustedStrokes ?? pp2.strokes
        if (s1 < s2) w1++; else if (s2 < s1) w2++; else draws++
      }
      if (w1 + w2 + draws > 0) ctx += `${n1} vs ${n2}: ${w1}-${w2}${draws ? ` (${draws}R)` : ''}\n`
    }
  }

  ctx += `\n=== OSOBNÉ REKORDY ===\n`
  const priorRounds = allRounds.filter(r => r.id !== round.id)
  for (const p of round.players) {
    if (round.is9holes) continue
    const prev = priorRounds.filter(r => !r.is9holes).flatMap(r => r.players.filter(pl => pl.name === p.name).map(pl => pl.strokes))
    if (prev.length > 0) { const best = Math.min(...prev); if (p.strokes <= best) ctx += `${p.name} dosiahol nový osobný rekord brutto: ${p.strokes} (predtým ${best})!\n` }
    else ctx += `${p.name} odohral svoje prvé 18-jamkové kolo: ${p.strokes}\n`
  }

  ctx += `\n=== KAPITÁNSKE BODY ===\n`
  for (const p of round.players) {
    const entry = ranked.find(r => r.name === p.name)
    const pts = entry?.captainPoints ?? 0
    if (pts !== 0) ctx += `${p.name}: ${pts > 0 ? '+' : ''}${pts}\n`
    const awards = captainAwards.filter(a => a.playerName === p.name)
    if (awards.length > 0) ctx += `  Posledné: ${awards.slice(-3).map(a => `${a.categoryEmoji} ${a.categoryName}`).join(', ')}\n`
  }

  ctx += `\n=== SÉRIE ===\n`
  for (const p of round.players) {
    const pRounds = allRounds.filter(r => r.players.some(pl => pl.name === p.name) && r.players.length > 1).sort((a, b) => b.date.localeCompare(a.date))
    let streak = 0, type = null
    for (const r of pRounds) {
      const s = [...r.players].sort((a, b) => (a.adjustedStrokes ?? a.strokes) - (b.adjustedStrokes ?? b.strokes))
      const won = s[0].name === p.name
      if (type === null) type = won ? 'win' : 'loss'
      if ((won && type === 'win') || (!won && type === 'loss')) streak++; else break
    }
    if (streak >= 2) ctx += `${p.name}: ${streak}× ${type === 'win' ? 'výhra' : 'prehra'} v rade\n`
  }

  return ctx
}

// ── Main ───────────────────────────────────────────────────────────────────

const snap = await getDoc(DATA_REF)
if (!snap.exists()) { console.error('Document not found.'); process.exit(1) }

const data = snap.data()
const rounds = Array.isArray(data.rounds) ? data.rounds : []
const captainAwards = Array.isArray(data.captainAwards) ? data.captainAwards : []
const apiKey = data.claudeApiKey

if (!apiKey) {
  console.error('No claudeApiKey found in Firestore. Set it in the captain panel first.')
  process.exit(1)
}

// Find rounds from 2026-04-17 onwards without aiComment
const targets = rounds.filter(r => r.date >= '2026-04-17' && !r.aiComment)

console.log(`Found ${targets.length} round(s) from 2026-04-17+ without aiComment.`)
if (targets.length === 0) { console.log('Nothing to do.'); process.exit(0) }

// Sort chronologically so context builds properly
targets.sort((a, b) => a.date.localeCompare(b.date))

let updated = [...rounds]
let generated = 0

for (const round of targets) {
  console.log(`\n  Generating for ${round.date} — ${round.course} (${round.players.map(p => p.name).join(', ')})...`)

  const context = buildContext(round, rounds, captainAwards)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: 'Si vtipný slovenský golfový komentátor pre skupinu kamarátov s prezývkami. Píšeš krátke osobné a zábavné komentáre po každom kole. Používaš slovenčinu, si humorný ale priateľský. Poznáš históriu hráčov, ich rivalitá a formu. Komentár má 3-4 vety.',
        messages: [{ role: 'user', content: context }],
      }),
    })

    if (!response.ok) {
      console.error(`  API error ${response.status}: ${await response.text()}`)
      continue
    }

    const result = await response.json()
    const aiComment = result.content?.[0]?.text
    if (!aiComment) { console.error('  Empty response.'); continue }

    console.log(`  ✓ "${aiComment.slice(0, 80)}..."`)

    updated = updated.map(r => r.id === round.id ? { ...r, aiComment } : r)
    generated++

    // Rate limit: wait 2s between calls
    if (targets.indexOf(round) < targets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  } catch (err) {
    console.error(`  Error: ${err.message}`)
  }
}

if (generated > 0) {
  console.log(`\nSaving ${generated} commentary(ies) to Firestore...`)
  await updateDoc(DATA_REF, { rounds: updated })
  console.log('Done.')
} else {
  console.log('\nNo commentaries generated.')
}

process.exit(0)
