import { useState } from 'react'
import { ALL_PLAYERS, fmtDate } from '../utils/ranking'

const EXPIRY_DAYS = 14

function expiryDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + EXPIRY_DAYS)
  return d.toISOString().split('T')[0]
}

function resolveStatus(ch) {
  if (ch.status === 'fulfilled' || ch.status === 'failed') return ch.status
  const today = new Date().toISOString().split('T')[0]
  if (expiryDate(ch.date) < today) return 'expired'
  return 'pending'
}

const STATUS_CFG = {
  pending:   { emoji: '🟡', label: 'Čakajúca' },
  fulfilled: { emoji: '✅', label: 'Splnená' },
  failed:    { emoji: '❌', label: 'Nevyšla' },
  expired:   { emoji: '⏰', label: 'Expirovaná' },
}

export default function ChallengesTab({
  challenges,
  captainAuth,
  onAdd,
  onDelete,
}) {
  const [challenger, setChallenger]   = useState('')
  const [challenged, setChallenged]   = useState([])
  const [date, setDate]               = useState(new Date().toISOString().split('T')[0])
  const [errors, setErrors]           = useState({})
  const [saved, setSaved]             = useState(false)

  const toggleChallenged = (name) => {
    setChallenged(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : prev.length < 3 ? [...prev, name] : prev
    )
  }

  const validate = () => {
    const errs = {}
    if (!challenger) errs.challenger = 'Vyberte vyzývateľa'
    if (challenged.length === 0) errs.challenged = 'Vyberte aspoň 1 vyzvaného'
    if (!date) errs.date = 'Vyberte dátum'
    if (challenged.includes(challenger)) errs.challenged = 'Vyzývateľ nemôže vyzvať sám seba'
    return errs
  }

  const handleSubmit = () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    onAdd({
      challenger,
      challenged,
      date,
      expiry: expiryDate(date),
    })

    setSaved(true)
    setTimeout(() => {
      setChallenger('')
      setChallenged([])
      setDate(new Date().toISOString().split('T')[0])
      setErrors({})
      setSaved(false)
    }, 1200)
  }

  // Group challenges by resolved status
  const withStatus = challenges.map(ch => ({ ...ch, resolved: resolveStatus(ch) }))
  const pending   = withStatus.filter(c => c.resolved === 'pending')
  const done      = withStatus.filter(c => c.resolved === 'fulfilled' || c.resolved === 'failed')
  const expired   = withStatus.filter(c => c.resolved === 'expired')

  return (
    <div>
      {/* Create challenge — captain only */}
      {captainAuth && (
        <div className="card">
          <div className="section-header">
            <h2 className="section-title">Nová výzva</h2>
          </div>

          <div className="round-form">
            <div className="form-group">
              <label className="form-label">Vyzývateľ</label>
              <select
                className={`form-input${errors.challenger ? ' input-error' : ''}`}
                value={challenger}
                onChange={e => { setChallenger(e.target.value); setErrors(er => ({ ...er, challenger: undefined })) }}
              >
                <option value="">— vybrať —</option>
                {ALL_PLAYERS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {errors.challenger && <span className="err-msg">{errors.challenger}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Vyzvaný (1–3 hráči)</label>
              <div className="ch-multi-select">
                {ALL_PLAYERS.filter(n => n !== challenger).map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`ch-pick-btn${challenged.includes(n) ? ' ch-pick-selected' : ''}`}
                    onClick={() => { toggleChallenged(n); setErrors(er => ({ ...er, challenged: undefined })) }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {errors.challenged && <span className="err-msg">{errors.challenged}</span>}
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Dátum výzvy</label>
                <input
                  type="date"
                  className={`form-input${errors.date ? ' input-error' : ''}`}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expirácia</label>
                <input
                  type="date"
                  className="form-input"
                  value={date ? expiryDate(date) : ''}
                  disabled
                />
              </div>
            </div>

            <button
              type="button"
              className={`submit-btn${saved ? ' submit-saved' : ''}`}
              onClick={handleSubmit}
              disabled={saved}
            >
              {saved ? '✓ Výzva vytvorená' : 'Vytvoriť výzvu'}
            </button>
          </div>
        </div>
      )}

      {/* Pending */}
      <ChallengeGroup
        title="Čakajúce výzvy"
        emoji="🟡"
        items={pending}
        captainAuth={captainAuth}
        onDelete={onDelete}
        emptyMsg="Žiadne aktívne výzvy"
      />

      {/* Completed */}
      <ChallengeGroup
        title="Uskutočnené výzvy"
        emoji="⚔️"
        items={done}
        captainAuth={captainAuth}
        onDelete={onDelete}
        emptyMsg="Žiadne uskutočnené výzvy"
      />

      {/* Expired */}
      <ChallengeGroup
        title="Expirované výzvy"
        emoji="⏰"
        items={expired}
        captainAuth={captainAuth}
        onDelete={onDelete}
        emptyMsg="Žiadne expirované výzvy"
      />
    </div>
  )
}

function daysRemaining(expiry) {
  const now   = new Date()
  const exp   = new Date(expiry + 'T23:59:59')
  const diff  = exp - now
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function ChallengeGroup({ title, emoji, items, captainAuth, onDelete, emptyMsg }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="section-header">
        <h2 className="section-title">{emoji} {title}</h2>
        <span className="section-meta">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="ch-empty">{emptyMsg}</p>
      ) : (
        <div className="ch-list">
          {items.map(ch => {
            const st = STATUS_CFG[ch.resolved]
            const exp = ch.expiry || expiryDate(ch.date)
            const remaining = daysRemaining(exp)
            return (
              <div key={ch.id} className="ch-card">
                <div className="ch-card-top">
                  <span className="ch-status-badge" title={st.label}>{st.emoji}</span>
                  <div className="ch-card-info">
                    <div className="ch-card-names">
                      <span className="ch-challenger">{ch.challenger}</span>
                      <span className="ch-arrow">→</span>
                      <span className="ch-challenged">{ch.challenged.join(', ')}</span>
                    </div>
                    <div className="ch-card-dates">
                      {fmtDate(ch.date)}
                      <span className="ch-date-sep">·</span>
                      expirácia {fmtDate(exp)}
                      {ch.resolved === 'pending' && (
                        <span className={`ch-countdown${remaining <= 3 ? ' ch-countdown-urgent' : ''}`}>
                          ({remaining} {remaining === 1 ? 'deň' : remaining >= 2 && remaining <= 4 ? 'dni' : 'dní'})
                        </span>
                      )}
                    </div>
                    {ch.roundId && (
                      <div className={`ch-card-result ${ch.resolved === 'fulfilled' ? 'ch-result-win' : 'ch-result-loss'}`}>
                        {ch.resolved === 'fulfilled'
                          ? `✅ ${ch.challenger} vyhral`
                          : `❌ ${ch.challenger} prehral`}
                      </div>
                    )}
                    {ch.resolved === 'expired' && (
                      <div className="ch-card-penalty">
                        ⚠️ Penalizácia −2 body: {ch.challenged.join(', ')}
                      </div>
                    )}
                  </div>
                  {captainAuth && (
                    <button
                      className="hc-delete"
                      onClick={() => {
                        if (window.confirm('Zmazať túto výzvu?')) onDelete(ch.id)
                      }}
                      title="Zmazať výzvu"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { resolveStatus, expiryDate }
