import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_CAPTAIN_CATEGORIES, computeH2HDeltaForNewRound } from './utils/ranking'
import { generateCommentary } from './utils/generateCommentary'

const DATA_REF = doc(db, 'golf', 'appData')

const INITIAL_DATA = {
  rounds:                [],
  captainCategories:     DEFAULT_CAPTAIN_CATEGORIES,
  captainAwards:         [],
  h2hAdjustments:        {},
  h2hPointsStored:       {},
  challengePointsStored: {},
  challenges:            [],
  claudeApiKey:          '',
}

export function useAppData() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Tracks whether the first snapshot has arrived — only used to cancel the
  // timeout, never used to block subsequent real-time updates.
  const firstLoadDone = useRef(false)

  // Ensures commentary recovery runs at most once per session
  const commentaryRecoveryDone = useRef(false)

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
        console.log('[useAppData] snapshot received, exists:', snap.exists(), 'fromCache:', snap.metadata.fromCache)

        // A cache-only snapshot saying the document is missing is not a real
        // signal — skip it entirely and keep the loading spinner up while we
        // wait for the authoritative server snapshot.
        if (!snap.exists() && snap.metadata.fromCache) {
          console.warn('[useAppData] ignoring cache-only missing-document snapshot — waiting for server')
          return
        }

        // Cancel the timeout the moment we hear back from Firestore (server or
        // a cache hit that actually has data)
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

          const captainAwards = Array.isArray(d.captainAwards) ? d.captainAwards : []
          let h2hPointsStored = d.h2hPointsStored && typeof d.h2hPointsStored === 'object' ? d.h2hPointsStored : {}

          // Guard: h2hPointsStored must be populated via the migration script,
          // never auto-seeded at runtime (that would recompute with current
          // captain awards, corrupting historical pre-round rankings).
          if (rounds.length > 0 && Object.keys(h2hPointsStored).length === 0) {
            console.warn('[useAppData] h2hPointsStored is empty — run scripts/migrate-h2h-snapshots.mjs to populate')
          }

          const newData = {
            rounds,
            captainCategories:     Array.isArray(d.captainCategories) ? d.captainCategories : DEFAULT_CAPTAIN_CATEGORIES,
            captainAwards,
            h2hAdjustments:        d.h2hAdjustments && typeof d.h2hAdjustments === 'object' ? d.h2hAdjustments : {},
            h2hPointsStored,
            challengePointsStored: d.challengePointsStored && typeof d.challengePointsStored === 'object' ? d.challengePointsStored : {},
            challenges:            Array.isArray(d.challenges) ? d.challenges : [],
            claudeApiKey:          d.claudeApiKey || '',
          }
          setData(newData)
          dataRef.current = newData

          // Recovery: on first load, generate commentary for recent rounds that
          // are missing it (covers the case where the user closed the tab before
          // the background API call completed after adding a round).
          if (!commentaryRecoveryDone.current && d.claudeApiKey) {
            commentaryRecoveryDone.current = true
            const sorted = [...rounds].sort((a, b) => b.date.localeCompare(a.date))
            const missing = sorted.filter(r => !r.aiComment).slice(0, 3)
            for (const round of missing) {
              console.log('[useAppData] recovering commentary for', round.date, round.course)
              generateCommentary(round, rounds, captainAwards, d.claudeApiKey)
                .then(aiComment => {
                  if (!aiComment) return
                  const latest = dataRef.current
                  if (!latest) return
                  const updated = latest.rounds.map(r =>
                    r.id === round.id ? { ...r, aiComment } : r
                  )
                  updateDoc(DATA_REF, { rounds: updated }).catch(err =>
                    console.error('[useAppData] commentary recovery save error:', err)
                  )
                })
                .catch(err => console.error('[useAppData] commentary recovery error:', err))
            }
          }
        } else {
          // Document is missing. Guard against two distinct false-positive cases:
          //
          // Case 1 — fromCache: true
          //   The Firestore SDK is reporting from its local IndexedDB cache, which
          //   is empty (e.g. after clearing browser cache). The server has NOT yet
          //   responded. The real document likely exists on the server and will
          //   arrive in the next snapshot. Never seed here.
          //
          // Case 2 — maxRoundsSeen > 0
          //   We already received real rounds earlier this session. A subsequent
          //   missing snapshot is a transient glitch or accidental deletion.
          //   Never overwrite data we already know exists.
          //
          // Only seed when BOTH conditions are clear: server-confirmed missing
          // (fromCache === false) AND we have never seen any data this session.
          if (snap.metadata.fromCache) {
            console.warn(
              '[useAppData] BLOCKED seed: document missing but snapshot is from local cache — waiting for server confirmation'
            )
          } else if (maxRoundsSeen.current > 0) {
            console.error(
              '[useAppData] BLOCKED seed: document missing but maxRoundsSeen =',
              maxRoundsSeen.current,
              '— refusing to overwrite with INITIAL_DATA'
            )
          } else {
            console.log('[useAppData] server-confirmed missing document, no prior data seen — seeding defaults')
            setDoc(DATA_REF, INITIAL_DATA).catch(err =>
              console.error('[useAppData] setDoc error:', err)
            )
            setData(INITIAL_DATA)
            dataRef.current = INITIAL_DATA
          }
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

    // Compute H2H delta + pre-round rank map for the new round.
    // Pass the full set of inputs so the pre-round ranking exactly matches
    // what calculateRankings shows in the VÝSLEDOK column.
    const { delta: h2hDelta, preRankMap } = computeH2HDeltaForNewRound(
      data.rounds, newRound, data.h2hPointsStored, data.captainAwards,
      data.h2hAdjustments, data.challenges, data.challengePointsStored
    )
    const newH2H = { ...data.h2hPointsStored }
    for (const name in h2hDelta) {
      newH2H[name] = (newH2H[name] || 0) + h2hDelta[name]
    }
    // Ensure all players in the new round have an entry
    for (const p of newRound.players) {
      if (newH2H[p.name] == null) newH2H[p.name] = 0
    }

    // Embed per-player H2H snapshot: delta, cumulative, and pre-round rank
    // (stored permanently so they never need to be recomputed)
    const h2hSnapshot = {}
    for (const p of newRound.players) {
      h2hSnapshot[p.name] = {
        delta:        h2hDelta[p.name]   ?? 0,
        cumulative:   newH2H[p.name]     ?? 0,
        preRoundRank: preRankMap[p.name] ?? null,
      }
    }
    const savedRound = { ...newRound, h2hSnapshot }
    const allRounds  = [...data.rounds, savedRound]

    // Save rounds + H2H together
    const dropping = maxRoundsSeen.current - allRounds.length
    if (dropping > 1) {
      console.error(`[useAppData] BLOCKED: would lose ${dropping} rounds`)
      return
    }
    update({ rounds: allRounds, h2hPointsStored: newH2H })

    // Generate AI commentary in background
    const apiKey = data.claudeApiKey
    if (apiKey) {
      console.log('[useAppData] generating AI commentary...')
    }
    generateCommentary(savedRound, allRounds, data.captainAwards, apiKey)
      .then(aiComment => {
        if (!aiComment) return
        console.log('[useAppData] commentary received, saving...')
        const latest = dataRef.current
        if (!latest) return
        const updated = latest.rounds.map(r =>
          r.id === savedRound.id ? { ...r, aiComment } : r
        )
        updateDoc(DATA_REF, { rounds: updated }).catch(err =>
          console.error('[useAppData] commentary save error:', err)
        )
      })
  }

  const deleteRound = (id) => {
    const round     = data.rounds.find(r => r.id === id)
    const remaining = data.rounds.filter(r => r.id !== id)
    const dropping  = maxRoundsSeen.current - remaining.length
    if (dropping > 1) {
      console.error(`[useAppData] BLOCKED: would lose ${dropping} rounds`)
      return
    }

    const snapshot = round?.h2hSnapshot
    if (!snapshot) {
      // Round has no snapshot — cannot reverse its H2H delta safely.
      // Delete the round without touching H2H; run migration script to fix.
      console.warn('[useAppData] deleteRound: round', id, 'has no h2hSnapshot — H2H left unchanged, run scripts/migrate-h2h-snapshots.mjs')
      update({ rounds: remaining })
      return
    }

    // Subtract each player's stored delta to reverse the H2H effect of this round
    const newH2H = { ...data.h2hPointsStored }
    for (const name in snapshot) {
      if (newH2H[name] != null) {
        newH2H[name] -= snapshot[name].delta
      }
    }
    update({ rounds: remaining, h2hPointsStored: newH2H })
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
    maxRoundsSeen.current = backup.rounds.length
    // Restore h2hPointsStored directly from the backup — never recompute.
    // If the backup is old and lacks h2hPointsStored, write {} and warn; the
    // migration script must be run afterwards to populate the stored values.
    const restoredH2H = (backup.h2hPointsStored && typeof backup.h2hPointsStored === 'object')
      ? backup.h2hPointsStored
      : {}
    if (Object.keys(restoredH2H).length === 0) {
      console.warn('[useAppData] restoreData: backup has no h2hPointsStored — run scripts/migrate-h2h-snapshots.mjs after restore')
    }
    return updateDoc(DATA_REF, {
      rounds:            backup.rounds,
      captainAwards:     backup.captainAwards,
      captainCategories: backup.captainCategories,
      challenges:        Array.isArray(backup.challenges) ? backup.challenges : [],
      h2hPointsStored:   restoredH2H,
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
