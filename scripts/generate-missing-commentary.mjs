/**
 * Generates AI commentary for rounds that are missing it.
 * Pass a round ID as argument to target a specific round, otherwise
 * targets all rounds missing commentary (most recent first, up to --limit N).
 *
 * Usage:
 *   node scripts/generate-missing-commentary.mjs
 *   node scripts/generate-missing-commentary.mjs <roundId>
 *   node scripts/generate-missing-commentary.mjs --limit 5
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'
import { calculateRankings } from '../src/utils/ranking.js'

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
const ref = doc(db, 'golf', 'appData')

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const limitIdx = args.indexOf('--limit')
const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : 1
const targetId = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a))

// ── Fetch data ─────────────────────────────────────────────────────────────
const snap = await getDoc(ref)
if (!snap.exists()) { console.error('Document not found'); process.exit(1) }
const data = snap.data()
const allRounds     = Array.isArray(data.rounds)        ? data.rounds        : []
const captainAwards = Array.isArray(data.captainAwards) ? data.captainAwards : []
const apiKey        = data.claudeApiKey

if (!apiKey) { console.error('No claudeApiKey in Firestore'); process.exit(1) }

// ── Pick rounds to process ─────────────────────────────────────────────────
let toProcess
if (targetId) {
  const r = allRounds.find(r => r.id === targetId)
  if (!r) { console.error('Round not found:', targetId); process.exit(1) }
  toProcess = [r]
} else {
  toProcess = [...allRounds]
    .filter(r => !r.aiComment)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

if (toProcess.length === 0) {
  console.log('No rounds missing commentary.')
  process.exit(0)
}

// ── Build context (mirrors src/utils/generateCommentary.js) ───────────────
function buildContext(round, rounds, awards) {
  const { ranked } = calculateRankings(rounds, awards)
  const rankMap = {}
  ranked.forEach((p, i) => { rankMap[p.name] = i + 1 })

  const sorted = [...round.players].sort(
    (a, b) => (a.adjustedStrokes ?? a.strokes) - (b.adjustedStrokes ?? b.strokes)
  )
  const winner = sorted[0]

  const ldNames = Array.isArray(round.longestDrive) ? round.longestDrive
    : round.longestDrive ? [round.longestDrive] : []
  const npNames = Array.isArray(round.nearestPin) ? round.nearestPin
    : round.nearestPin ? [round.nearestPin] : []

  let ctx = `=== VÝSLEDKY KOLA ===\n`
  ctx += `Ihrisko: ${round.course}\n`
  ctx += `Odpalisko: ${round.tee ?? '?'}\n`
  ctx += `Dátum: ${round.date}\n`
  ctx += `Úprava ihriska: ${round.courseAdjustment ?? 0}\n`
  const has9h = round.players.some(p => p.is9holes ?? round.is9holes)
  if (has9h) ctx += `Niektorí hráči hrali 9 jamiek (skóre ×2)\n`
  ctx += `Víťaz: ${winner.name}\n`
  if (ldNames.length) ctx += `Longest Drive: ${ldNames.join(', ')}\n`
  if (npNames.length) ctx += `Nearest to Pin: ${npNames.join(', ')}\n`
  if (round.note) ctx += `Poznámka od hráčov: "${round.note}"\n`

  ctx += `\nHráči v tomto kole:\n`
  for (const p of sorted) {
    const rank = rankMap[p.name] ?? '?'
    ctx += `  ${p.name}: brutto ${p.strokes}, netto ${p.adjustedStrokes ?? p.strokes} (rebríček #${rank})\n`
  }

  ctx += `\n=== AKTUÁLNY REBRÍČEK ===\n`
  for (const p of ranked) {
    ctx += `#${rankMap[p.name]} ${p.name}: skóre ${Math.round(p.finalScore * 10) / 10}, ${p.totalRounds} kôl\n`
  }

  ctx += `\n=== FORMA HRÁČOV ===\n`
  for (const p of round.players) {
    const entry = ranked.find(r => r.name === p.name)
    if (entry && entry.lastRounds.length > 0) {
      const form = entry.lastRounds.map(r => `${r.adjustedStrokes} (${r.course})`).join(', ')
      ctx += `${p.name}: posledné kolá: ${form}\n`
    }
  }

  ctx += `\n=== H2H MEDZI HRÁČMI V KOLE ===\n`
  for (let i = 0; i < round.players.length; i++) {
    for (let j = i + 1; j < round.players.length; j++) {
      const n1 = round.players[i].name
      const n2 = round.players[j].name
      let w1 = 0, w2 = 0, draws = 0
      for (const r of rounds) {
        const pp1 = r.players.find(p => p.name === n1)
        const pp2 = r.players.find(p => p.name === n2)
        if (!pp1 || !pp2) continue
        const s1 = pp1.adjustedStrokes ?? pp1.strokes
        const s2 = pp2.adjustedStrokes ?? pp2.strokes
        if (s1 < s2) w1++; else if (s2 < s1) w2++; else draws++
      }
      if (w1 + w2 + draws > 0)
        ctx += `${n1} vs ${n2}: ${w1}-${w2}${draws ? ` (${draws}R)` : ''}\n`
    }
  }

  ctx += `\n=== OSOBNÉ REKORDY ===\n`
  const priorRounds = rounds.filter(r => r.id !== round.id)
  for (const p of round.players) {
    if (p.is9holes ?? round.is9holes) continue
    const prevBest = priorRounds
      .flatMap(r => r.players.filter(pl => pl.name === p.name).map(pl => pl.strokes))
    if (prevBest.length > 0) {
      const best = Math.min(...prevBest)
      if (p.strokes <= best)
        ctx += `${p.name} dosiahol nový osobný rekord brutto: ${p.strokes} (predtým ${best})!\n`
    } else {
      ctx += `${p.name} odohral svoje prvé 18-jamkové kolo: ${p.strokes}\n`
    }
  }

  const thisRoundAwards = awards.filter(a => a.date === round.date)
  if (thisRoundAwards.length > 0) {
    ctx += `\n=== KAPITÁNSKE BODY (toto kolo) ===\n`
    for (const p of round.players) {
      const pa = thisRoundAwards.filter(a => a.playerName === p.name)
      if (pa.length > 0) {
        const desc = pa.map(a => `${a.categoryEmoji} ${a.categoryName} (${a.points > 0 ? '+' : ''}${a.points})`).join(', ')
        ctx += `${p.name}: ${desc}\n`
      }
    }
  }

  ctx += `\n=== SÉRIE ===\n`
  for (const p of round.players) {
    const playerRounds = rounds
      .filter(r => r.players.some(pl => pl.name === p.name) && r.players.length > 1)
      .sort((a, b) => b.date.localeCompare(a.date))
    let streak = 0, type = null
    for (const r of playerRounds) {
      const s = [...r.players].sort((a, b) =>
        (a.adjustedStrokes ?? a.strokes) - (b.adjustedStrokes ?? b.strokes)
      )
      const won = s[0].name === p.name
      if (type === null) type = won ? 'win' : 'loss'
      if ((won && type === 'win') || (!won && type === 'loss')) streak++
      else break
    }
    if (streak >= 2)
      ctx += `${p.name}: ${streak}× ${type === 'win' ? 'výhra' : 'prehra'} v rade\n`
  }

  return ctx
}

// ── Generate + save ────────────────────────────────────────────────────────
const updatedRounds = [...allRounds]

for (const round of toProcess) {
  console.log(`\nGenerating commentary for: ${round.date} – ${round.course} (${round.id})`)
  const context = buildContext(round, allRounds, captainAwards)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: 'Si vtipný slovenský golfový komentátor pre skupinu kamarátov s prezývkami. Píšeš krátke osobné a zábavné komentáre po každom kole. Používaš slovenčinu, si humorný ale priateľský. Poznáš históriu hráčov, ich rivalitá a formu. Komentár má 3-4 vety. Píš len čistý text bez nadpisov, bez markdown formátovania, bez emoji a bez hashtagov. Ak je poznámka od hráčov, zakomponuj ju do komentára. Kapitánske body v kontexte sú len tie, ktoré boli udelené v tomto konkrétnom kole. Nespomínaj kapitánske body z iných kôl.',
      messages: [{ role: 'user', content: context }],
    }),
  })

  if (!res.ok) {
    console.error('API error:', res.status, await res.text())
    continue
  }

  const json = await res.json()
  const comment = json.content?.[0]?.text ?? null
  if (!comment) { console.error('Empty response from API'); continue }

  console.log('Commentary:', comment)
  const idx = updatedRounds.findIndex(r => r.id === round.id)
  if (idx !== -1) updatedRounds[idx] = { ...updatedRounds[idx], aiComment: comment }
}

await updateDoc(ref, { rounds: updatedRounds })
console.log('\nSaved to Firestore.')
process.exit(0)
