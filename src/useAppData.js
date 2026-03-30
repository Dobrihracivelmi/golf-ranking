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

export function useAppData() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      DATA_REF,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setData({
            rounds:            d.rounds            || [],
            captainCategories: d.captainCategories || DEFAULT_CAPTAIN_CATEGORIES,
            captainAwards:     d.captainAwards     || [],
          })
        } else {
          // First ever load — seed the document with defaults
          setDoc(DATA_REF, INITIAL_DATA)
          setData(INITIAL_DATA)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Firestore error:', err)
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const update = (changes) => updateDoc(DATA_REF, changes)

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
