import { useState, useEffect, useRef } from 'react'
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

  // Tracks whether the first snapshot has arrived — only used to cancel the
  // timeout, never used to block subsequent real-time updates.
  const firstLoadDone = useRef(false)

  useEffect(() => {
    console.log('[useAppData] mounting, attaching onSnapshot')

    // Show a helpful error if Firestore never responds at all
    const timer = setTimeout(() => {
      if (!firstLoadDone.current) {
        console.error('[useAppData] timeout — Firestore did not respond in 12 s')
        setError(
          'Spojenie s databázou vypršalo (12 s). ' +
          'Skontrolujte Firestore pravidlá (allow read, write: if true) a projektId v src/firebase.js.'
        )
        setLoading(false)
      }
    }, 12000)

    const unsub = onSnapshot(
      DATA_REF,
      (snap) => {
        console.log('[useAppData] snapshot received, exists:', snap.exists())

        // Cancel the timeout the moment we hear back from Firestore
        if (!firstLoadDone.current) {
          clearTimeout(timer)
          firstLoadDone.current = true
        }

        if (snap.exists()) {
          const d = snap.data()
          console.log('[useAppData] rounds:', d.rounds?.length ?? 0,
            'categories:', d.captainCategories?.length ?? 0,
            'awards:', d.captainAwards?.length ?? 0)
          setData({
            rounds:            Array.isArray(d.rounds)            ? d.rounds            : [],
            captainCategories: Array.isArray(d.captainCategories) ? d.captainCategories : DEFAULT_CAPTAIN_CATEGORIES,
            captainAwards:     Array.isArray(d.captainAwards)     ? d.captainAwards     : [],
          })
        } else {
          console.log('[useAppData] document missing — seeding defaults')
          setDoc(DATA_REF, INITIAL_DATA).catch(err =>
            console.error('[useAppData] setDoc error:', err)
          )
          setData(INITIAL_DATA)
        }

        setError(null)   // clear any previous timeout error if Firestore eventually connects
        setLoading(false)
        console.log('[useAppData] loading set to false')
      },
      (err) => {
        console.error('[useAppData] onSnapshot error:', err.code, err.message)
        clearTimeout(timer)
        firstLoadDone.current = true
        setError(`Firestore: ${err.code} — ${err.message}`)
        setLoading(false)
      }
    )

    return () => {
      console.log('[useAppData] cleanup')
      clearTimeout(timer)
      unsub()
    }
  }, [])

  const update = (changes) =>
    updateDoc(DATA_REF, changes).catch(err =>
      console.error('[useAppData] updateDoc error:', err)
    )

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
