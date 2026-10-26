/**
 * One-off patch: set h2hPointsStored for Andros to +5.
 * All other players and all other fields are left exactly as they are.
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

const current = snap.data().h2hPointsStored || {}
console.log('Andros before:', current['Andros'])

const updated = { ...current, 'Andros': 5 }
await updateDoc(ref, { h2hPointsStored: updated })
console.log('Andros after: 5')
console.log('Done.')
process.exit(0)
