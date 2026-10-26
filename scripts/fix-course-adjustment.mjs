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

const COURSES_TO_FIX = new Set([
  'Green Resort Hrubá Borša',
  'Schönfeld Rakúsko',
])

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)
const ref = doc(db, 'golf', 'appData')

const snap = await getDoc(ref)
if (!snap.exists()) { console.error('Document not found'); process.exit(1) }

const data   = snap.data()
const rounds = Array.isArray(data.rounds) ? data.rounds : []

let fixed = 0
const updated = rounds.map(round => {
  if (round.tee !== 'yellow' || !COURSES_TO_FIX.has(round.course)) return round

  console.log(`Fixing: ${round.date} – ${round.course} (${round.id})`)
  fixed++

  return {
    ...round,
    courseAdjustment: -3,
    players: round.players.map(p => ({
      ...p,
      adjustedStrokes: p.strokes * (p.is9holes ? 2 : 1) + (-3),
    })),
  }
})

if (fixed === 0) {
  console.log('No matching rounds found.')
  process.exit(0)
}

await updateDoc(ref, { rounds: updated })
console.log(`Done. Fixed ${fixed} round(s).`)
process.exit(0)
