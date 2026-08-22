import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNowStrict,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Camera,
  FileText,
  Check,
  AlertTriangle,
  Lock,
} from 'lucide-react'
import { useClient } from '../context/ClientContext'
import { supabase } from '../lib/supabase'
import ErrorBoundary from '../components/ErrorBoundary'

const PLATFORMS = ['facebook', 'instagram', 'blog']
const FILTER_OPTIONS = ['all', ...PLATFORMS]
const PLATFORM_LABELS = {
  all: 'All',
  facebook: 'Facebook',
  instagram: 'Instagram',
  blog: 'Blog',
}
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const BOT_NAMES = {
  poppie: 'Poppie',
  chad: 'Chad',
}

const SELECTION_THRESHOLD = 2
const REVIEW_CUTOFF_HOURS = 48

// post.time comes back as either 24-hour ("16:00") or 12-hour with a
// meridiem ("4:00 PM"), so it can't just be appended to post.date and
// handed to parseISO — that silently produces an Invalid Date for the
// 12-hour case and the post never locks.
function parseTimeParts(timeStr) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(
    (timeStr || '').trim(),
  )
  if (!match) return { hours: 0, minutes: 0 }
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toUpperCase()
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return { hours, minutes }
}

// Combines post.date + post.time into the actual scheduled moment, so
// "hours until post" reflects publish time rather than just the day.
function hoursUntilPost(post) {
  if (!post?.date) return Infinity
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(post.date)
  if (!dateMatch) return Infinity
  const [, year, month, day] = dateMatch.map(Number)
  const { hours, minutes } = parseTimeParts(post.time)
  const postDateTime = new Date(year, month - 1, day, hours, minutes)
  if (Number.isNaN(postDateTime.getTime())) return Infinity
  return (postDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, value))
}

function getRelativePercent(e, el) {
  const rect = el.getBoundingClientRect()
  return {
    x: clampPercent(((e.clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((e.clientY - rect.top) / rect.height) * 100),
  }
}

function PlatformIcon({ platform, size = 12 }) {
  if (platform === 'facebook') {
    return (
      <span
        className="flex flex-shrink-0 items-center justify-center rounded-full bg-[#1877F2] font-bold text-white"
        style={{ width: size + 4, height: size + 4, fontSize: size - 2 }}
      >
        f
      </span>
    )
  }
  if (platform === 'instagram') {
    return (
      <span
        className="flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-400 text-white"
        style={{ width: size + 4, height: size + 4 }}
      >
        <Camera size={size - 2} />
      </span>
    )
  }
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-fundi-dark text-white"
      style={{ width: size + 4, height: size + 4 }}
    >
      <FileText size={size - 2} />
    </span>
  )
}

function BotAvatar({ botName }) {
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-fundi-dark text-xs font-semibold text-white">
      {botName.charAt(0)}
    </div>
  )
}

