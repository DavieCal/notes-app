import { useState } from 'react'
import { openDB } from 'idb'
import { supabase } from '../lib/supabase'

async function readLocalDB() {
  const db = await openDB('voice-notes', 3)
  const notes = await db.getAll('notes')
  const actions = await db.getAll('actions')
  const lists = await db.getAll('lists')
  const listItems = await db.getAll('listItems')
  return { notes, actions, lists, listItems }
}

export default function SettingsView() {
  const [status, setStatus] = useState(null)
  const [running, setRunning] = useState(false)

  async function handleMigrate() {
    setRunning(true)
    setStatus('Reading local notes…')
    try {
      const { notes, actions, lists, listItems } = await readLocalDB()

      const total = notes.length + actions.length + lists.length + listItems.length
      if (total === 0) {
        setStatus('No local data found to migrate.')
        setRunning(false)
        return
      }

      // Track old ID → new Supabase ID for foreign key mapping
      const noteIdMap = {}
      const listIdMap = {}

      if (notes.length) {
        setStatus(`Migrating ${notes.length} notes…`)
        for (const n of notes) {
          const { data, error } = await supabase.from('notes').insert({
            content: n.content,
            raw_speech: n.rawSpeech || n.content,
            section: n.section,
            tags: n.tags || [],
            created_at: n.createdAt,
          }).select().single()
          if (error) throw error
          noteIdMap[n.id] = data.id
        }
      }

      if (actions.length) {
        setStatus(`Migrating ${actions.length} actions…`)
        const rows = actions.map(a => ({
          note_id: noteIdMap[a.noteId] || null,
          description: a.description,
          timeframe: a.timeframe,
          section: a.section,
          done: a.done,
          created_at: a.createdAt,
        }))
        const { error } = await supabase.from('actions').insert(rows)
        if (error) throw error
      }

      if (lists.length) {
        setStatus(`Migrating ${lists.length} lists…`)
        for (const l of lists) {
          const { data, error } = await supabase.from('lists').insert({
            name: l.name,
            created_at: l.createdAt,
          }).select().single()
          if (error) throw error
          listIdMap[l.id] = data.id
        }
      }

      if (listItems.length) {
        setStatus(`Migrating ${listItems.length} list items…`)
        const rows = listItems.map(i => ({
          list_id: listIdMap[i.listId] || null,
          text: i.text,
          done: i.done,
          created_at: i.createdAt,
        }))
        const { error } = await supabase.from('list_items').insert(rows)
        if (error) throw error
      }

      setStatus(`✓ Done! Migrated ${notes.length} notes, ${actions.length} actions, ${lists.length} lists, ${listItems.length} list items.`)
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Settings</h3>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Migrate local notes to cloud</div>
        <div style={styles.cardDesc}>
          If you had notes saved before Supabase was connected, this will upload them to the cloud so they appear on all devices.
          Safe to run — it only adds records, won't overwrite anything.
        </div>
        <button style={styles.btn} onClick={handleMigrate} disabled={running}>
          {running ? 'Migrating…' : 'Migrate local notes → Supabase'}
        </button>
        {status && <div style={styles.status}>{status}</div>}
      </div>
    </div>
  )
}

const styles = {
  container: { padding: 16 },
  heading: { color: '#eee', marginBottom: 16 },
  card: { background: '#1e1e2e', borderRadius: 12, padding: '16px' },
  cardTitle: { color: '#eee', fontWeight: 700, marginBottom: 6 },
  cardDesc: { color: '#888', fontSize: 13, lineHeight: 1.6, marginBottom: 14 },
  btn: { width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#4f9cf9', color: '#111', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  status: { marginTop: 12, color: '#a8f94f', fontSize: 13, lineHeight: 1.5 },
}
