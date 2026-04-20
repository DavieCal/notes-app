import { useState, useRef, useCallback } from 'react'

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const shouldListenRef = useRef(false)
  const prefixRef = useRef('')   // text committed from previous sessions
  const latestRef = useRef('')   // last displayed text (used to seed next session)

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  function buildRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = false  // Android Chrome is buggy with continuous:true
    rec.interimResults = false  // final results only — no mid-phrase noise
    rec.lang = 'en-US'

    rec.onresult = (e) => {
      let sessionText = ''
      for (let i = 0; i < e.results.length; i++) {
        sessionText += e.results[i][0].transcript + ' '
      }
      const full = (prefixRef.current + sessionText).trim()
      latestRef.current = full
      setTranscript(full)
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech') return
      setError(`Mic error: ${e.error}`)
      shouldListenRef.current = false
      setListening(false)
    }

    rec.onend = () => {
      if (shouldListenRef.current) {
        // Commit whatever was last displayed, then restart fresh session
        prefixRef.current = latestRef.current ? latestRef.current + ' ' : ''
        try {
          const next = buildRecognition()
          next.start()
          recognitionRef.current = next
        } catch {
          shouldListenRef.current = false
          setListening(false)
        }
      } else {
        setListening(false)
      }
    }

    return rec
  }

  const start = useCallback(() => {
    if (!supported) {
      setError('Speech recognition not supported in this browser. Use Chrome on Android.')
      return
    }
    setError(null)
    prefixRef.current = ''
    latestRef.current = ''
    setTranscript('')
    shouldListenRef.current = true

    const rec = buildRecognition()
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }, [supported])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    prefixRef.current = ''
    latestRef.current = ''
    setTranscript('')
    setError(null)
    setListening(false)
  }, [])

  return { transcript, setTranscript, listening, error, supported, start, stop, reset }
}
