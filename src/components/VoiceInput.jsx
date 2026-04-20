import { useState, useEffect } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { classifyNote } from '../lib/claude'
import { saveNote, saveActions, getCategories, addCategory, deleteCategory, createList, findListByName, addListItem } from '../lib/db'

function parseCategoryCommand(text) {
  const t = text.toLowerCase().trim()
  const add = t.match(/^(?:add|create|new)\s+(.+?)\s+categor(?:y|ies)$/)
  if (add) return { type: 'add', name: add[1].trim() }
  const del = t.match(/^(?:delete|remove)\s+(.+?)\s+categor(?:y|ies)$/)
  if (del) return { type: 'delete', name: del[1].trim() }
  return null
}

function parseListCommand(text) {
  const t = text.toLowerCase().trim()
  // "start a grocery list" / "create shopping list" / "new car maintenance list"
  const create = t.match(/^(?:start|create|new|make)(?:\s+a(?:\s+new)?)?\s+(.+?)\s+list$/)
  if (create) return { type: 'create', listName: create[1].trim() }
  // "add milk to grocery list" / "add milk to my shopping list" / "add milk to the car list"
  const addItem = t.match(/^add\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(.+?)\s+list$/)
  if (addItem) return { type: 'addItem', item: addItem[1].trim(), listName: addItem[2].trim() }
  return null
}

export default function VoiceInput({ onNoteSaved, onCategoriesChanged, onListsChanged }) {
  const { transcript, setTranscript, listening, error, supported, start, stop, reset } = useSpeechRecognition()
  const [processing, setProcessing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  async function handleSave() {
    const text = transcript.trim()
    if (!text) return
    setProcessing(true)

    try {
      // Category commands
      const catCmd = parseCategoryCommand(text)
      if (catCmd) {
        if (catCmd.type === 'add') await addCategory(catCmd.name)
        else await deleteCategory(catCmd.name)
        const updated = await getCategories()
        setCategories(updated)
        onCategoriesChanged?.()
        setPreview({ type: 'category', action: catCmd.type === 'add' ? 'added' : 'deleted', name: catCmd.name })
        setTimeout(() => { setPreview(null); reset() }, 2500)
        return
      }

      // List commands
      const listCmd = parseListCommand(text)
      if (listCmd) {
        if (listCmd.type === 'create') {
          await createList(listCmd.listName)
          onListsChanged?.()
          setPreview({ type: 'list', action: 'created', name: listCmd.listName })
        } else if (listCmd.type === 'addItem') {
          let list = await findListByName(listCmd.listName)
          if (!list) {
            const id = await createList(listCmd.listName)
            list = { id }
            onListsChanged?.()
          }
          await addListItem(list.id, listCmd.item)
          onListsChanged?.()
          setPreview({ type: 'list', action: 'addedItem', item: listCmd.item, name: listCmd.listName })
        }
        setTimeout(() => { setPreview(null); reset() }, 2500)
        return
      }

      // Regular note
      let classification = { section: categories[0] || 'todo', tags: [], actions: [] }
      try {
        classification = await classifyNote(text, categories)
      } catch {
        // save without classification if offline
      }

      const noteId = await saveNote({
        content: text,
        rawSpeech: text,
        section: classification.section,
        tags: classification.tags,
      })

      if (classification.actions.length > 0) {
        await saveActions(classification.actions.map(a => ({
          ...a,
          noteId,
          section: classification.section,
        })))
      }

      setPreview({ type: 'note', ...classification })
      setTimeout(() => { setPreview(null); reset(); onNoteSaved?.() }, 2500)
    } finally {
      setProcessing(false)
    }
  }

  if (preview) {
    if (preview.type === 'category') {
      return (
        <div style={styles.saved}>
          <div style={{ fontSize: 32 }}>{preview.action === 'added' ? '✓' : '🗑'}</div>
          <div>Category <strong style={{ color: '#4f9cf9' }}>{preview.name}</strong> {preview.action}</div>
        </div>
      )
    }
    if (preview.type === 'list') {
      return (
        <div style={styles.saved}>
          <div style={{ fontSize: 32 }}>✓</div>
          {preview.action === 'created'
            ? <div>List <strong style={{ color: '#4ff9c8' }}>{preview.name}</strong> created</div>
            : <div>Added <strong style={{ color: '#4ff9c8' }}>{preview.item}</strong> to <strong>{preview.name}</strong></div>
          }
        </div>
      )
    }
    return (
      <div style={styles.saved}>
        <div style={{ fontSize: 32 }}>✓</div>
        <div>Saved to <strong style={{ color: '#4f9cf9' }}>{preview.section}</strong></div>
        {preview.actions?.length > 0 && (
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            {preview.actions.length} action{preview.actions.length > 1 ? 's' : ''} extracted
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <button
        style={{ ...styles.micBtn, background: listening ? '#e74c3c' : '#4f9cf9' }}
        onClick={listening ? stop : start}
        disabled={!supported || processing}
      >
        {listening ? '◉' : '🎤'}
      </button>
      <div style={styles.hint}>
        {!supported ? 'Use Chrome on Android for voice input' :
         listening ? 'Tap to stop' :
         'Tap to record'}
      </div>
      <div style={styles.tip}>
        "add car category" · "start grocery list" · "add milk to grocery list"
      </div>

      {transcript && (
        <div style={styles.transcriptBox}>
          <textarea
            style={styles.textarea}
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={4}
          />
          <div style={styles.btnRow}>
            <button style={styles.clearBtn} onClick={reset}>Clear</button>
            <button style={styles.saveBtn} onClick={handleSave} disabled={processing}>
              {processing ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 16px' },
  micBtn: { width: 100, height: 100, borderRadius: '50%', border: 'none', fontSize: 40, cursor: 'pointer', color: '#fff', transition: 'background 0.2s', userSelect: 'none', WebkitUserSelect: 'none' },
  hint: { color: '#aaa', fontSize: 14 },
  tip: { color: '#555', fontSize: 12, textAlign: 'center' },
  transcriptBox: { width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 },
  textarea: { width: '100%', padding: 12, borderRadius: 10, border: '1px solid #333', background: '#1e1e2e', color: '#eee', fontSize: 15, resize: 'vertical', boxSizing: 'border-box' },
  btnRow: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  clearBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' },
  saveBtn: { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f9cf9', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  error: { color: '#e74c3c', fontSize: 13 },
  saved: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32, color: '#eee' },
}
