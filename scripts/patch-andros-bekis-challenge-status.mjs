/**
 * One-off patch: mark the Andros→Bekis challenge as completed (status: 'failed',
 * meaning Andros the challenger lost and Bekis won).
 *
 * challengerRank and challengedRanks are set to null so the ranking code
 * (which skips point calculation when either rank is null) does NOT award any
 * points from this record — the correct values are already in challengePointsStored.
 *
 * No other challenges, no other fields, no other data are touched.
 */
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

const TARGET_ID = 'ch-1785506415018-jnaea6f7lg'

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)
const ref = doc(db, 'golf', 'appData')

const snap = await getDoc(ref)
if (!snap.exists()) { console.error('Document not found'); process.exit(1) }

const challenges = snap.data().challengePointsStored  // just to verify we won't touch this
const allChallenges = snap.data().challenges || []

const target = allChallenges.find(c => c.id === TARGET_ID)
if (!target) { console.error('Challenge not found:', TARGET_ID); process.exit(1) }

console.log('Before:', JSON.stringify(target, null, 2))

const updated = allChallenges.map(c => {
  if (c.id !== TARGET_ID) return c  // leave all other challenges untouched
  return {
    ...c,
    status:          'failed',       // challenger (Andros) lost → Bekis won
    resolvedDate:    '2026-08-12',
    challengerRank:  null,           // null → ranking code skips point calculation
    challengedRanks: [null],         // null → ranking code skips point calculation
  }
})

console.log('After: ', JSON.stringify(updated.find(c => c.id === TARGET_ID), null, 2))

await updateDoc(ref, { challenges: updated })
console.log('Done.')
process.exit(0)
