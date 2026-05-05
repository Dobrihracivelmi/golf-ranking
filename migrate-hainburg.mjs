// One-time migration: fix Hainburg white-tee courseAdjustment from 0 to -2
// and recalculate adjustedStrokes for affected players.
// Run with: node migrate-hainburg.mjs

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            'AIzaSyAB7WNY2CApH4k3sUKGq99SpE5NxoiOsu4',
  authDomain:        'golf-ranking-63716.firebaseapp.com',
  projectId:        'golf-ranking-63716',
  storageBucket:    'golf-ranking-63716.firebasestorage.app',
  messagingSenderId: '549351533657',
  appId:             '1:549351533657:web:a0ca7d0cf9e8300c6f1548',
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

const DATA_REF = doc(db, 'golf', 'appData')

const snap = await getDoc(DATA_REF)
if (!snap.exists()) {
  console.error('Document golf/appData not found.')
  process.exit(1)
}

const data   = snap.data()
const rounds = Array.isArray(data.rounds) ? data.rounds : []

let changed = 0
const updatedRounds = rounds.map(round => {
  if (round.course !== 'Hainburg' || round.tee !== 'white') return round
  if (round.courseAdjustment === -2) {
    console.log(`  [skip]  ${round.id} — already -2`)
    return round
  }

  const oldAdj = round.courseAdjustment ?? 0
  const newAdj = -2
  const delta  = newAdj - oldAdj   // typically -2

  const updatedPlayers = (round.players || []).map(p => ({
    ...p,
    adjustedStrokes: p.strokes + newAdj,
  }))

  console.log(
    `  [fix]   ${round.date} ${round.course} (${round.tee})` +
    `  courseAdj: ${oldAdj} → ${newAdj}` +
    `  players: ${updatedPlayers.map(p => `${p.name} ${p.strokes}→${p.adjustedStrokes}`).join(', ')}`
  )

  changed++
  return { ...round, courseAdjustment: newAdj, players: updatedPlayers }
})

if (changed === 0) {
  console.log('No rounds needed updating.')
  process.exit(0)
}

await updateDoc(DATA_REF, { rounds: updatedRounds })
console.log(`\nDone. Updated ${changed} round(s).`)
process.exit(0)
