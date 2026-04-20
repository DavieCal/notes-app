const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function callClaude(messages, system) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages,
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

export async function classifyNote(text, categories) {
  const system = `You are a personal assistant. Given a raw voice note, return ONLY valid JSON (no markdown, no explanation):
{
  "section": one of ${JSON.stringify(categories)},
  "tags": [array of short keyword strings],
  "actions": [
    { "description": "action text", "timeframe": "immediate" | "short_term" | "long_term" }
  ]
}
Timeframe guide: immediate = today/tomorrow, short_term = this week/month, long_term = 1+ months or ongoing goal.`

  const raw = await callClaude([{ role: 'user', content: text }], system)
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return { section: 'todo', tags: [], actions: [] }
  }
}

export async function generateReport({ notes, section, periodLabel }) {
  const notesText = notes.map(n =>
    `[${new Date(n.createdAt).toLocaleDateString()}] ${n.content}`
  ).join('\n\n')

  const sectionLabel = section || 'all sections'
  const system = `You are a personal assistant creating a summary report. Write in clear, concise markdown.`

  const prompt = `Summarize these notes for ${sectionLabel} (${periodLabel}):

${notesText}

Write a structured report with:
## Overview
2-3 sentence summary.

## Key Themes
Bullet points of main topics.

## Actions
### Immediate (today/tomorrow)
### Short-term (this week/month)
### Long-term (1+ months)

## Open Questions
Any unresolved items or follow-ups needed.`

  return callClaude([{ role: 'user', content: prompt }], system)
}
