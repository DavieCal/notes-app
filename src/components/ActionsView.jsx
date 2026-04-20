import { useEffect, useState } from 'react'
import { getActions, toggleAction } from '../lib/db'

const TIMEFRAME_LABELS = {
  immediate: { label: 'Immediate', color: '#e74c3c', desc: 'Today / Tomorrow' },
  short_term: { label: 'Short-term', color: '#f9d74f', desc: 'This week / Month' },
  long_term: { label: 'Long-term', color: '#4f9cf9', desc: '1+ months / Ongoing' },
}

export default function ActionsView() {
  const [actions, setActions] = useState([])
  const [showDone, setShowDone] = useState(false)

  async function load() {
    const all = await getActions(showDone ? {} : { done: false })
    setActions(all)
  }

  useEffect(() => { load() }, [showDone])

  async function handleToggle(id) {
    await toggleAction(id)
    load()
  }

  const grouped = ['immediate', 'short_term', 'long_term'].reduce((acc, tf) => {
    acc[tf] = actions.filter(a => a.timeframe === tf)
    return acc
  }, {})

  const total = actions.filter(a => !a.done).length

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <span style={styles.count}>{total} pending action{total !== 1 ? 's' : ''}</span>
        <button style={styles.toggle} onClick={() => setShowDone(v => !v)}>
          {showDone ? 'Hide done' : 'Show done'}
        </button>
      </div>

      {['immediate', 'short_term', 'long_term'].map(tf => {
        const items = grouped[tf]
        if (items.length === 0) return null
        const meta = TIMEFRAME_LABELS[tf]
        return (
          <div key={tf} style={styles.group}>
            <div style={{ ...styles.groupHeader, color: meta.color }}>
              {meta.label} <span style={styles.desc}>{meta.desc}</span>
            </div>
            {items.map(a => (
              <div key={a.id} style={{ ...styles.actionRow, opacity: a.done ? 0.4 : 1 }}>
                <button style={styles.checkbox} onClick={() => handleToggle(a.id)}>
                  {a.done ? '✓' : '○'}
                </button>
                <div style={styles.actionText}>
                  <span style={{ textDecoration: a.done ? 'line-through' : 'none' }}>{a.description}</span>
                  <span style={styles.sectionBadge}>{a.section}</span>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {actions.length === 0 && (
        <p style={styles.empty}>No pending actions. Save some voice notes to get started.</p>
      )}
    </div>
  )
}

const styles = {
  container: { padding: 16 },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  count: { color: '#aaa', fontSize: 14 },
  toggle: { fontSize: 13, background: 'transparent', border: '1px solid #444', color: '#aaa', padding: '4px 10px', borderRadius: 8, cursor: 'pointer' },
  group: { marginBottom: 20 },
  groupHeader: { fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  desc: { fontWeight: 400, fontSize: 12, opacity: 0.7, textTransform: 'none', letterSpacing: 0 },
  actionRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #222' },
  checkbox: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa', padding: 0, lineHeight: 1, minWidth: 24 },
  actionText: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, color: '#ddd', fontSize: 15 },
  sectionBadge: { fontSize: 11, color: '#666', textTransform: 'capitalize' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
}
