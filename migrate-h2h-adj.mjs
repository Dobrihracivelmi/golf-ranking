// One-time migration: set h2hAdjustments for Maso (-1) and FF (+1)
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, updateDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            'AIzaSyAB7WNY2CApH4k3sUKGq99SpE5NxoiOsu4',
  authDomain:        'golf-ranking-63716.firebaseapp.com',
  projectId:         'golf-ranking-63716',
  storageBucket:     'golf-ranking-63716.firebasestorage.app',
  messagingSenderId: '549351533657',
  appId:             '1:549351533657:web:a0ca7d0cf9e8300c6f1548',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const ref = doc(db, 'golf', 'appData')
await updateDoc(ref, {
  h2hAdjustments: {
    'Maso': -1,
    'FF': 1,
  },
})

console.log('Done: h2hAdjustments set — Maso: -1, FF: +1')
process.exit(0)
