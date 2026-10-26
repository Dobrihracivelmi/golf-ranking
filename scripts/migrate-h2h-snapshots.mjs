/**
 * One-time migration: backfill h2hSnapshot (delta, cumulative, preRoundRank)
 * on every round that is missing one, and rewrite h2hPointsStored as the
 * canonical sum of all stored deltas.
 *
 * Run ONCE after deploying the H2H-fix release:
 *   node scripts/migrate-h2h-snapshots.mjs
 *
 * Safe to run multiple times — rounds with an existing complete snapshot
 * (delta + cumulative + preRoundRank for every player) are skipped.
 * h2hPointsStored is always rewritten as the sum of all stored deltas.
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'
import { computeH2HDeltaForNewRound } from '../src/utils/ranking.js'

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

// ── Fetch ──────────────────────────────────────────────────────────────────
const snap = await getDoc(ref)
if (!snap.exists()) { console.error('Document not found'); process.exit(1) }
const data          = snap.data()
const allRounds     = Array.isArray(data.rounds)        ? data.rounds        : []
const captainAwards = Array.isArray(data.captainAwards) ? data.captainAwards : []

console.log(`Loaded ${allRounds.length} rounds, ${captainAwards.length} captain awards.`)

// ── Sort chronologically (same ordering as computeAllH2HPoints) ────────────
const chronological = [...allRounds].sort((a, b) => {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  return (a.id || '').localeCompare(b.id || '')
})

// ── Init per-player H2H accumulator ───────────────────────────────────────
const h2hPoints = {}
for (const round of allRounds) {
  for (const p of round.players) {
    if (h2hPoints[p.name] == null) h2hPoints[p.name] = 0
  }
}

// ── Process each round chronologically ────────────────────────────────────
const roundById   = Object.fromEntries(allRounds.map(r => [r.id, { ...r }]))
let   patchCount  = 0

for (let ri = 0; ri < chronological.length; ri++) {
  const round       = chronological[ri]
  const roundsBefore = chronological.slice(0, ri)

  // Check whether this round already has a complete snapshot
  const existingSnap = round.h2hSnapshot
  const players      = round.players
  const hasComplete  = existingSnap != null &&
    players.every(p => {
      const s = existingSnap[p.name]
      return s != null && s.delta != null && s.cumulative != null && s.preRoundRank != null
    })

  if (hasComplete) {
    // Trust the stored deltas; advance the accumulator
    for (const p of players) {
      const storedDelta = existingSnap[p.name].delta
      h2hPoints[p.name] = (h2hPoints[p.name] || 0) + storedDelta
    }
    continue
  }

  // Snapshot is missing or incomplete — compute it now
  const { delta, preRankMap } = computeH2HDeltaForNewRound(
    roundsBefore,
    round,
    { ...h2hPoints },   // pre-round accumulated H2H (snapshot of state before this round)
    captainAwards
  )

  // Advance the accumulator with the computed delta
  for (const name in delta) {
    h2hPoints[name] = (h2hPoints[name] || 0) + delta[name]
  }

  // Build the complete snapshot
  const newSnapshot = {}
  for (const p of players) {
    newSnapshot[p.name] = {
      delta:        delta[p.name]        ?? 0,
      cumulative:   h2hPoints[p.name]   ?? 0,
      preRoundRank: preRankMap[p.name]  ?? null,
    }
  }

  roundById[round.id] = { ...roundById[round.id], h2hSnapshot: newSnapshot }
  patchCount++
  console.log(`  Patched: ${round.date}  ${round.course}  (${round.id})`)
}

const updatedRounds = chronological.map(r => roundById[r.id])

console.log(`\nRounds patched: ${patchCount}`)
console.log('Final h2hPointsStored:', h2hPoints)

if (patchCount === 0 && JSON.stringify(h2hPoints) === JSON.stringify(data.h2hPointsStored || {})) {
  console.log('\nNothing changed — Firestore not updated.')
  process.exit(0)
}

// ── Write back ─────────────────────────────────────────────────────────────
await updateDoc(ref, {
  rounds:          updatedRounds,
  h2hPointsStored: h2hPoints,
})
console.log('\nFirestore updated successfully.')
process.exit(0)
