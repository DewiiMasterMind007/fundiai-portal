import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { Paperclip, Send, Calendar, BarChart2 } from 'lucide-react'
import { useClient } from '../context/ClientContext'
import { supabase } from '../lib/supabase'
import AgentCard from '../components/AgentCard'

const TICKET_MARKER = '[FIRE_TICKET]'

const BOT_LABEL = {
  poppie: 'Poppie',
  chad: 'Chad',
}

function deriveTitle(text) {
  const words = text.trim().split(/\s+/).slice(0, 5)
  return words.join(' ') || 'New Chat'
}

function makeLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function Chat() {
  const { client, fundiFileText } = useClient()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [sessionsError, setSessionsError] = useState(null)
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sendingSessionId, setSendingSessionId] = useState(null)

  const greetedSessionsRef = useRef(new Set())
  const selectedSessionIdRef = useRef(null)
  const messagesEndRef = useRef(null)

  async function fetchSessions() {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('client_email', client.email)
      .order('updated_at', { ascending: false })

    if (error) {
      setSessionsError(error.message)
      return
    }
    setSessionsError(null)
    setSessions(data ?? [])
  }

  async function fetchMessages(sessionId) {
    if (!sessionId) {
      setMessages([])
      return []
    }
    setMessagesLoading(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch chat messages:', error.message)
      setMessages([])
      setMessagesLoading(false)
      return []
    }

    const rows = data ?? []
    setMessages(rows)
    setMessagesLoading(false)
    return rows
  }

  function addEphemeralMessage(sessionId, kind, content) {
    if (selectedSessionIdRef.current !== sessionId) return
    setMessages((prev) => [
      ...prev,
      {
        id: makeLocalId(),
        role: 'system',
        kind,
        content,
        created_at: new Date().toISOString(),
      },
    ])
  }

  async function saveMessage(sessionId, role, content) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ session_id: sessionId, role, content })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function touchSession(sessionId) {
    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from('chat_sessions')
      .update({ updated_at: updatedAt })
      .eq('id', sessionId)

    if (error) {
      console.error('Failed to update session timestamp:', error.message)
      return
    }

    setSessions((prev) =>
      [...prev]
        .map((s) => (s.id === sessionId ? { ...s, updated_at: updatedAt } : s))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
    )
  }

  async function updateSessionTitle(sessionId, title) {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ title })
      .eq('id', sessionId)

    if (error) {
      console.error('Failed to update session title:', error.message)
      return
    }
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s)),
    )
  }

  async function createSessionRow() {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        client_email: client.email,
        bot: client.bot_assigned,
        title: 'New Chat',
      })
      .select()
      .single()

    if (error) {
      setSessionsError(error.message)
      return null
    }
    setSessionsError(null)
    return data
  }

  async function handleNewChat() {
    const created = await createSessionRow()
    if (!created) return
    setSessions((prev) => [created, ...prev])
    setSelectedSessionId(created.id)
    setMessages([])
  }

  async function callChatApi(apiMessages) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot: client.bot_assigned,
        fundiFileText,
        messages: apiMessages,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      const raw =
        data?.error?.message ||
        (typeof data === 'string' ? data : JSON.stringify(data))
      throw new Error(raw)
    }

    return data.reply
  }

  async function runAssistantTurn(sessionId, apiMessages) {
    setSendingSessionId(sessionId)
    try {
      const reply = await callChatApi(apiMessages)

      let visibleContent = reply
      let ticketSummary = null

      if (reply.includes(TICKET_MARKER)) {
        const idx = reply.indexOf(TICKET_MARKER)
        visibleContent = reply.slice(0, idx).trim()
        ticketSummary = reply.slice(idx + TICKET_MARKER.length).trim()
      }

      const savedAssistantMessage = await saveMessage(
        sessionId,
        'assistant',
        visibleContent,
      )
      if (selectedSessionIdRef.current === sessionId) {
        setMessages((prev) => [...prev, savedAssistantMessage])
      }
      await touchSession(sessionId)

      if (ticketSummary) {
        try {
          const ticketResponse = await fetch('/api/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_email: client.email,
              bot: client.bot_assigned,
              summary: ticketSummary,
            }),
          })
          const ticketData = await ticketResponse.json()

          if (!ticketResponse.ok) {
            const raw =
              ticketData?.error?.message ||
              (typeof ticketData === 'string'
                ? ticketData
                : JSON.stringify(ticketData))
            throw new Error(raw)
          }

          addEphemeralMessage(
            sessionId,
            'system-success',
            '✅ Ticket sent to the FundiAI team',
          )
        } catch (ticketError) {
          addEphemeralMessage(sessionId, 'system-error', ticketError.message)
        }
      }
    } catch (error) {
      addEphemeralMessage(sessionId, 'system-error', error.message)
    } finally {
      setSendingSessionId((current) => (current === sessionId ? null : current))
    }
  }

  async function triggerAutoGreeting(sessionId) {
    const greetingPrompt =
      'Greet the client by name and ask what they need help with today. Their name is ' +
      client.full_name
    await runAssistantTurn(sessionId, [
      { role: 'user', content: greetingPrompt },
    ])
  }

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed) return

    let sessionId = selectedSessionId
    let isNewSession = false
    let baseMessages = messages

    if (!sessionId) {
      const created = await createSessionRow()
      if (!created) return
      sessionId = created.id
      isNewSession = true
      baseMessages = []
      greetedSessionsRef.current.add(sessionId)
      setSessions((prev) => [created, ...prev])
      setSelectedSessionId(sessionId)
      setMessages([])
    }

    const isFirstUserMessage =
      isNewSession || !baseMessages.some((m) => m.role === 'user')

    let savedUserMessage
    try {
      savedUserMessage = await saveMessage(sessionId, 'user', trimmed)
    } catch (saveError) {
      addEphemeralMessage(sessionId, 'system-error', saveError.message)
      return
    }

    if (selectedSessionIdRef.current === sessionId) {
      setMessages((prev) => [...prev, savedUserMessage])
    }
    setInput('')
    await touchSession(sessionId)

    if (isFirstUserMessage) {
      updateSessionTitle(sessionId, deriveTitle(trimmed))
    }

    const history = [...baseMessages, savedUserMessage]
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }))

    await runAssistantTurn(sessionId, history)
  }

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId
  }, [selectedSessionId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.email])

  useEffect(() => {
    let cancelled = false

    async function loadAndMaybeGreet() {
      const rows = await fetchMessages(selectedSessionId)
      if (cancelled) return
      if (
        selectedSessionId &&
        rows.length === 0 &&
        !greetedSessionsRef.current.has(selectedSessionId)
      ) {
        greetedSessionsRef.current.add(selectedSessionId)
        triggerAutoGreeting(selectedSessionId)
      }
    }

    loadAndMaybeGreet()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, sendingSessionId])

  const isSending = sendingSessionId === selectedSessionId

  return (
    <div className="flex h-full gap-6 overflow-hidden font-sans">
      <div className="flex h-full w-72 flex-shrink-0 flex-col gap-4">
        <AgentCard botAssigned={client.bot_assigned} />

        <h2 className="text-sm font-semibold text-fundi-dark/70">
          Recent Chats
        </h2>

        {sessionsError && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">
            {sessionsError}
          </div>
        )}

        <div className="flex-1 space-y-1 overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setSelectedSessionId(session.id)}
              className={`w-full rounded-xl px-3 py-2 text-left transition ${
                session.id === selectedSessionId
                  ? 'bg-fundi-bg'
                  : 'hover:bg-fundi-bg/60'
              }`}
            >
              <p className="truncate text-sm font-medium text-fundi-dark">
                {session.title}
              </p>
              <p className="text-xs text-gray-400">
                {formatDistanceToNowStrict(new Date(session.updated_at), {
                  addSuffix: true,
                })}
              </p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/schedule')}
            aria-label="Content schedule"
            className="flex aspect-square items-center justify-center rounded-2xl border-2 border-fundi-blue bg-white text-fundi-blue transition hover:bg-fundi-bg"
          >
            <Calendar size={22} />
          </button>
          <button
            type="button"
            disabled
            aria-label="Insights (coming soon)"
            title="Coming soon"
            className="flex aspect-square items-center justify-center rounded-2xl border-2 border-gray-200 bg-white text-gray-300"
            style={{ cursor: 'not-allowed' }}
          >
            <BarChart2 size={22} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleNewChat}
          className="w-full rounded-full bg-fundi-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          New Chat
        </button>
      </div>

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {!selectedSessionId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
            <h1 className="text-2xl font-semibold text-fundi-dark">
              Hello, what would you like me to do for you?
            </h1>
            <div className="w-full max-w-2xl">
              <MessageInputBar
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                disabled={false}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
              {messagesLoading && (
                <p className="text-center text-sm text-gray-400">
                  Loading messages...
                </p>
              )}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  botAssigned={client.bot_assigned}
                />
              ))}
              {isSending && (
                <TypingIndicatorRow botAssigned={client.bot_assigned} />
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="mx-auto w-full max-w-2xl px-2 pb-2">
              <MessageInputBar
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                disabled={isSending}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BotAvatar({ botAssigned }) {
  const label = BOT_LABEL[botAssigned] ?? 'F'
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-fundi-dark text-xs font-semibold text-white">
      {label.charAt(0)}
    </div>
  )
}

function MessageBubble({ message, botAssigned }) {
  if (message.role === 'system') {
    const isError = message.kind === 'system-error'
    return (
      <div className="flex justify-center">
        <div
          className={`max-w-md rounded-xl px-4 py-2 text-center text-sm ${
            isError
              ? 'bg-red-50 text-red-600'
              : 'bg-fundi-green/10 text-fundi-green'
          }`}
        >
          {message.content}
        </div>
      </div>
    )
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-md rounded-2xl rounded-br-sm bg-gradient-to-br from-fundi-green to-fundi-dark px-4 py-2 text-white">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end justify-start gap-2">
      <BotAvatar botAssigned={botAssigned} />
      <div className="max-w-md rounded-2xl rounded-bl-sm bg-gradient-to-br from-fundi-blue to-fundi-dark px-4 py-2 text-white">
        {message.content}
      </div>
    </div>
  )
}

function TypingIndicatorRow({ botAssigned }) {
  return (
    <div className="flex items-end justify-start gap-2">
      <BotAvatar botAssigned={botAssigned} />
      <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-gradient-to-br from-fundi-blue to-fundi-dark px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-white" />
      </div>
    </div>
  )
}

function MessageInputBar({ value, onChange, onSubmit, disabled }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm"
    >
      <button
        type="button"
        aria-label="Attach file"
        disabled
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400"
      >
        <Paperclip size={18} />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a message..."
        disabled={disabled}
        className="flex-1 border-none bg-transparent text-sm text-fundi-dark outline-none placeholder:text-gray-400"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-fundi-green text-white transition hover:opacity-90 disabled:opacity-50"
      >
        <Send size={16} />
      </button>
    </form>
  )
}
