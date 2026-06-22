import { useState, useEffect, useRef } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { analyseBrainDump } from '../lib/claude'
import { saveNote, saveActions, getCategories } from '../lib/db'

const TYPE_CONFIG = {
  action:   { emoji: '✓',  color: '#4f9cf9', label: 'Action' },
  goal:     { emoji: '🎯', color: '#a78bfa', label: 'Goal' },
  thought:  { emoji: '💭', color: '#6ee7b7', label: 'Thought' },
  question: { emoji: '?',  color: '#fbbf24', label: 'Question' },
}

const TIMEFRAME_LABELS = {
  immediate:  'Today/Tomorrow',
  short_term: 'This week/month',
  long_term:  'Long term',
}

export default function BrainDumpView({ onSaved }) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState('input') // input | processing | review | saved
  const [items, setItems] = useState([])
  const [kept, setKept] = useState(new Set())
  const [categories, setCategories] = useState([])
  const { transcript, listening, supported, start, stop, reset } = useSpeechRecognition()
  const prevTranscript = useRef('')

  useEffect(() => { getCategories().then(setCategories) }, [])

  // Append new voice speech to textarea rather than replacing
  useEffect(() => {
    const newPart = transcript.slice(prevTranscript.current.length)
    if (newPart) {
      setText(t => t + (t && !t.endsWith('\n') ? '\n' : '') + newPart)
    }
    prevTranscript.current = transcript
  }, [transcript])

  function handleVoiceToggle() {
    if (listening) { stop(); reset(); prevTranscript.current = '' }
    else start()
  }

  async function handleProcess() {
    const raw = text.trim()
    if (!raw) return
    setMode('processing')
    try {
      const parsed = await analyseBrainDump(raw, categories)
      setItems(parsed)
      setKept(new Set(parsed.map((_, i) => i)))
      setMode('review')
    } catch (e) {
      console.error(e)
      setMode('input')
    }
  }

  async function handleSave() {
    const toSave = items.filter((_, i) => kept.has(i))
    for (const item of toSave) {
      const noteId = await saveNote({
        content: item.content,
        rawSpeech: item.content,
        section: item.section || 'todo',
        tags: [...(item.tags || []), 'brain-dump', item.type].filter(Boolean),
      })
      if (item.type === 'action' && item.timeframe) {
        await saveActions([{
          noteId,
          description: item.content,
          timeframe: item.timeframe,
          section: item.section || 'todo',
        }])
      }
    }
    setMode('saved')
    setTimeout(() => {
      setText(''); setItems([]); setKept(new Set()); setMode('input')
      onSaved?.()
    }, 2000)
  }

  function toggleKept(i) {
    setKept(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  if (mode === 'processing') {
    return (
      <div style={s.center}>
        <div style={{ fontSize: 32, color: '#4f9cf9' }}>◌</div>
        <div style={{ color: '#aaa', fontSize: 14 }}>Breaking it down…</div>
      </div>
    )
  }

  if (mode === 'saved') {
    return (
      <div style={s.center}>
        <div style={{ fontSize: 40 }}>✓</div>
        <div style={{ color: '#eee' }}>Saved {kept.size} item{kept.size !== 1 ? 's' : ''}</div>
      </div>
    )
  }

  if (mode === 'review') {
    return (
      <div style={s.reviewContainer}>
        <div style={s.reviewHeader}>
          <button style={s.backBtn} onClick={() => setMode('input')}>← Edit</button>
          <span style={{ color: '#aaa', fontSize: 13 }}>{kept.size} of {items.length} selected</span>
        </div>
        <div style={s.itemList}>
          {items.map((item, i) => {
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.thought
            const isKept = kept.has(i)
            return (
              <div
                key={i}
                style={{ ...s.itemCard, opacity: isKept ? 1 : 0.35, borderColor: isKept ? cfg.color + '66' : '#2a2a3e' }}
                onClick={() => toggleKept(i)}
              >
                <div style={s.itemTop}>
                  <span style={{ ...s.typeBadge, background: cfg.color + '22', color: cfg.color }}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  {item.timeframe && TIMEFRAME_LABELS[item.timeframe] && (
                    <span style={s.timeframeLabel}>{TIMEFRAME_LABELS[item.timeframe]}</span>
                  )}
                  <span style={{ marginLeft: 'auto', color: isKept ? cfg.color : '#444', fontSize: 16 }}>
                    {isKept ? '✓' : '○'}
                  </span>
                </div>
                <div style={s.itemContent}>{item.content}</div>
                {item.tags?.filter(t => t !== 'brain-dump' && t !== item.type).length > 0 && (
                  <div style={s.tagRow}>
                    {item.tags.filter(t => t !== 'brain-dump' && t !== item.type).map(tag => (
                      <span key={tag} style={s.tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={s.saveBar}>
          <button style={{ ...s.saveBtn, opacity: kept.size === 0 ? 0.4 : 1 }} onClick={handleSave} disabled={kept.size === 0}>
            Save {kept.size} item{kept.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.inputContainer}>
      <div style={s.inputHeader}>
        <span style={s.title}>🧠 Brain Dump</span>
        <span style={s.subtitle}>Get it all out. Don't filter.</span>
      </div>
      <textarea
        style={s.textarea}
        placeholder={"Tasks, ideas, worries, goals — just write it all out.\n\nClaude will sort it into actions, goals, and thoughts."}
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus
      />
      <div style={s.bottomRow}>
        {supported && (
          <button
            style={{ ...s.micBtn, background: listening ? '#e74c3c' : '#2a2a3e' }}
            onClick={handleVoiceToggle}
          >
            {listening ? '◉' : '🎤'}
          </button>
        )}
        <button
          style={{ ...s.processBtn, opacity: text.trim() ? 1 : 0.4 }}
          onClick={handleProcess}
          disabled={!text.trim()}
        >
          Process →
        </button>
      </div>
      {listening && <div style={{ color: '#e74c3c', fontSize: 12, textAlign: 'center', paddingBottom: 8 }}>Listening… tap mic to stop</div>}
    </div>
  )
}

const s = {
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#eee' },
  inputContainer: { display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 16px 0' },
  inputHeader: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 700, color: '#eee', display: 'block' },
  subtitle: { fontSize: 13, color: '#666', display: 'block', marginTop: 2 },
  textarea: {
    flex: 1, width: '100%', padding: 14, borderRadius: 12,
    border: '1px solid #2a2a3e', background: '#111122', color: '#eee',
    fontSize: 16, lineHeight: 1.6, resize: 'none', boxSizing: 'border-box',
    fontFamily: 'system-ui, sans-serif', outline: 'none',
  },
  bottomRow: { display: 'flex', gap: 10, padding: '12px 0 16px', alignItems: 'center' },
  micBtn: { width: 44, height: 44, borderRadius: '50%', border: 'none', fontSize: 18, cursor: 'pointer', color: '#fff', flexShrink: 0 },
  processBtn: { flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#4f9cf9', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  reviewContainer: { display: 'flex', flexDirection: 'column', height: '100%' },
  reviewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1e1e2e', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: '#4f9cf9', cursor: 'pointer', fontSize: 14, padding: 0 },
  itemList: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  itemCard: { borderRadius: 10, border: '1px solid', padding: '12px 14px', cursor: 'pointer', transition: 'opacity 0.15s, border-color 0.15s', background: '#111122' },
  itemTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  typeBadge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10 },
  timeframeLabel: { fontSize: 11, color: '#666' },
  itemContent: { color: '#ddd', fontSize: 14, lineHeight: 1.5 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag: { fontSize: 10, padding: '2px 7px', borderRadius: 8, background: '#1e1e2e', color: '#777' },
  saveBar: { padding: '12px 16px 20px', borderTop: '1px solid #1e1e2e', flexShrink: 0 },
  saveBtn: { width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#4f9cf9', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
}
