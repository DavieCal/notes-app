import { openDB } from 'idb'
import { supabase } from './supabase'

// ─── IndexedDB (categories only — device preferences) ────────────────────────

const DB_NAME = 'voice-notes'
const DB_VERSION = 3
const DEFAULT_CATEGORIES = ['work', 'home', 'todo', 'goals', 'meals', 'trips', 'activities', 'hobbies']

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true })
        db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true })
        db.createObjectStore('summaries', { keyPath: 'id', autoIncrement: true })
      }
      if (oldVersion < 2) {
        const catStore = db.createObjectStore('categories', { keyPath: 'name' })
        catStore.createIndex('order', 'order')
      }
      if (oldVersion < 3) {
        db.createObjectStore('lists', { keyPath: 'id', autoIncrement: true })
        db.createObjectStore('listItems', { keyPath: 'id', autoIncrement: true })
      }
    },
  })
}

export async function getCategories() {
  const db = await getDb()
  const cats = await db.getAll('categories')
  if (cats.length === 0) {
    const tx = db.transaction('categories', 'readwrite')
    DEFAULT_CATEGORIES.forEach((name, i) => tx.store.put({ name, order: i }))
    await tx.done
    return DEFAULT_CATEGORIES
  }
  return cats.sort((a, b) => a.order - b.order).map(c => c.name)
}

export async function addCategory(name) {
  const db = await getDb()
  const cats = await db.getAll('categories')
  const maxOrder = cats.reduce((m, c) => Math.max(m, c.order), -1)
  await db.put('categories', { name: name.toLowerCase().trim(), order: maxOrder + 1 })
}

export async function deleteCategory(name) {
  const db = await getDb()
  await db.delete('categories', name.toLowerCase().trim())
}

// ─── Row transformers (Supabase snake_case → app camelCase) ──────────────────

const toNote = r => ({ id: r.id, content: r.content, rawSpeech: r.raw_speech, section: r.section, tags: r.tags || [], createdAt: r.created_at })
const toAction = r => ({ id: r.id, noteId: r.note_id, description: r.description, timeframe: r.timeframe, section: r.section, done: r.done, createdAt: r.created_at })
const toList = r => ({ id: r.id, name: r.name, createdAt: r.created_at })
const toListItem = r => ({ id: r.id, listId: r.list_id, text: r.text, done: r.done, createdAt: r.created_at })

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function saveNote(note) {
  const { data, error } = await supabase.from('notes').insert({
    content: note.content,
    raw_speech: note.rawSpeech,
    section: note.section,
    tags: note.tags,
    created_at: Date.now(),
  }).select().single()
  if (error) throw error
  return data.id
}

export async function updateNote(id, patch) {
  const update = {}
  if (patch.content !== undefined) update.content = patch.content
  if (patch.section !== undefined) update.section = patch.section
  if (patch.tags !== undefined) update.tags = patch.tags
  const { error } = await supabase.from('notes').update(update).eq('id', id)
  if (error) throw error
}

export async function deleteNote(id) {
  // actions deleted automatically via ON DELETE CASCADE
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

export async function getNotes({ section, since, until } = {}) {
  let query = supabase.from('notes').select('*').order('created_at', { ascending: false })
  if (section) query = query.eq('section', section)
  if (since) query = query.gte('created_at', since)
  if (until) query = query.lte('created_at', until)
  const { data, error } = await query
  if (error) throw error
  return data.map(toNote)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function saveActions(actions) {
  const rows = actions.map(a => ({
    note_id: a.noteId,
    description: a.description,
    timeframe: a.timeframe,
    section: a.section,
    done: false,
    created_at: Date.now(),
  }))
  const { error } = await supabase.from('actions').insert(rows)
  if (error) throw error
}

export async function getActions({ done, section, timeframe } = {}) {
  let query = supabase.from('actions').select('*').order('created_at', { ascending: true })
  if (done !== undefined) query = query.eq('done', done)
  if (section) query = query.eq('section', section)
  if (timeframe) query = query.eq('timeframe', timeframe)
  const { data, error } = await query
  if (error) throw error
  return data.map(toAction)
}

export async function toggleAction(id) {
  const { data } = await supabase.from('actions').select('done').eq('id', id).single()
  const { error } = await supabase.from('actions').update({ done: !data.done }).eq('id', id)
  if (error) throw error
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export async function getLists() {
  const { data, error } = await supabase.from('lists').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data.map(toList)
}

export async function createList(name) {
  const { data, error } = await supabase.from('lists').insert({ name: name.trim(), created_at: Date.now() }).select().single()
  if (error) throw error
  return data.id
}

export async function deleteList(id) {
  // list_items deleted automatically via ON DELETE CASCADE
  const { error } = await supabase.from('lists').delete().eq('id', id)
  if (error) throw error
}

export async function findListByName(name) {
  const { data, error } = await supabase.from('lists').select('*').ilike('name', name.trim())
  if (error) throw error
  return data.length > 0 ? toList(data[0]) : null
}

// ─── List items ───────────────────────────────────────────────────────────────

export async function getListItems(listId) {
  const { data, error } = await supabase.from('list_items').select('*').eq('list_id', listId).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toListItem)
}

export async function addListItem(listId, text) {
  const { data, error } = await supabase.from('list_items').insert({ list_id: listId, text: text.trim(), done: false, created_at: Date.now() }).select().single()
  if (error) throw error
  return data.id
}

export async function toggleListItem(id) {
  const { data } = await supabase.from('list_items').select('done').eq('id', id).single()
  const { error } = await supabase.from('list_items').update({ done: !data.done }).eq('id', id)
  if (error) throw error
}

export async function deleteListItem(id) {
  const { error } = await supabase.from('list_items').delete().eq('id', id)
  if (error) throw error
}

// ─── Summaries (kept local — reports are ephemeral) ───────────────────────────

export async function saveSummary(summary) {
  const db = await getDb()
  return db.add('summaries', { ...summary, generatedAt: Date.now() })
}

export async function getSummaries(section) {
  const db = await getDb()
  let summaries = await db.getAll('summaries')
  if (section) summaries = summaries.filter(s => s.section === section || s.section == null)
  return summaries.sort((a, b) => b.generatedAt - a.generatedAt)
}
