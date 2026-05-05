import { useState, useEffect, useRef } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { classifyNote, analyzeImageNote } from '../lib/claude'
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
  const create = t.match(/^(?:start|create|new|make)(?:\s+a(?:\s+new)?)?\s+(.+?)\s+list$/)
  if (create) return { type: 'create', listName: create[1].trim() }
  const addItem = t.match(/^add\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(.+?)\s+list$/)
  if (addItem) return { type: 'addItem', item: addItem[1].trim(), listName: addItem[2].trim() }
  return null
}

function resizeImage(file, maxSize = 1568) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) { height = Math.round(height * maxSize / width); width = maxSize }
        else { width = Math.round(width * maxSize / height); height = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.onerror = reject
    img.src = url
  })
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function VoiceInput({ onNoteSaved, onCategoriesChanged, onListsChanged }) {
  const { transcript, setTranscript, listening, error, supported, start, stop, reset } = useSpeechRecognition()
  const [processing, setProcessing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [categories, setCategories] = useState([])
  const [imagePreview, setImagePreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [imageClassification, setImageClassification] = useState(null)
  const cameraInputRef = useRef(null)
  const uploadInputRef = useRef(null)

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  function clearImage() {
    if (imagePreview?.url) URL.revokeObjectURL(imagePreview.url)
    setImagePreview(null)
    setImageClassification(null)
  }

  function handleReset() {
    clearImage()
    reset()
  }

  async function handleFileSelected(file, inputEl) {
    if (!file) return
    if (inputEl) inputEl.value = ''
    const isPdf = file.type === 'application/pdf'
    if (imagePreview?.url) URL.revokeObjectURL(imagePreview.url)
    setImagePreview({ url: isPdf ? null : URL.createObjectURL(file), name: file.name, isPdf })
    setImageClassification(null)
    setAnalyzing(true)
    reset()

    try {
      let base64Data, mimeType = file.type
      if (isPdf) {
        base64Data = await readFileAsBase64(file)
      } else {
        base64Data = await resizeImage(file)
        mimeType = 'image/jpeg'
      }
      const result = await analyzeImageNote(base64Data, mimeType, categories)
      setTranscript(result.extractedText || '')
      setImageClassification({ section: result.section, tags: result.tags, actions: result.actions })
    } catch {
      setTranscript('')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    const text = transcript.trim()
    if (!text) return
    setProcessing(true)

    try {
      const catCmd = parseCategoryCommand(text)
      if (catCmd) {
        if (catCmd.type === 'add') await addCategory(catCmd.name)
        else await deleteCategory(catCmd.name)
        const updated = await getCategories()
        setCategories(updated)
        onCategoriesChanged?.()
        setPreview({ type: 'category', action: catCmd.type === 'add' ? 'added' : 'deleted', name: catCmd.name })
        setTimeout(() => { setPreview(null); handleReset() }, 2500)
        return
      }

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
        setTimeout(() => { setPreview(null); handleReset() }, 2500)
        return
      }

      // Use pre-computed image classification if available, otherwise call Claude
      let classification = imageClassification || { section: categories[0] || 'todo', tags: [], actions: [] }
      if (!imageClassification) {
        try {
          classification = await classifyNote(text, categories)
        } catch {
          // save without classification if offline
        }
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
      setTimeout(() => { setPreview(null); handleReset(); onNoteSaved?.() }, 2500)
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
        disabled={!supported || processing || analyzing}
      >
        {listening ? '◉' : '🎤'}
      </button>
      <div style={styles.hint}>
        {!supported ? 'Use Chrome on Android for voice input' :
         listening ? 'Tap to stop' :
         'Tap to record'}
      </div>

      <div style={styles.captureRow}>
        <button
          style={styles.captureBtn}
          onClick={() => cameraInputRef.current?.click()}
          disabled={processing || analyzing || listening}
        >
          📷 Camera
        </button>
        <button
          style={styles.captureBtn}
          onClick={() => uploadInputRef.current?.click()}
          disabled={processing || analyzing || listening}
        >
          📎 Upload
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => handleFileSelected(e.target.files[0], e.target)}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={e => handleFileSelected(e.target.files[0], e.target)}
        />
      </div>

      <div style={styles.tip}>
        "add car category" · "start grocery list" · "add milk to grocery list"
      </div>

      {imagePreview && (
        <div style={styles.imagePrev}>
          {imagePreview.isPdf ? (
            <div style={styles.pdfBadge}>📄 {imagePreview.name}</div>
          ) : (
            <img src={imagePreview.url} alt="captured notes" style={styles.thumbImg} />
          )}
          {analyzing && <div style={styles.analyzeHint}>Analysing…</div>}
        </div>
      )}

      {transcript && !analyzing && (
        <div style={styles.transcriptBox}>
          <textarea
            style={styles.textarea}
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={4}
          />
          <div style={styles.btnRow}>
            <button style={styles.clearBtn} onClick={handleReset}>Clear</button>
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
  captureRow: { display: 'flex', gap: 10 },
  captureBtn: { padding: '8px 16px', borderRadius: 20, border: '1px solid #444', background: 'transparent', color: '#ccc', fontSize: 13, cursor: 'pointer' },
  tip: { color: '#555', fontSize: 12, textAlign: 'center' },
  imagePrev: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  thumbImg: { maxWidth: 220, maxHeight: 160, borderRadius: 10, objectFit: 'cover', border: '1px solid #333' },
  pdfBadge: { padding: '10px 16px', borderRadius: 10, background: '#1e1e2e', border: '1px solid #333', color: '#ccc', fontSize: 13 },
  analyzeHint: { color: '#4f9cf9', fontSize: 13 },
  transcriptBox: { width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 },
  textarea: { width: '100%', padding: 12, borderRadius: 10, border: '1px solid #333', background: '#1e1e2e', color: '#eee', fontSize: 15, resize: 'vertical', boxSizing: 'border-box' },
  btnRow: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  clearBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' },
  saveBtn: { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f9cf9', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  error: { color: '#e74c3c', fontSize: 13 },
  saved: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32, color: '#eee' },
}
