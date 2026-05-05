import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_CAPTAIN_CATEGORIES } from './utils/ranking'
import { generateCommentary } from './utils/generateCommentary'

const DATA_REF = doc(db, 'golf', 'appData')

const INITIAL_DATA = {
  rounds:            [],
  captainCategories: DEFAULT_CAPTAIN_CATEGORIES,
  captainAwards:     [],
  h2hAdjustments:    {},
  challenges:        [],
  claudeApiKey:      '',
}

export function useAppData() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Tracks whether the first snapshot has arrived — only used to cancel the
  // timeout, never used to block subsequent real-time updates.
  const firstLoadDone = useRef(false)

  // High-water mark: the maximum number of rounds ever seen from Firestore.
  // Used to guard against accidentally writing an empty/small array.
  const maxRoundsSeen = useRef(0)

  // Always points to latest data for use in async callbacks
  const dataRef = useRef(null)

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
          const rounds = Array.isArray(d.rounds) ? d.rounds : []
          console.log('[useAppData] rounds:', rounds.length,
            'categories:', d.captainCategories?.length ?? 0,
            'awards:', d.captainAwards?.length ?? 0)

          // Update high-water mark
          if (rounds.length > maxRoundsSeen.current) {
            maxRoundsSeen.current = rounds.length
          }

          const newData = {
            rounds,
            captainCategories: Array.isArray(d.captainCategories) ? d.captainCategories : DEFAULT_CAPTAIN_CATEGORIES,
            captainAwards:     Array.isArray(d.captainAwards)     ? d.captainAwards     : [],
            h2hAdjustments:    d.h2hAdjustments && typeof d.h2hAdjustments === 'object' ? d.h2hAdjustments : {},
            challenges:        Array.isArray(d.challenges) ? d.challenges : [],
            claudeApiKey:      d.claudeApiKey || '',
          }
          setData(newData)
          dataRef.current = newData
        } else {
          console.log('[useAppData] document missing — seeding defaults')
          setDoc(DATA_REF, INITIAL_DATA).catch(err =>
            console.error('[useAppData] setDoc error:', err)
          )
          setData(INITIAL_DATA)
          dataRef.current = INITIAL_DATA
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

  // Safe update: blocks writes if initial load hasn't completed
  const update = (changes) => {
    if (!firstLoadDone.current || !data) {
      console.error('[useAppData] update blocked — data not loaded yet')
      return Promise.resolve()
    }
    return updateDoc(DATA_REF, changes).catch(err =>
      console.error('[useAppData] updateDoc error:', err)
    )
  }

  // Safe rounds write: guards against writing a suspiciously small array
  const safeUpdateRounds = (newRounds) => {
    const dropping = maxRoundsSeen.current - newRounds.length
    if (dropping > 1) {
      console.error(
        `[useAppData] BLOCKED: attempted to write ${newRounds.length} rounds ` +
        `but high-water mark is ${maxRoundsSeen.current} (would lose ${dropping} rounds)`
      )
      return Promise.resolve()
    }
    return update({ rounds: newRounds })
  }

  const addRound = (round) => {
    const newRound = {
      ...round,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }
    const allRounds = [...data.rounds, newRound]
    safeUpdateRounds(allRounds)

    // Generate AI commentary in background
    const apiKey = data.claudeApiKey
    if (apiKey) {
      console.log('[useAppData] generating AI commentary...')
    }
    generateCommentary(newRound, allRounds, data.captainAwards, apiKey)
      .then(aiComment => {
        if (!aiComment) return
        console.log('[useAppData] commentary received, saving...')
        const latest = dataRef.current
        if (!latest) return
        const updated = latest.rounds.map(r =>
          r.id === newRound.id ? { ...r, aiComment } : r
        )
        updateDoc(DATA_REF, { rounds: updated }).catch(err =>
          console.error('[useAppData] commentary save error:', err)
        )
      })
  }

  const deleteRound = (id) => {
    safeUpdateRounds(data.rounds.filter(r => r.id !== id))
  }

  const addCaptainAward = (award) => {
    update({ captainAwards: [...data.captainAwards, award] })
  }

  const deleteCaptainAward = (id) => {
    update({ captainAwards: data.captainAwards.filter(a => a.id !== id) })
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

  const addChallenge = (challenge) => {
    const newChallenge = {
      ...challenge,
      id: `ch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: 'pending',
    }
    update({ challenges: [...data.challenges, newChallenge] })
  }

  const updateChallenge = (id, changes) => {
    update({ challenges: data.challenges.map(c => c.id === id ? { ...c, ...changes } : c) })
  }

  const deleteChallenge = (id) => {
    update({ challenges: data.challenges.filter(c => c.id !== id) })
  }

  const setClaudeApiKey = (key) => {
    update({ claudeApiKey: key })
  }

  const restoreData = (backup) => {
    if (!firstLoadDone.current || !data) {
      console.error('[useAppData] restore blocked — data not loaded yet')
      return Promise.resolve()
    }
    // Update high-water mark to allow the restore write
    maxRoundsSeen.current = backup.rounds.length
    return updateDoc(DATA_REF, {
      rounds:            backup.rounds,
      captainAwards:     backup.captainAwards,
      captainCategories: backup.captainCategories,
    }).catch(err => console.error('[useAppData] restoreData error:', err))
  }

  return {
    data,
    loading,
    error,
    addRound,
    deleteRound,
    addCaptainAward,
    deleteCaptainAward,
    addCaptainCategory,
    editCaptainCategory,
    deleteCaptainCategory,
    addChallenge,
    updateChallenge,
    deleteChallenge,
    setClaudeApiKey,
    restoreData,
  }
}
