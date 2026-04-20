import { useState } from 'react'
import VoiceInput from './components/VoiceInput'
import SectionView from './components/SectionView'
import ActionsView from './components/ActionsView'
import ReportView from './components/ReportView'
import ListView from './components/ListView'
import SettingsView from './components/SettingsView'

const TABS = [
  { id: 'capture', label: '🎤', title: 'Capture' },
  { id: 'notes', label: '📝', title: 'Notes' },
  { id: 'lists', label: '☑', title: 'Lists' },
  { id: 'actions', label: '✓', title: 'Actions' },
  { id: 'reports', label: '📊', title: 'Reports' },
  { id: 'settings', label: '⚙', title: 'Settings' },
]

export default function App() {
  const [tab, setTab] = useState('capture')
  const [refreshKey, setRefreshKey] = useState(0)

  function bump() { setRefreshKey(k => k + 1) }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.appName}>Voice Notes</span>
      </header>

      <main style={styles.main}>
        {tab === 'capture' && <VoiceInput onNoteSaved={bump} onCategoriesChanged={bump} onListsChanged={bump} />}
        {tab === 'notes' && <SectionView refreshKey={refreshKey} />}
        {tab === 'lists' && <ListView refreshKey={refreshKey} />}
        {tab === 'actions' && <ActionsView key={refreshKey} />}
        {tab === 'reports' && <ReportView />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <nav style={styles.nav}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.navBtn, color: tab === t.id ? '#4f9cf9' : '#666' }}
            onClick={() => setTab(t.id)}
          >
            <span style={styles.navIcon}>{t.label}</span>
            <span style={styles.navLabel}>{t.title}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

const styles = {
  app: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0d0d1a', color: '#eee', fontFamily: 'system-ui, sans-serif' },
  header: { padding: '14px 16px 10px', borderBottom: '1px solid #1e1e2e', flexShrink: 0 },
  appName: { fontWeight: 700, fontSize: 18, color: '#eee' },
  main: { flex: 1, overflowY: 'auto' },
  nav: { display: 'flex', borderTop: '1px solid #1e1e2e', flexShrink: 0, background: '#0d0d1a' },
  navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 0 14px', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 11, fontWeight: 500 },
}
