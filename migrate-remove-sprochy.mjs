// One-time migration: remove player "Šprochy" from all rounds and captain awards in Firestore.

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

const PLAYER = 'Šprochy'

const snap = await getDoc(DATA_REF)
if (!snap.exists()) { console.error('Document not found.'); process.exit(1) }

const data = snap.data()
const rounds = Array.isArray(data.rounds) ? data.rounds : []
const awards = Array.isArray(data.captainAwards) ? data.captainAwards : []

// Check rounds
const affectedRounds = rounds.filter(r => r.players.some(p => p.name === PLAYER))
console.log(`Rounds containing ${PLAYER}: ${affectedRounds.length}`)
for (const r of affectedRounds) {
  console.log(`  ${r.date} — ${r.course} (${r.players.map(p => p.name).join(', ')})`)
}

// Check awards
const affectedAwards = awards.filter(a => a.playerName === PLAYER)
console.log(`Captain awards for ${PLAYER}: ${affectedAwards.length}`)

// Check LD/NP
const ldRounds = rounds.filter(r => {
  const ld = Array.isArray(r.longestDrive) ? r.longestDrive : r.longestDrive ? [r.longestDrive] : []
  const np = Array.isArray(r.nearestPin) ? r.nearestPin : r.nearestPin ? [r.nearestPin] : []
  return ld.includes(PLAYER) || np.includes(PLAYER)
})
console.log(`Rounds with ${PLAYER} in LD/NP: ${ldRounds.length}`)

if (affectedRounds.length === 0 && affectedAwards.length === 0 && ldRounds.length === 0) {
  console.log(`\n${PLAYER} not found in Firestore. Nothing to do.`)
  process.exit(0)
}

// Clean up
const changes = {}

// Remove Šprochy from round player lists; remove entire round if Šprochy was the only player
const updatedRounds = rounds
  .map(r => {
    const hasPlayer = r.players.some(p => p.name === PLAYER)
    if (!hasPlayer) return r

    const newPlayers = r.players.filter(p => p.name !== PLAYER)
    if (newPlayers.length === 0) {
      console.log(`  [delete round] ${r.date} — ${r.course} (${PLAYER} was only player)`)
      return null // mark for removal
    }

    // Also clean LD/NP
    let ld = Array.isArray(r.longestDrive) ? r.longestDrive.filter(n => n !== PLAYER)
           : r.longestDrive === PLAYER ? [] : r.longestDrive ? [r.longestDrive] : []
    let np = Array.isArray(r.nearestPin) ? r.nearestPin.filter(n => n !== PLAYER)
           : r.nearestPin === PLAYER ? [] : r.nearestPin ? [r.nearestPin] : []

    console.log(`  [clean round] ${r.date} — ${r.course}: removed ${PLAYER} (${newPlayers.length} players remain)`)
    return { ...r, players: newPlayers, longestDrive: ld, nearestPin: np }
  })
  .filter(r => r !== null)

changes.rounds = updatedRounds

// Remove captain awards
if (affectedAwards.length > 0) {
  changes.captainAwards = awards.filter(a => a.playerName !== PLAYER)
  console.log(`  [clean awards] removed ${affectedAwards.length} award(s)`)
}

console.log(`\nSaving changes to Firestore...`)
await updateDoc(DATA_REF, changes)
console.log('Done.')
process.exit(0)
