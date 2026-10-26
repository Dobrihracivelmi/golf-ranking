/**
 * One-off patch: restore challengePointsStored to correct values after an
 * accidental double-application of deltas, and set Bekis to +1 (from -1).
 *
 * Correct final state:
 *   Andros: +2  (was accidentally set to +4)
 *   Poli:   -3  (was accidentally set to -6)
 *   Bekis:  +1  (was -1, this is the intended change)
 *
 * Sets exact values — does NOT add deltas. All other keys untouched.
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

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)
const ref = doc(db, 'golf', 'appData')

const snap = await getDoc(ref)
if (!snap.exists()) { console.error('Document not found'); process.exit(1) }

const current = snap.data().challengePointsStored || {}
console.log('Before:', current)

const updated = { ...current, 'Andros': 2, 'Poli': -3, 'Bekis': 1 }
console.log('After: ', updated)

await updateDoc(ref, { challengePointsStored: updated })
console.log('Done.')
process.exit(0)
