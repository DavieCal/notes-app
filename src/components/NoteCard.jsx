import { useState } from 'react'
import { updateNote, deleteNote } from '../lib/db'

const SECTION_COLORS = {
  work: '#4f9cf9', home: '#f97c4f', todo: '#f9d74f',
  goals: '#a8f94f', meals: '#f94fa8', trips: '#4ff9c8',
  activities: '#c84ff9', hobbies: '#f94f4f',
}

export default function NoteCard({ note, onChanged, categories = [] }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(note.content)
  const [editSection, setEditSection] = useState(note.section)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const date = new Date(note.createdAt)
  const dateStr = date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  async function handleSave() {
    setSaving(true)
    await updateNote(note.id, { content: editText, section: editSection })
    setSaving(false)
    setEditing(false)
    setExpanded(false)
    onChanged?.()
  }

  async function handleDelete() {
    await deleteNote(note.id)
    onChanged?.()
  }

  if (editing) {
    return (
      <div style={styles.card}>
        <textarea
          style={styles.editArea}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          rows={4}
          autoFocus
        />
        <div style={styles.sectionPicker}>
          {categories.map(s => (
            <button
              key={s}
              style={{ ...styles.sectionChip, background: editSection === s ? SECTION_COLORS[s] : '#2a2a3e', color: editSection === s ? '#111' : '#aaa' }}
              onClick={() => setEditSection(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={styles.editBtns}>
          <button style={styles.cancelBtn} onClick={() => { setEditing(false); setEditText(note.content); setEditSection(note.section) }}>Cancel</button>
          <button style={styles.saveBtn} onClick={handleSave} disabled={saving || !editText.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={{ ...styles.section, background: SECTION_COLORS[note.section] + '33', color: SECTION_COLORS[note.section] }}>
          {note.section}
        </span>
        <div style={styles.headerRight}>
          <span style={styles.date}>{dateStr}</span>
          <button style={styles.menuBtn} onClick={() => { setExpanded(v => !v); setConfirmDelete(false) }}>
            {expanded ? '✕' : '···'}
          </button>
        </div>
      </div>

      <p style={styles.content}>{note.content}</p>

      {note.tags?.length > 0 && (
        <div style={styles.tags}>
          {note.tags.map(t => <span key={t} style={styles.tag}>#{t}</span>)}
        </div>
      )}

      {expanded && !confirmDelete && (
        <div style={styles.actions}>
          <button style={styles.editBtn} onClick={() => setEditing(true)}>Edit</button>
          <button style={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      )}

      {confirmDelete && (
        <div style={styles.actions}>
          <span style={styles.confirmText}>Delete this note?</span>
          <button style={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>No</button>
          <button style={styles.deleteBtn} onClick={handleDelete}>Yes, delete</button>
        </div>
      )}
    </div>
  )
}

const styles = {
  card: { background: '#1e1e2e', borderRadius: 12, padding: '14px 16px', marginBottom: 10 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  section: { fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  date: { fontSize: 12, color: '#666' },
  menuBtn: { background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  content: { margin: 0, color: '#ddd', fontSize: 15, lineHeight: 1.5 },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  tag: { fontSize: 11, color: '#888' },
  actions: { display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' },
  editBtn: { padding: '7px 16px', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: '#ddd', cursor: 'pointer', fontSize: 14 },
  deleteBtn: { padding: '7px 16px', borderRadius: 8, border: 'none', background: '#c0392b', color: '#fff', cursor: 'pointer', fontSize: 14 },
  cancelBtn: { padding: '7px 16px', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 14 },
  confirmText: { color: '#aaa', fontSize: 14, flex: 1 },
  editArea: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#16162a', color: '#eee', fontSize: 15, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 },
  sectionPicker: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  sectionChip: { padding: '4px 10px', borderRadius: 16, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' },
  editBtns: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  saveBtn: { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f9cf9', color: '#111', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
}
