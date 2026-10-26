import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc } from 'firebase/firestore'

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
if (!snap.exists()) {
  console.error('❌ Document golf/appData does NOT exist in Firestore')
  process.exit(1)
}

const data = snap.data()
const rounds = Array.isArray(data.rounds) ? data.rounds : []
const awards = Array.isArray(data.captainAwards) ? data.captainAwards : []
const challenges = Array.isArray(data.challenges) ? data.challenges : []

console.log('=== Firestore golf/appData ===')
console.log(`rounds:          ${rounds.length}`)
console.log(`captainAwards:   ${awards.length}`)
console.log(`challenges:      ${challenges.length}`)
console.log(`h2hPointsStored: ${Object.keys(data.h2hPointsStored || {}).length} players`)
console.log(`claudeApiKey:    ${data.claudeApiKey ? 'set' : 'empty'}`)

if (rounds.length > 0) {
  const sorted = [...rounds].sort((a, b) => b.date.localeCompare(a.date))
  console.log('\n--- Most recent 5 rounds ---')
  for (const r of sorted.slice(0, 5)) {
    const players = r.players.map(p => `${p.name}(${p.adjustedStrokes ?? p.strokes})`).join(', ')
    console.log(`  ${r.date}  ${r.course}  [${players}]`)
  }
  console.log('\n--- Oldest 3 rounds ---')
  for (const r of sorted.slice(-3)) {
    const players = r.players.map(p => `${p.name}(${p.adjustedStrokes ?? p.strokes})`).join(', ')
    console.log(`  ${r.date}  ${r.course}  [${players}]`)
  }
} else {
  console.log('\n⚠️  rounds array is EMPTY')
}

process.exit(0)
