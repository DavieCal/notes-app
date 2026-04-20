import { useEffect, useState } from 'react'
import { getLists, getListItems, createList, deleteList, addListItem, toggleListItem, deleteListItem } from '../lib/db'

export default function ListView({ refreshKey }) {
  const [lists, setLists] = useState([])
  const [openList, setOpenList] = useState(null)
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState('')
  const [newListName, setNewListName] = useState('')
  const [addingList, setAddingList] = useState(false)

  useEffect(() => {
    getLists().then(setLists)
  }, [refreshKey])

  async function openListById(list) {
    setOpenList(list)
    const i = await getListItems(list.id)
    setItems(i)
  }

  async function refreshItems() {
    if (!openList) return
    const i = await getListItems(openList.id)
    setItems(i)
  }

  async function handleAddItem(e) {
    e.preventDefault()
    if (!newItem.trim()) return
    await addListItem(openList.id, newItem)
    setNewItem('')
    refreshItems()
  }

  async function handleToggle(id) {
    await toggleListItem(id)
    refreshItems()
  }

  async function handleDeleteItem(id) {
    await deleteListItem(id)
    refreshItems()
  }

  async function handleDeleteList(id) {
    await deleteList(id)
    setOpenList(null)
    getLists().then(setLists)
  }

  async function handleCreateList(e) {
    e.preventDefault()
    if (!newListName.trim()) return
    const id = await createList(newListName)
    setNewListName('')
    setAddingList(false)
    const updated = await getLists()
    setLists(updated)
    openListById(updated.find(l => l.id === id) || updated[0])
  }

  if (openList) {
    const pending = items.filter(i => !i.done)
    const done = items.filter(i => i.done)

    return (
      <div style={styles.container}>
        <div style={styles.listHeader}>
          <button style={styles.back} onClick={() => setOpenList(null)}>← Lists</button>
          <span style={styles.listTitle}>{openList.name}</span>
          <button style={styles.deleteListBtn} onClick={() => handleDeleteList(openList.id)}>🗑</button>
        </div>

        <form onSubmit={handleAddItem} style={styles.addRow}>
          <input
            style={styles.input}
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add item…"
          />
          <button style={styles.addBtn} type="submit">Add</button>
        </form>

        {pending.map(item => (
          <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDeleteItem} />
        ))}

        {done.length > 0 && (
          <>
            <div style={styles.doneLabel}>Done ({done.length})</div>
            {done.map(item => (
              <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDeleteItem} />
            ))}
          </>
        )}

        {items.length === 0 && <p style={styles.empty}>No items yet. Add one above or use voice.</p>}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <h3 style={styles.heading}>Lists</h3>
        <button style={styles.newBtn} onClick={() => setAddingList(v => !v)}>
          {addingList ? '✕' : '+ New list'}
        </button>
      </div>

      {addingList && (
        <form onSubmit={handleCreateList} style={styles.addRow}>
          <input
            style={styles.input}
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            placeholder="List name…"
            autoFocus
          />
          <button style={styles.addBtn} type="submit">Create</button>
        </form>
      )}

      {lists.length === 0 && !addingList && (
        <p style={styles.empty}>No lists yet. Say "start grocery list" to create one.</p>
      )}

      {lists.map(list => (
        <ListCard key={list.id} list={list} onOpen={openListById} />
      ))}
    </div>
  )
}

function ListCard({ list, onOpen }) {
  const [count, setCount] = useState(null)

  useEffect(() => {
    getListItems(list.id).then(items => setCount(items.filter(i => !i.done).length))
  }, [list.id])

  return (
    <div style={styles.listCard} onClick={() => onOpen(list)}>
      <span style={styles.listName}>{list.name}</span>
      <span style={styles.listCount}>{count !== null ? `${count} left` : ''}</span>
    </div>
  )
}

function ItemRow({ item, onToggle, onDelete }) {
  return (
    <div style={{ ...styles.itemRow, opacity: item.done ? 0.45 : 1 }}>
      <button style={styles.check} onClick={() => onToggle(item.id)}>
        {item.done ? '✓' : '○'}
      </button>
      <span style={{ ...styles.itemText, textDecoration: item.done ? 'line-through' : 'none' }}>
        {item.text}
      </span>
      <button style={styles.delItem} onClick={() => onDelete(item.id)}>✕</button>
    </div>
  )
}

const styles = {
  container: { padding: 16 },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heading: { color: '#eee', margin: 0 },
  newBtn: { background: '#1e1e2e', border: '1px solid #444', color: '#4f9cf9', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  addRow: { display: 'flex', gap: 8, marginBottom: 16 },
  input: { flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #333', background: '#1e1e2e', color: '#eee', fontSize: 15 },
  addBtn: { padding: '10px 16px', borderRadius: 8, border: 'none', background: '#4f9cf9', color: '#111', fontWeight: 600, cursor: 'pointer' },
  listCard: { background: '#1e1e2e', borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  listName: { color: '#ddd', fontSize: 16, fontWeight: 600, textTransform: 'capitalize' },
  listCount: { color: '#666', fontSize: 13 },
  listHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  back: { background: 'none', border: 'none', color: '#4f9cf9', fontSize: 15, cursor: 'pointer', padding: 0 },
  listTitle: { flex: 1, color: '#eee', fontWeight: 700, fontSize: 18, textTransform: 'capitalize' },
  deleteListBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', opacity: 0.5 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1e1e2e' },
  check: { background: 'none', border: 'none', fontSize: 20, color: '#4f9cf9', cursor: 'pointer', padding: 0, minWidth: 24 },
  itemText: { flex: 1, color: '#ddd', fontSize: 15 },
  delItem: { background: 'none', border: 'none', color: '#555', fontSize: 14, cursor: 'pointer', padding: '0 4px' },
  doneLabel: { color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 4 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40, fontSize: 14 },
}
