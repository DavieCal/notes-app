import { useEffect, useState } from 'react'
import { getNotes, getCategories } from '../lib/db'
import NoteCard from './NoteCard'

const SECTION_COLORS = [
  '#4f9cf9', '#f97c4f', '#f9d74f', '#a8f94f',
  '#f94fa8', '#4ff9c8', '#c84ff9', '#f94f4f',
  '#f9a84f', '#4ff97c', '#f94f9c', '#4f9ff9',
]

function colorFor(name, categories) {
  const i = categories.indexOf(name)
  return SECTION_COLORS[i % SECTION_COLORS.length]
}

export default function SectionView({ refreshKey }) {
  const [active, setActive] = useState('all')
  const [notes, setNotes] = useState([])
  const [categories, setCategories] = useState([])

  useEffect(() => {
    getCategories().then(setCategories)
  }, [refreshKey])

  function load() {
    getNotes(active === 'all' ? {} : { section: active }).then(setNotes)
  }

  useEffect(() => { load() }, [active, refreshKey])

  const all = ['all', ...categories]

  return (
    <div style={styles.container}>
      <div style={styles.chips}>
        {all.map(s => {
          const color = s === 'all' ? '#888' : colorFor(s, categories)
          return (
            <button
              key={s}
              style={{
                ...styles.chip,
                background: active === s ? color : '#1e1e2e',
                color: active === s ? '#111' : color,
                borderColor: color,
              }}
              onClick={() => setActive(s)}
            >
              {s}
            </button>
          )
        })}
      </div>

      {notes.length === 0
        ? <p style={styles.empty}>No notes yet in {active}.</p>
        : notes.map(n => <NoteCard key={n.id} note={n} onChanged={load} categories={categories} />)
      }
    </div>
  )
}

const styles = {
  container: { padding: '16px' },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  chip: { padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
}
