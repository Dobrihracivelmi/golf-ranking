import { useState } from 'react'
import { ALL_PLAYERS, fmtDate } from '../utils/ranking'

export default function CaptainPanel({
  categories,
  awards,
  rounds,
  onAddAward,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onDeleteAward,
  onRestore,
  claudeApiKey,
  onSetClaudeApiKey,
}) {
  const [activeTab, setActiveTab] = useState('award')

  // ── Award form state ──────────────────────────────────────────────────────
  const [selectedPlayer,   setSelectedPlayer]   = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [pointsOverride,   setPointsOverride]   = useState('')
  const [reason,           setReason]           = useState('')
  const [awardSaved,       setAwardSaved]       = useState(false)
  const [awardErrors,      setAwardErrors]      = useState({})

  // ── API key state ─────────────────────────────────────────────────────────
  const [apiKeyInput, setApiKeyInput] = useState(claudeApiKey || '')
  const [apiKeySaved, setApiKeySaved] = useState(false)

  // ── Category form state ───────────────────────────────────────────────────
  const [showCatForm,  setShowCatForm]  = useState(false)
  const [editingCat,   setEditingCat]   = useState(null)
  const [catEmoji,     setCatEmoji]     = useState('')
  const [catName,      setCatName]      = useState('')
  const [catPoints,    setCatPoints]    = useState('')
  const [catErrors,    setCatErrors]    = useState({})

  // ── Award handlers ────────────────────────────────────────────────────────
  const handleAwardSubmit = () => {
    const errs = {}
    if (!selectedPlayer)   errs.player   = 'Vyberte hráča'
    if (!selectedCategory) errs.category = 'Vyberte kategóriu'
    const pts = Number(pointsOverride)
    if (pointsOverride === '' || isNaN(pts) || pts === 0 || Math.abs(pts) > 3) {
      errs.points = 'Zadajte body od -3 do +3 (nie 0)'
    }
    if (Object.keys(errs).length) { setAwardErrors(errs); return }

    onAddAward({
      id:            `award-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      playerName:    selectedPlayer,
      categoryId:    selectedCategory.id,
      categoryName:  selectedCategory.name,
      categoryEmoji: selectedCategory.emoji,
      reason:        reason.trim(),
      points:        pts,
      date:          new Date().toISOString().split('T')[0],
      timestamp:     Date.now(),
    })

    setAwardSaved(true)
    setTimeout(() => {
      setAwardSaved(false)
      setSelectedPlayer('')
      setSelectedCategory(null)
      setPointsOverride('')
      setReason('')
      setAwardErrors({})
    }, 1600)
  }

  // ── Category handlers ─────────────────────────────────────────────────────
  const handleSaveCat = () => {
    const errs = {}
    if (!catEmoji.trim())  errs.emoji  = 'Zadajte emoji'
    if (!catName.trim())   errs.name   = 'Zadajte názov'
    const pts = Number(catPoints)
    if (!catPoints || isNaN(pts) || pts === 0) errs.points = 'Zadajte platné body (≠ 0)'
    if (Object.keys(errs).length) { setCatErrors(errs); return }

    if (editingCat) {
      onEditCategory({ ...editingCat, emoji: catEmoji.trim(), name: catName.trim(), points: pts })
    } else {
      onAddCategory({
        id:     `cat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        emoji:  catEmoji.trim(),
        name:   catName.trim(),
        points: pts,
      })
    }
    resetCatForm()
  }

  const handleEditCat = (cat) => {
    setEditingCat(cat)
    setCatEmoji(cat.emoji)
    setCatName(cat.name)
    setCatPoints(String(cat.points))
    setCatErrors({})
    setShowCatForm(true)
  }

  const resetCatForm = () => {
    setShowCatForm(false)
    setEditingCat(null)
    setCatEmoji(''); setCatName(''); setCatPoints('')
    setCatErrors({})
  }

  const clearCatErr = (field) =>
    setCatErrors(prev => { const n = {...prev}; delete n[field]; return n })

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="captain-panel">

      {/* Header */}
      <div className="captain-panel-header">
        <span className="captain-panel-crown">👑</span>
        <div>
          <div className="captain-panel-name">Kapitánsky panel</div>
          <div className="captain-panel-sub">Bekis</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="cpanel-tabs">
        <button
          className={`cpanel-tab${activeTab === 'award' ? ' cpanel-tab-active' : ''}`}
          onClick={() => setActiveTab('award')}
        >
          🏅 Prideliť body
        </button>
        <button
          className={`cpanel-tab${activeTab === 'history' ? ' cpanel-tab-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 História
        </button>
        <button
          className={`cpanel-tab${activeTab === 'categories' ? ' cpanel-tab-active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          🗂 Kategórie
        </button>
        <button
          className={`cpanel-tab${activeTab === 'backup' ? ' cpanel-tab-active' : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          💾 Záloha
        </button>
      </div>

      {/* ── Award tab ── */}
      {activeTab === 'award' && (
        <div className="cpanel-award">

          {/* Player selector */}
          <div className="form-group">
            <label className="form-label">Hráč</label>
            <select
              className={`form-input${awardErrors.player ? ' input-error' : ''}`}
              value={selectedPlayer}
              onChange={e => {
                setSelectedPlayer(e.target.value)
                setAwardErrors(prev => { const n = {...prev}; delete n.player; return n })
              }}
            >
              <option value="">Vybrať hráča…</option>
              {ALL_PLAYERS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {awardErrors.player && <span className="err-msg">{awardErrors.player}</span>}
          </div>

          {/* Category quick-pick */}
          <div className="form-group">
            <label className="form-label">Kategória</label>
            {awardErrors.category && <span className="err-msg">{awardErrors.category}</span>}
            <div className="cat-grid">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`cat-pick-btn${selectedCategory?.id === cat.id ? ' cat-pick-selected' : ''}`}
                  onClick={() => {
                    const next = selectedCategory?.id === cat.id ? null : cat
                    setSelectedCategory(next)
                    setPointsOverride(next ? String(next.points) : '')
                    setAwardErrors(prev => { const n = {...prev}; delete n.category; delete n.points; return n })
                  }}
                >
                  <span className="cat-pick-emoji">{cat.emoji}</span>
                  <span className="cat-pick-name">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Points override */}
          {selectedCategory && (
            <div className="form-group">
              <label className="form-label">
                Body&nbsp;<span className="form-label-opt">(-3 až +3)</span>
              </label>
              <input
                type="number"
                className={`form-input text-center points-override-input${awardErrors.points ? ' input-error' : ''}`}
                value={pointsOverride}
                min="-3"
                max="3"
                onChange={e => {
                  setPointsOverride(e.target.value)
                  setAwardErrors(prev => { const n = {...prev}; delete n.points; return n })
                }}
              />
              {awardErrors.points && <span className="err-msg">{awardErrors.points}</span>}
            </div>
          )}

          {/* Reason */}
          <div className="form-group">
            <label className="form-label">
              Dôvod&nbsp;<span className="form-label-opt">(voliteľné)</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Prečo si udeľuješ tieto body…"
            />
          </div>

          {/* Preview */}
          {selectedPlayer && selectedCategory && pointsOverride !== '' && !isNaN(Number(pointsOverride)) && Number(pointsOverride) !== 0 && (
            <div className="award-preview">
              <span className="award-preview-player">{selectedPlayer}</span>
              <span className="award-preview-sep">→</span>
              <span>{selectedCategory.emoji} {selectedCategory.name}</span>
              <span className={`award-preview-pts ${Number(pointsOverride) > 0 ? 'pos' : 'neg'}`}>
                {Number(pointsOverride) > 0 ? `+${pointsOverride}` : pointsOverride} bodov
              </span>
            </div>
          )}

          <button
            className={`submit-btn${awardSaved ? ' submit-saved' : ''}`}
            disabled={awardSaved}
            onClick={handleAwardSubmit}
          >
            {awardSaved ? '✓ Body udelené!' : 'Udeliť body'}
          </button>
        </div>
      )}

      {/* ── History tab ── */}
      {activeTab === 'history' && (
        <div className="cpanel-history">
          {awards.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-icon">👑</div>
              <h2>Žiadne body ešte neudelené</h2>
              <p>Použite záložku „Prideliť body" pre prvé udelenie.</p>
            </div>
          ) : (
            <>
              <div className="section-header" style={{ marginBottom: 12 }}>
                <span className="section-title" style={{ fontSize: '0.95rem' }}>
                  Všetky kapitánske body
                </span>
                <span className="section-meta">{awards.length} záznamov</span>
              </div>
              <div className="awards-list">
                {[...awards].sort((a, b) => b.timestamp - a.timestamp).map(award => (
                  <div key={award.id} className="award-item">
                    <div className="ai-left">
                      <span className="ai-emoji">{award.categoryEmoji}</span>
                      <div className="ai-info">
                        <div className="ai-top">
                          <span className="ai-player">{award.playerName}</span>
                          <span className="ai-cat">{award.categoryName}</span>
                        </div>
                        {award.reason && (
                          <div className="ai-reason">„{award.reason}"</div>
                        )}
                        <div className="ai-date">{fmtDate(award.date)}</div>
                      </div>
                    </div>
                    <span className={`ai-pts ${award.points > 0 ? 'pos' : 'neg'}`}>
                      {award.points > 0 ? `+${award.points}` : award.points}
                    </span>
                    <button
                      className="ai-delete"
                      onClick={() => {
                        if (window.confirm(`Zmazať body: ${award.categoryEmoji} ${award.categoryName} pre ${award.playerName}?`)) {
                          onDeleteAward(award.id)
                        }
                      }}
                      title="Zmazať"
                    >🗑</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Categories tab ── */}
      {activeTab === 'categories' && (
        <div className="cpanel-categories">
          <div className="cats-list">
            {categories.map(cat => (
              <div key={cat.id} className="cat-row">
                <span className="cat-row-emoji">{cat.emoji}</span>
                <span className="cat-row-name">{cat.name}</span>
                <span className={`cat-row-pts ${cat.points > 0 ? 'pos' : 'neg'}`}>
                  {cat.points > 0 ? `+${cat.points}` : cat.points}
                </span>
                <div className="cat-row-actions">
                  <button
                    className="cat-action-btn"
                    onClick={() => handleEditCat(cat)}
                    title="Upraviť"
                  >✏️</button>
                  <button
                    className="cat-action-btn cat-action-del"
                    onClick={() => {
                      if (window.confirm(`Zmazať kategóriu „${cat.emoji} ${cat.name}"?`)) {
                        onDeleteCategory(cat.id)
                      }
                    }}
                    title="Zmazať"
                  >🗑</button>
                </div>
              </div>
            ))}
          </div>

          {!showCatForm ? (
            <button
              className="add-player-btn"
              style={{ marginTop: 12 }}
              onClick={() => { setEditingCat(null); setCatEmoji(''); setCatName(''); setCatPoints(''); setCatErrors({}); setShowCatForm(true) }}
            >
              + Pridať kategóriu
            </button>
          ) : (
            <div className="cat-form-box">
              <h3 className="section-title-sm" style={{ marginBottom: 12 }}>
                {editingCat ? 'Upraviť kategóriu' : 'Nová kategória'}
              </h3>
              <div className="cat-form-row">
                <div className="form-group" style={{ width: 70 }}>
                  <label className="form-label">Emoji</label>
                  <input
                    type="text"
                    className={`form-input text-center${catErrors.emoji ? ' input-error' : ''}`}
                    value={catEmoji}
                    onChange={e => { setCatEmoji(e.target.value); clearCatErr('emoji') }}
                    placeholder="🏆"
                    maxLength={2}
                  />
                  {catErrors.emoji && <span className="err-msg">{catErrors.emoji}</span>}
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Názov</label>
                  <input
                    type="text"
                    className={`form-input${catErrors.name ? ' input-error' : ''}`}
                    value={catName}
                    onChange={e => { setCatName(e.target.value); clearCatErr('name') }}
                    placeholder="Názov kategórie"
                  />
                  {catErrors.name && <span className="err-msg">{catErrors.name}</span>}
                </div>
                <div className="form-group" style={{ width: 86 }}>
                  <label className="form-label">Body</label>
                  <input
                    type="number"
                    className={`form-input text-center${catErrors.points ? ' input-error' : ''}`}
                    value={catPoints}
                    onChange={e => { setCatPoints(e.target.value); clearCatErr('points') }}
                    placeholder="+2"
                  />
                  {catErrors.points && <span className="err-msg">{catErrors.points}</span>}
                </div>
              </div>
              <div className="cat-form-actions">
                <button className="submit-btn" onClick={handleSaveCat}>
                  {editingCat ? 'Uložiť zmeny' : 'Vytvoriť'}
                </button>
                <button className="cancel-btn" onClick={resetCatForm}>
                  Zrušiť
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Backup tab ── */}
      {activeTab === 'backup' && (
        <div className="cpanel-backup">
          <div className="backup-section">
            <h3 className="section-title-sm">📥 Zálohovať dáta</h3>
            <p className="backup-desc">Stiahne JSON súbor so všetkými dátami (kolá, body, kategórie).</p>
            <button
              className="submit-btn"
              onClick={() => {
                const payload = {
                  rounds:            rounds || [],
                  captainAwards:     awards || [],
                  captainCategories: categories || [],
                  exportedAt:        new Date().toISOString(),
                }
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement('a')
                const date = new Date().toISOString().split('T')[0]
                a.href     = url
                a.download = `golf-zaloha-${date}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              📥 Zálohovať dáta
            </button>
          </div>

          <div className="backup-section">
            <h3 className="section-title-sm">📤 Obnoviť zo zálohy</h3>
            <p className="backup-desc">Nahrá dáta z predtým exportovaného JSON súboru. Prepíše všetky aktuálne dáta.</p>
            <label className="submit-btn backup-upload-btn">
              📤 Obnoviť zo zálohy
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (evt) => {
                    try {
                      const parsed = JSON.parse(evt.target.result)
                      if (!Array.isArray(parsed.rounds) || !Array.isArray(parsed.captainAwards) || !Array.isArray(parsed.captainCategories)) {
                        alert('Neplatný formát zálohy. Súbor musí obsahovať rounds, captainAwards a captainCategories.')
                        return
                      }
                      if (window.confirm(
                        `Naozaj chceš obnoviť dáta?\n\n` +
                        `Záloha obsahuje ${parsed.rounds.length} kôl, ${parsed.captainAwards.length} bodov, ${parsed.captainCategories.length} kategórií.\n\n` +
                        `Toto prepíše všetky aktuálne dáta.`
                      )) {
                        onRestore(parsed)
                      }
                    } catch {
                      alert('Chyba pri čítaní súboru. Uistite sa, že ide o platný JSON.')
                    }
                  }
                  reader.readAsText(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          <div className="backup-section">
            <h3 className="section-title-sm">🤖 AI Komentátor (Claude API)</h3>
            <p className="backup-desc">Zadajte Anthropic API kľúč pre automatické generovanie komentárov po každom kole.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                className="form-input"
                value={apiKeyInput}
                onChange={e => { setApiKeyInput(e.target.value); setApiKeySaved(false) }}
                placeholder="sk-ant-api03-..."
                style={{ flex: 1 }}
              />
              <button
                className={`submit-btn${apiKeySaved ? ' submit-saved' : ''}`}
                style={{ whiteSpace: 'nowrap' }}
                disabled={apiKeySaved}
                onClick={() => {
                  onSetClaudeApiKey(apiKeyInput.trim())
                  setApiKeySaved(true)
                  setTimeout(() => setApiKeySaved(false), 1500)
                }}
              >
                {apiKeySaved ? '✓' : 'Uložiť'}
              </button>
            </div>
            {claudeApiKey && <p className="backup-desc" style={{ marginTop: 6, color: '#3ecf80' }}>✓ API kľúč je nastavený</p>}
          </div>
        </div>
      )}
    </div>
  )
}