function ScheduleContent() {
  const { client } = useClient()

  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()))

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rawResponse, setRawResponse] = useState(null)
  const [debugOpen, setDebugOpen] = useState(false)

  const [modalPost, setModalPost] = useState(null)

  const fetchTokenRef = useRef(0)

  async function fetchSchedule() {
    if (!client.schedule_sheet_id) {
      setPosts([])
      setError(null)
      setRawResponse(null)
      return
    }

    const token = ++fetchTokenRef.current
    setLoading(true)
    setError(null)

    try {
      const results = await Promise.all(
        PLATFORMS.map(async (platform) => {
          const response = await fetch(
            `/api/schedule?action=schedule&sheetId=${encodeURIComponent(client.schedule_sheet_id)}&tab=${encodeURIComponent(platform)}`,
          )
          const data = await response.json()
          return { platform, response, data }
        }),
      )
      if (fetchTokenRef.current !== token) return

      setRawResponse(
        Object.fromEntries(results.map(({ platform, data }) => [platform, data])),
      )

      const failed = results.find(({ response, data }) => !response.ok || data?.error)
      if (failed) {
        setError(
          failed.data?.error ||
            `Request failed with status ${failed.response.status}`,
        )
        setPosts([])
        return
      }

      const merged = results.flatMap(({ platform, data }) => {
        const rows = Array.isArray(data) ? data : (data.posts ?? [])
        return rows.map((post) => ({ ...post, platform }))
      })
      setPosts(merged)
    } catch (err) {
      if (fetchTokenRef.current !== token) return
      setError(err.message)
      setPosts([])
    } finally {
      if (fetchTokenRef.current === token) setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.schedule_sheet_id, visibleMonth])

  const filteredPosts = useMemo(() => {
    if (selectedPlatform === 'all') return posts
    return posts.filter((post) => post.platform === selectedPlatform)
  }, [posts, selectedPlatform])

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth)
    const monthEnd = endOfMonth(visibleMonth)
    const gridStart = startOfWeek(monthStart)
    const gridEnd = endOfWeek(monthEnd)
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [visibleMonth])

  return (
    <div
      className="flex h-full flex-col gap-4 font-sans"
      onClick={() => platformMenuOpen && setPlatformMenuOpen(false)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fundi-dark">
            Content Planner
          </h1>
          <p className="text-sm text-gray-500">
            Review the planned schedule for the month.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span className="max-w-xs">
            All changes, edits, or comments must be submitted at least 48
            hours before the scheduled post time.
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setPlatformMenuOpen((v) => !v)
            }}
            className="flex items-center gap-2 rounded-full bg-fundi-bg px-4 py-2 text-sm font-medium text-fundi-dark transition hover:bg-fundi-bg/70"
          >
            <Filter size={14} />
            {PLATFORM_LABELS[selectedPlatform]}
          </button>
          {platformMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-full z-10 mt-1 w-36 rounded-xl bg-white p-1 shadow-lg"
            >
              {FILTER_OPTIONS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => {
                    setSelectedPlatform(platform)
                    setPlatformMenuOpen(false)
                  }}
                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                    selectedPlatform === platform
                      ? 'bg-fundi-bg font-medium text-fundi-dark'
                      : 'text-fundi-dark hover:bg-fundi-bg/60'
                  }`}
                >
                  {PLATFORM_LABELS[platform]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-fundi-dark transition hover:bg-fundi-bg"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="w-36 text-center text-base font-semibold text-fundi-dark">
            {format(visibleMonth, 'MMMM yyyy')}
          </h2>
          <button
            type="button"
            onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-fundi-dark transition hover:bg-fundi-bg"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-gray-200">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-gray-200 bg-fundi-bg py-2 text-center text-xs font-semibold text-fundi-dark/60"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!client.schedule_sheet_id ? (
          <p className="mt-16 text-center text-sm text-gray-400">
            No schedule sheet configured for this client yet
          </p>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-fundi-bg"
              />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <p className="mt-16 text-center text-sm text-gray-400">
            No posts scheduled yet
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-xl border border-t-0 border-gray-200 bg-gray-200">
            {gridDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayPosts = filteredPosts.filter((post) => post.date === dateStr)
              const inMonth = isSameMonth(day, visibleMonth)

              return (
                <div
                  key={dateStr}
                  onClick={() => dayPosts[0] && setModalPost(dayPosts[0])}
                  className={`min-h-24 bg-white p-1.5 ${
                    dayPosts.length > 0 ? 'cursor-pointer' : ''
                  } ${inMonth ? '' : 'bg-gray-50'}`}
                >
                  <span
                    className={`text-xs ${
                      inMonth ? 'text-fundi-dark' : 'text-gray-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayPosts.map((post, i) => (
                      <button
                        key={post.rowNumber ?? i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setModalPost(post)
                        }}
                        className="flex w-full items-center gap-1 rounded-full bg-fundi-bg px-1.5 py-0.5 text-[10px] font-medium text-fundi-dark transition hover:bg-fundi-bg/70"
                      >
                        <PlatformIcon platform={post.platform} />
                        {post.time && <span className="truncate">{post.time}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {import.meta.env.DEV && (
        <div className="border-t border-gray-200 pt-3">
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            {debugOpen ? '▾' : '▸'} Debug: raw API response (dev only)
          </button>
          {debugOpen && (
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-fundi-dark p-3 text-xs text-white">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          )}
        </div>
      )}

      {modalPost && (
        <PostModal
          post={modalPost}
          platform={modalPost.platform}
          client={client}
          onClose={() => setModalPost(null)}
          onApproved={fetchSchedule}
        />
      )}
    </div>
  )
}

function PostModal({ post, platform, client, onClose, onApproved }) {
  const botName = BOT_NAMES[client.bot_assigned] ?? 'Fundi'

  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState(null)
  const [approvedLocally, setApprovedLocally] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Image region comments
  const [submittedRegions, setSubmittedRegions] = useState([])
  const [dragging, setDragging] = useState(false)
  const [draftRegion, setDraftRegion] = useState(null)
  const [cardMode, setCardMode] = useState(null) // 'form' | 'sending' | null
  const [commentText, setCommentText] = useState('')
  const [submitError, setSubmitError] = useState(null)

  // Caption comments
  const [captionComments, setCaptionComments] = useState([])
  const [captionCommentOpen, setCaptionCommentOpen] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [captionSubmitting, setCaptionSubmitting] = useState(false)
  const [captionSubmitError, setCaptionSubmitError] = useState(null)

  const confirmTimeoutRef = useRef(null)
  const imageRef = useRef(null)
  const dragStartRef = useRef(null)

  const isApproved = approvedLocally || post.status === 'approved'
  const hasImage = !imgError && post.image_url
  const isLocked = hoursUntilPost(post) <= REVIEW_CUTOFF_HOURS

  let formattedDate
  try {
    formattedDate = format(parseISO(post.date), 'EEEE, d MMMM yyyy')
  } catch {
    formattedDate = post.date
  }

  useEffect(() => {
    return () => clearTimeout(confirmTimeoutRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadReviews() {
      const { data, error } = await supabase
        .from('schedule_reviews')
        .select('*')
        .eq('client_email', client.email)
        .eq('sheet_id', client.schedule_sheet_id)
        .eq('tab', platform)
        .eq('row_number', post.rowNumber)

      if (cancelled) return
      if (error) {
        console.error('Failed to load schedule reviews:', error.message)
        return
      }
      const rows = data ?? []
      setSubmittedRegions(rows.filter((r) => r.kind === 'image_comment'))
      setCaptionComments(rows.filter((r) => r.kind === 'caption_comment'))
    }

    loadReviews()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!dragging) return

    function handleMove(e) {
      if (!imageRef.current || !dragStartRef.current) return
      const point = getRelativePercent(e, imageRef.current)
      const start = dragStartRef.current
      setDraftRegion({
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y),
      })
    }

    function handleUp() {
      setDragging(false)
      setDraftRegion((region) => {
        if (!region) return null
        if (
          region.width < SELECTION_THRESHOLD ||
          region.height < SELECTION_THRESHOLD
        ) {
          return null
        }
        setCardMode('form')
        return region
      })
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging])

  function handleImageMouseDown(e) {
    if (!imageRef.current || isLocked) return
    e.preventDefault()
    const point = getRelativePercent(e, imageRef.current)
    dragStartRef.current = point
    // Discards any in-progress, unsubmitted draft — it was never saved.
    setDraftRegion({ x: point.x, y: point.y, width: 0, height: 0 })
    setCardMode(null)
    setSubmitError(null)
    setDragging(true)
  }

  function handleCancelDraft() {
    setDraftRegion(null)
    setCardMode(null)
    setCommentText('')
    setSubmitError(null)
  }

  async function postTicket(summary) {
    const ticketResponse = await fetch('/api/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_email: client.email,
        bot: client.bot_assigned,
        summary,
      }),
    })
    const ticketData = await ticketResponse.json()

    if (!ticketResponse.ok || ticketData?.error) {
      const raw =
        ticketData?.error?.message ||
        ticketData?.error ||
        (typeof ticketData === 'string'
          ? ticketData
          : JSON.stringify(ticketData))
      throw new Error(raw)
    }
  }

  async function handleApprove() {
    setApproving(true)
    setApproveError(null)
    try {
      const response = await fetch(
        `/api/schedule?action=approve&sheetId=${encodeURIComponent(client.schedule_sheet_id)}&tab=${encodeURIComponent(platform)}&row=${encodeURIComponent(post.rowNumber)}`,
      )
      const data = await response.json()

      if (!response.ok || data?.error) {
        throw new Error(
          data?.error || `Request failed with status ${response.status}`,
        )
      }

      setApprovedLocally(true)
      setShowConfirmation(true)
      clearTimeout(confirmTimeoutRef.current)
      confirmTimeoutRef.current = setTimeout(
        () => setShowConfirmation(false),
        2000,
      )
      onApproved()
    } catch (err) {
      setApproveError(err.message)
    } finally {
      setApproving(false)
    }
  }

  async function handleSubmitRegionComment() {
    const trimmed = commentText.trim()
    if (!trimmed || !draftRegion) return

    setCardMode('sending')
    setSubmitError(null)

    try {
      const { data: insertedRow, error: insertError } = await supabase
        .from('schedule_reviews')
        .insert({
          client_email: client.email,
          sheet_id: client.schedule_sheet_id,
          tab: platform,
          row_number: post.rowNumber,
          kind: 'image_comment',
          region_json: draftRegion,
          comment: trimmed,
          image_url: post.image_url,
          caption_snapshot: post.caption,
          post_date: post.date,
        })
        .select()
        .single()
      if (insertError) throw new Error(insertError.message)

      await postTicket(
        `Comment on scheduled ${platform} post image (${post.date}): ${trimmed}` +
          `\n\nView: ${window.location.origin}/schedule-review/${insertedRow.id}`,
      )

      setSubmittedRegions((prev) => [...prev, insertedRow])
      setDraftRegion(null)
      setCardMode(null)
      setCommentText('')
    } catch (err) {
      setSubmitError(err.message)
      setCardMode('form')
    }
  }

  async function handleSubmitCaptionComment() {
    const trimmed = captionText.trim()
    if (!trimmed) return

    setCaptionSubmitting(true)
    setCaptionSubmitError(null)

    try {
      const { data: insertedRow, error: insertError } = await supabase
        .from('schedule_reviews')
        .insert({
          client_email: client.email,
          sheet_id: client.schedule_sheet_id,
          tab: platform,
          row_number: post.rowNumber,
          kind: 'caption_comment',
          region_json: null,
          comment: trimmed,
          image_url: post.image_url,
          caption_snapshot: post.caption,
          post_date: post.date,
        })
        .select()
        .single()
      if (insertError) throw new Error(insertError.message)

      await postTicket(
        `Comment on scheduled ${platform} post caption (${post.date}): ${trimmed}` +
          `\n\nView: ${window.location.origin}/schedule-review/${insertedRow.id}`,
      )

      setCaptionComments((prev) => [...prev, insertedRow])
      setCaptionText('')
      setCaptionCommentOpen(false)
    } catch (err) {
      setCaptionSubmitError(err.message)
    } finally {
      setCaptionSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-fundi-dark">
            {formattedDate}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-fundi-bg"
          >
            <X size={18} />
          </button>
        </div>

        {isLocked && (
          <div
            className={`mb-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
              post.auto_approved
                ? 'bg-amber-50 text-amber-700'
                : 'bg-fundi-bg text-fundi-dark/70'
            }`}
          >
            <Lock size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              {post.auto_approved
                ? 'Schedule has already been pre-approved due to no response received.'
                : 'This post is now locked for production.'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fundi-dark/50">
              Caption
            </p>
            <div className="h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-fundi-bg p-3 text-sm text-fundi-dark">
              {post.caption || 'No caption provided.'}
            </div>

            <div className="mt-2 space-y-2">
              {captionComments.length > 0 && (
                <div className="space-y-1.5">
                  {captionComments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg bg-fundi-blue/10 p-2 text-xs text-fundi-dark"
                    >
                      <p className="whitespace-pre-wrap">{c.comment}</p>
                      {c.created_at && (
                        <p className="mt-1 text-[10px] text-gray-400">
                          {formatDistanceToNowStrict(
                            new Date(c.created_at),
                            { addSuffix: true },
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isLocked ? null : !captionCommentOpen ? (
                <button
                  type="button"
                  onClick={() => setCaptionCommentOpen(true)}
                  className="text-xs font-medium text-fundi-blue hover:underline"
                >
                  💬 Comment on this caption
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    disabled={captionSubmitting}
                    placeholder="Type your comment..."
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-fundi-dark outline-none focus:border-fundi-blue"
                  />
                  {captionSubmitError && (
                    <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">
                      {captionSubmitError}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCaptionCommentOpen(false)
                        setCaptionText('')
                        setCaptionSubmitError(null)
                      }}
                      disabled={captionSubmitting}
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-fundi-dark hover:bg-fundi-bg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitCaptionComment}
                      disabled={captionSubmitting || !captionText.trim()}
                      className="rounded-full bg-fundi-blue px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {captionSubmitting ? 'Sending...' : 'Comment'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-fundi-dark/50">
              Publishing
            </p>
            <div className="flex items-center gap-2 text-sm text-fundi-dark">
              <PlatformIcon platform={platform} size={14} />
              <span>{post.time || 'Time not set'}</span>
            </div>

            <div className="mt-4">
              {isApproved ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-fundi-green/10 px-3 py-1 text-xs font-medium text-fundi-green">
                  <Check size={12} />
                  Approved
                </span>
              ) : isLocked ? null : (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approving}
                  className="rounded-full bg-fundi-green px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {approving ? 'Approving...' : 'Approve'}
                </button>
              )}
              {showConfirmation && (
                <p className="mt-2 text-xs font-medium text-fundi-green">
                  ✅ Approved!
                </p>
              )}
              {approveError && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                  {approveError}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            {hasImage ? (
              <>
                <img
                  ref={imageRef}
                  src={post.image_url}
                  alt=""
                  onError={() => setImgError(true)}
                  onMouseDown={handleImageMouseDown}
                  className="h-full w-full select-none rounded-lg object-cover"
                  style={{ cursor: isLocked ? 'default' : 'crosshair' }}
                  draggable={false}
                />

                {submittedRegions.map((region) => {
                  const r = region.region_json
                  if (!r) return null
                  return (
                    <div
                      key={region.id}
                      title={region.comment}
                      className="absolute border-2 border-fundi-blue bg-fundi-blue/20"
                      style={{
                        left: `${r.x}%`,
                        top: `${r.y}%`,
                        width: `${r.width}%`,
                        height: `${r.height}%`,
                      }}
                    >
                      <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-fundi-green text-white shadow">
                        <Check size={12} />
                      </div>
                    </div>
                  )
                })}

                {draftRegion && (
                  <div
                    className="pointer-events-none absolute border-2 border-fundi-blue bg-fundi-blue/20"
                    style={{
                      left: `${draftRegion.x}%`,
                      top: `${draftRegion.y}%`,
                      width: `${draftRegion.width}%`,
                      height: `${draftRegion.height}%`,
                    }}
                  />
                )}

                {draftRegion && cardMode && (
                  <div
                    className="absolute z-10 w-56 rounded-xl bg-white p-3 shadow-xl"
                    style={{
                      left: `${draftRegion.x}%`,
                      top: `${Math.min(draftRegion.y + draftRegion.height, 90)}%`,
                      marginTop: '0.5rem',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <BotAvatar botName={botName} />
                      <p className="text-xs font-medium text-fundi-dark">
                        {botName} — What would you like me to change?
                      </p>
                    </div>
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      disabled={cardMode === 'sending'}
                      placeholder="Type your comment..."
                      className="mb-2 w-full rounded-full border border-gray-200 px-3 py-1.5 text-sm text-fundi-dark outline-none focus:border-fundi-blue"
                    />
                    {submitError && (
                      <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                        {submitError}
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelDraft}
                        disabled={cardMode === 'sending'}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-fundi-dark hover:bg-fundi-bg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitRegionComment}
                        disabled={cardMode === 'sending' || !commentText.trim()}
                        className="rounded-full bg-fundi-blue px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {cardMode === 'sending' ? 'Sending...' : 'Comment'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-lg bg-fundi-bg text-gray-300">
                <Camera size={28} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Schedule() {
  return (
    <ErrorBoundary>
      <ScheduleContent />
    </ErrorBoundary>
  )
}
