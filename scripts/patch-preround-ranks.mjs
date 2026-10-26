/**
 * Patches the stored preRoundRank in h2hSnapshot for the two most recently
 * added rounds, using the correct pre-round ranking formula (calculateRankings,
 * same as the VÝSLEDOK column).
 *
 * Does NOT touch h2hPointsStored, delta, or cumulative — only preRoundRank.
 *
 * Expected verification: Bekis #4, Poli #5, Pešóóó #7
 *
 * Usage:
 *   node scripts/patch-preround-ranks.mjs
 *   node scripts/patch-preround-ranks.mjs --dry-run   (print only, no write)
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'
import { calculateRankings } from '../src/utils/ranking.js'

const DRY_RUN = process.argv.includes('--dry-run')

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

const snap = await getDoc(ref)
if (!snap.exists()) { console.error('Document not found'); process.exit(1) }
const data = snap.data()

const allRounds     = Array.isArray(data.rounds)        ? data.rounds        : []
const captainAwards = Array.isArray(data.captainAwards) ? data.captainAwards : []
const h2hAdjustments = data.h2hAdjustments && typeof data.h2hAdjustments === 'object' ? data.h2hAdjustments : {}
const challenges     = Array.isArray(data.challenges)   ? data.challenges    : []
const currentH2H     = data.h2hPointsStored && typeof data.h2hPointsStored === 'object' ? data.h2hPointsStored : {}

console.log(`Loaded ${allRounds.length} rounds.`)

// ── Identify the two most recently INSERTED rounds by ID timestamp ─────────
// IDs are `${Date.now()}-${random}`, so the numeric prefix is insertion time.
const byInsertion = [...allRounds].sort((a, b) => {
  const tsA = parseInt(a.id?.split('-')[0] || '0', 10)
  const tsB = parseInt(b.id?.split('-')[0] || '0', 10)
  return tsA - tsB
})

const [round1, round2] = [byInsertion[byInsertion.length - 2], byInsertion[byInsertion.length - 1]]
const twoLatest = [round1, round2]

console.log('\nTwo most recently added rounds (in insertion order):')
console.log(`  [1] ${round1.date}  ${round1.course}  (${round1.id})`)
console.log(`  [2] ${round2.date}  ${round2.course}  (${round2.id})`)

// ── Print stored h2hSnapshot for each round ───────────────────────────────
for (const [idx, round] of [[1, round1], [2, round2]]) {
  console.log(`\nStored h2hSnapshot for round ${idx} (${round.course}):`)
  if (!round.h2hSnapshot) { console.log('  (none)'); continue }
  for (const [name, s] of Object.entries(round.h2hSnapshot).sort()) {
    console.log(`  ${name}: delta=${s.delta} cumulative=${s.cumulative} storedPreRank=${s.preRoundRank}`)
  }
}

// ── Per-round pre-round state ──────────────────────────────────────────────
// Round 1 pre-state: all rounds except both new ones; h2h = current - D1 - D2
// Round 2 pre-state: all rounds except round2 only;   h2h = current - D2
//   (round1 result IS part of round2's pre-round context)

function buildPreH2H(excludeRounds) {
  const h = { ...currentH2H }
  for (const r of excludeRounds) {
    if (!r.h2hSnapshot) continue
    for (const [name, s] of Object.entries(r.h2hSnapshot)) {
      if (h[name] != null) h[name] -= s.delta
    }
  }
  return h
}

const preH2H_r1 = buildPreH2H([round1, round2])  // before both
const preH2H_r2 = buildPreH2H([round2])           // before round2 (includes round1 result)

const preRounds_r1 = byInsertion.slice(0, -2)     // excludes both
const preRounds_r2 = byInsertion.slice(0, -1)     // excludes only round2

// ── Filter challenges (resolved by today's rounds excluded from pre-state) ──
const today = new Date().toISOString().split('T')[0]
const preChallenges = challenges.filter(ch => !ch.resolvedDate || ch.resolvedDate < today)
console.log(`\nChallenges: ${challenges.length} total, ${preChallenges.length} pre-round (excl. today-resolved)`)

// ── Compute pre-round rankings ─────────────────────────────────────────────
function computeRankMap(rounds, h2h) {
  const { ranked } = calculateRankings(rounds, captainAwards, h2hAdjustments, preChallenges, h2h)
  const rm = {}
  ranked.forEach((p, i) => { rm[p.name] = i + 1 })
  return { ranked, rankMap: rm }
}

const { ranked: ranked1, rankMap: rankMap1 } = computeRankMap(preRounds_r1, preH2H_r1)
const { ranked: ranked2, rankMap: rankMap2 } = computeRankMap(preRounds_r2, preH2H_r2)

console.log('\nPre-round ranking for ROUND 1 (before both):')
ranked1.forEach((p, i) => {
  const stored = round1.h2hSnapshot?.[p.name]?.preRoundRank
  const flag   = stored != null && stored !== i + 1 ? ` ← stored #${stored} WRONG` : ''
  console.log(`  #${i + 1}  ${p.name}  score=${Number(p.finalScore).toFixed(1)}${flag}`)
})

console.log('\nPre-round ranking for ROUND 2 (after round1):')
ranked2.forEach((p, i) => {
  const stored = round2.h2hSnapshot?.[p.name]?.preRoundRank
  const flag   = stored != null && stored !== i + 1 ? ` ← stored #${stored} WRONG` : ''
  console.log(`  #${i + 1}  ${p.name}  score=${Number(p.finalScore).toFixed(1)}${flag}`)
})

// ── Diagnostic: show what each key player's score would be at h2h ± offsets ─
console.log('\nDiagnostic — Bekis score sensitivity to h2hPointsStored:')
for (const adj of [-10, -5, 0, 5, 10]) {
  const testH2H = { ...preH2H_r1, Bekis: (preH2H_r1['Bekis'] || 0) + adj }
  const { ranked: tr } = calculateRankings(preRounds_r1, captainAwards, h2hAdjustments, preChallenges, testH2H)
  const bp = tr.find(p => p.name === 'Bekis')
  if (bp) console.log(`  h2h=${testH2H['Bekis']}  score=${Number(bp.finalScore).toFixed(1)}  rank=#${tr.findIndex(p => p.name === 'Bekis') + 1}`)
}

console.log('\n[dry-run mode — no changes will be written]')
process.exit(0)
