import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_CAPTAIN_CATEGORIES } from './utils/ranking'

const DATA_REF = doc(db, 'golf', 'appData')

const INITIAL_DATA = {
  rounds:            [],
  captainCategories: DEFAULT_CAPTAIN_CATEGORIES,
  captainAwards:     [],
}

const TIMEOUT_MS = 12000

export function useAppData() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let settled = false

    // If Firestore doesn't respond at all within 12 s, show a helpful error
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        setError(
          'Spojenie s databázou vypršalo (12 s). ' +
          'Skontrolujte: 1) Firestore pravidlá (allow read, write: if true) ' +
          '2) Firebase projectId v src/firebase.js ' +
          '3) Internetové pripojenie'
        )
        setLoading(false)
      }
    }, TIMEOUT_MS)

    const unsub = onSnapshot(
      DATA_REF,
      (snap) => {
        clearTimeout(timer)
        if (settled) return
        settled = true

        if (snap.exists()) {
          const d = snap.data()
          setData({
            rounds:            d.rounds            || [],
            captainCategories: d.captainCategories || DEFAULT_CAPTAIN_CATEGORIES,
            captainAwards:     d.captainAwards     || [],
          })
        } else {
          // First ever load — seed the document with defaults
          setDoc(DATA_REF, INITIAL_DATA).catch(err => {
            console.error('setDoc failed:', err)
          })
          setData(INITIAL_DATA)
        }
        setLoading(false)
      },
      (err) => {
        clearTimeout(timer)
        if (settled) return
        settled = true
        console.error('Firestore onSnapshot error:', err)
        setError(`Firestore chyba: ${err.code} — ${err.message}`)
        setLoading(false)
      }
    )

    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [])

  const update = (changes) =>
    updateDoc(DATA_REF, changes).catch(err => console.error('updateDoc failed:', err))

  const addRound = (round) => {
    const newRound = {
      ...round,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }
    update({ rounds: [...data.rounds, newRound] })
  }

  const deleteRound = (id) => {
    update({ rounds: data.rounds.filter(r => r.id !== id) })
  }

  const addCaptainAward = (award) => {
    update({ captainAwards: [...data.captainAwards, award] })
  }

  const addCaptainCategory = (cat) => {
    update({ captainCategories: [...data.captainCategories, cat] })
  }

  const editCaptainCategory = (cat) => {
    update({
      captainCategories: data.captainCategories.map(c => c.id === cat.id ? cat : c),
    })
  }

  const deleteCaptainCategory = (id) => {
    update({ captainCategories: data.captainCategories.filter(c => c.id !== id) })
  }

  return {
    data,
    loading,
    error,
    addRound,
    deleteRound,
    addCaptainAward,
    addCaptainCategory,
    editCaptainCategory,
    deleteCaptainCategory,
  }
}
