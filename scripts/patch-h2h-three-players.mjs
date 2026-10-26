/**
 * One-off patch: set h2hPointsStored for Maso, Miro M, and Poli to their
 * correct values. All other players are left exactly as they are.
 * No recomputation of any kind.
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
console.log('Current h2hPointsStored:', current)

const PATCH = { 'Maso': 0, 'Miro M': -13, 'Poli': -19 }

const updated = { ...current, ...PATCH }
console.log('Updated h2hPointsStored:', updated)

await updateDoc(ref, { h2hPointsStored: updated })
console.log('Done.')
process.exit(0)
