import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ~1-3 chars every 35ms ≈ 57 chars/sec, which reads as a fast human typist
// (well above the ~40 WPM / ~3 chars-per-sec average) rather than the
// reply just flashing into existence — a 300-char reply takes ~5s.
const MIN_CHUNK_CHARS = 1
const MAX_CHUNK_CHARS = 3
const TICK_MS = 35

// Reveals `text` progressively in small chunks by growing a substring each
// tick, piped through ReactMarkdown so the revealed portion always renders
// as real markdown rather than raw syntax. Calls `onDone` once fully
// revealed.
export default function TypewriterText({ text, onDone }) {
  const [revealedLength, setRevealedLength] = useState(0)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!text) {
      onDoneRef.current?.()
      return
    }

    let revealed = 0
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevealedLength(0)

    const intervalId = setInterval(() => {
      const chunkSize =
        MIN_CHUNK_CHARS +
        Math.floor(Math.random() * (MAX_CHUNK_CHARS - MIN_CHUNK_CHARS + 1))
      revealed = Math.min(revealed + chunkSize, text.length)
      setRevealedLength(revealed)

      if (revealed >= text.length) {
        clearInterval(intervalId)
        onDoneRef.current?.()
      }
    }, TICK_MS)

    return () => clearInterval(intervalId)
  }, [text])

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {text.slice(0, revealedLength)}
    </ReactMarkdown>
  )
}
