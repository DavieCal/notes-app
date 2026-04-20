import { useState } from 'react'
import { getNotes, saveSummary, getSummaries } from '../lib/db'
import { generateReport } from '../lib/claude'

const SECTIONS = ['all', 'work', 'home', 'todo', 'goals', 'meals', 'trips', 'activities', 'hobbies']

const PERIODS = [
  { label: 'Today', getDates: () => { const s = new Date(); s.setHours(0,0,0,0); return { since: s.getTime(), until: Date.now() } } },
  { label: 'This week', getDates: () => { const s = new Date(); s.setDate(s.getDate() - 7); return { since: s.getTime(), until: Date.now() } } },
  { label: 'This month', getDates: () => { const s = new Date(); s.setDate(s.getDate() - 30); return { since: s.getTime(), until: Date.now() } } },
  { label: 'All time', getDates: () => ({ since: 0, until: Date.now() }) },
]

export default function ReportView() {
  const [section, setSection] = useState('work')
  const [period, setPeriod] = useState('This week')
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [pastReports, setPastReports] = useState([])
  const [showPast, setShowPast] = useState(false)

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const periodDef = PERIODS.find(p => p.label === period)
      const { since, until } = periodDef.getDates()
      const notes = await getNotes(section === 'all' ? { since, until } : { section, since, until })

      if (notes.length === 0) {
        setError(`No notes found for ${section} in that time range.`)
        return
      }

      const content = await generateReport({ notes, section: section === 'all' ? null : section, periodLabel: period })
      await saveSummary({ section: section === 'all' ? null : section, periodLabel: period, periodStart: since, periodEnd: until, content })
      setReport(content)
    } catch (e) {
      setError('Failed to generate report. Check your internet connection and API key.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleShowPast() {
    const reports = await getSummaries(section === 'all' ? null : section)
    setPastReports(reports)
    setShowPast(true)
    setReport(null)
  }

  function handleCopy() {
    navigator.clipboard.writeText(report)
  }

  if (showPast) {
    return (
      <div style={styles.container}>
        <button style={styles.back} onClick={() => setShowPast(false)}>← Back</button>
        <h3 style={styles.heading}>Past Reports</h3>
        {pastReports.length === 0
          ? <p style={styles.empty}>No saved reports yet.</p>
          : pastReports.map(r => (
            <div key={r.id} style={styles.pastCard} onClick={() => { setReport(r.content); setShowPast(false) }}>
              <div style={styles.pastTitle}>{r.section || 'All'} — {r.periodLabel}</div>
              <div style={styles.pastDate}>{new Date(r.generatedAt).toLocaleDateString()}</div>
            </div>
          ))
        }
      </div>
    )
  }

  if (report) {
    return (
      <div style={styles.container}>
        <div style={styles.reportHeader}>
          <button style={styles.back} onClick={() => setReport(null)}>← Back</button>
          <button style={styles.copyBtn} onClick={handleCopy}>Copy</button>
        </div>
        <div style={styles.reportContent}>
          <MarkdownView text={report} />
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Generate Report</h3>

      <label style={styles.label}>Section</label>
      <div style={styles.chips}>
        {SECTIONS.map(s => (
          <button key={s} style={{ ...styles.chip, background: section === s ? '#4f9cf9' : '#1e1e2e', color: section === s ? '#111' : '#aaa' }} onClick={() => setSection(s)}>
            {s}
          </button>
        ))}
      </div>

      <label style={styles.label}>Time range</label>
      <div style={styles.chips}>
        {PERIODS.map(p => (
          <button key={p.label} style={{ ...styles.chip, background: period === p.label ? '#4f9cf9' : '#1e1e2e', color: period === p.label ? '#111' : '#aaa' }} onClick={() => setPeriod(p.label)}>
            {p.label}
          </button>
        ))}
      </div>

      <button style={styles.generateBtn} onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating…' : `Summarize ${section} — ${period}`}
      </button>

      <button style={styles.pastBtn} onClick={handleShowPast}>View past reports</button>

      {error && <p style={styles.error}>{error}</p>}
    </div>
  )
}

function MarkdownView({ text }) {
  const lines = text.split('\n')
  return (
    <div style={{ color: '#ddd', fontSize: 15, lineHeight: 1.7 }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} style={{ color: '#f9d74f', margin: '16px 0 4px' }}>{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} style={{ color: '#4f9cf9', margin: '20px 0 6px' }}>{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} style={{ color: '#fff', margin: '24px 0 8px' }}>{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ paddingLeft: 16 }}>• {line.slice(2)}</div>
        if (line.trim() === '') return <div key={i} style={{ height: 8 }} />
        return <div key={i}>{line}</div>
      })}
    </div>
  )
}

const styles = {
  container: { padding: 16 },
  heading: { color: '#eee', marginBottom: 16 },
  label: { display: 'block', color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  chip: { padding: '6px 14px', borderRadius: 20, border: '1px solid #444', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' },
  generateBtn: { display: 'block', width: '100%', marginTop: 24, padding: '14px', borderRadius: 12, border: 'none', background: '#4f9cf9', color: '#111', fontWeight: 700, fontSize: 16, cursor: 'pointer' },
  pastBtn: { display: 'block', width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, border: '1px solid #333', background: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer' },
  error: { color: '#e74c3c', marginTop: 12, fontSize: 14 },
  reportHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 16 },
  back: { background: 'none', border: 'none', color: '#4f9cf9', fontSize: 15, cursor: 'pointer', padding: 0 },
  copyBtn: { background: '#1e1e2e', border: '1px solid #444', color: '#aaa', padding: '6px 14px', borderRadius: 8, cursor: 'pointer' },
  reportContent: { padding: '8px 0' },
  pastCard: { background: '#1e1e2e', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' },
  pastTitle: { color: '#ddd', fontWeight: 600 },
  pastDate: { color: '#666', fontSize: 12, marginTop: 4 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
}
