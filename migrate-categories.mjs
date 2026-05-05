// One-time migration: add Longest Drive and Nearest to the Pin categories
// to existing Firestore captainCategories if not already present.

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

const newCategories = [
  { id: 'def-8', name: 'Longest Drive',      emoji: '🏌️', points: 1 },
  { id: 'def-9', name: 'Nearest to the Pin', emoji: '📍', points: 1 },
]

const snap = await getDoc(DATA_REF)
if (!snap.exists()) {
  console.error('Document golf/appData not found.')
  process.exit(1)
}

const data = snap.data()
const categories = Array.isArray(data.captainCategories) ? data.captainCategories : []

const existingIds = new Set(categories.map(c => c.id))
const toAdd = newCategories.filter(c => !existingIds.has(c.id))

if (toAdd.length === 0) {
  console.log('Both categories already exist in Firestore. Nothing to do.')
  process.exit(0)
}

const updated = [...categories, ...toAdd]
await updateDoc(DATA_REF, { captainCategories: updated })
console.log(`Added ${toAdd.length} category(ies): ${toAdd.map(c => `${c.emoji} ${c.name}`).join(', ')}`)
console.log(`Total categories now: ${updated.length}`)
process.exit(0)
