import { useEffect, useRef, useState } from 'react'
import {
  Info,
  Folder,
  Clock,
  Trash2,
  MousePointer2,
  Image,
  Cloud,
  MoreVertical,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  Check,
} from 'lucide-react'
import { useClient } from '../context/ClientContext'
import { supabase } from '../lib/supabase'

const RECENT_KEY_PREFIX = 'fundi_recent_'
const MAX_RECENT = 5

const BOT_NAMES = {
  poppie: 'Poppie',
  chad: 'Chad',
}

function getRecentFolders(email) {
  try {
    const raw = localStorage.getItem(RECENT_KEY_PREFIX + email)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function addRecentFolder(email, folder) {
  const existing = getRecentFolders(email).filter((f) => f.id !== folder.id)
  const updated = [{ id: folder.id, name: folder.name }, ...existing].slice(
    0,
    MAX_RECENT,
  )
  localStorage.setItem(RECENT_KEY_PREFIX + email, JSON.stringify(updated))
  return updated
}

function extractError(data) {
  if (data && typeof data.error === 'string') return data.error
  return JSON.stringify(data)
}

export default function Workspace() {
  const { client } = useClient()

  const [mainFileOpened, setMainFileOpened] = useState(false)
  const [folders, setFolders] = useState([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersError, setFoldersError] = useState(null)

  const [selectedFolder, setSelectedFolder] = useState(null)
  const [files, setFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState(null)

  const [recentFolders, setRecentFolders] = useState(() =>
    getRecentFolders(client.email),
  )
  const [openMenuId, setOpenMenuId] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  async function fetchFolders() {
    setFoldersLoading(true)
    setFoldersError(null)
    try {
      const response = await fetch(
        `/api/files?action=folders&folderId=${encodeURIComponent(client.drive_folder_id ?? '')}`,
      )
      const data = await response.json()
      if (!response.ok || data?.error) {
        setFoldersError(extractError(data))
        setFolders([])
        return
      }
      setFolders(Array.isArray(data) ? data : (data.folders ?? []))
    } catch (err) {
      setFoldersError(err.message)
      setFolders([])
    } finally {
      setFoldersLoading(false)
    }
  }

  async function fetchFiles(folderId) {
    setFilesLoading(true)
    setFilesError(null)
    try {
      const response = await fetch(
        `/api/files?action=files&folderId=${encodeURIComponent(folderId)}`,
      )
      const data = await response.json()
      if (!response.ok || data?.error) {
        setFilesError(extractError(data))
        setFiles([])
        return
      }
      setFiles(Array.isArray(data) ? data : (data.files ?? []))
    } catch (err) {
      setFilesError(err.message)
      setFiles([])
    } finally {
      setFilesLoading(false)
    }
  }

  function openMainFile() {
    setMainFileOpened(true)
    setSelectedFolder(null)
    fetchFolders()
  }

  function openFolder(folder) {
    setMainFileOpened(true)
    setSelectedFolder(folder)
    setOpenMenuId(null)
    setRecentFolders(addRecentFolder(client.email, folder))
    fetchFiles(folder.id)
  }

  const isMainFileActive = mainFileOpened

  return (
    <div className="flex h-full gap-6 overflow-hidden font-sans">
      <div className="flex h-full w-64 flex-shrink-0 flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <h2 className="text-lg font-semibold text-fundi-dark">
            Fundi Workspace
          </h2>
          <button
            type="button"
            aria-label="More info"
            className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-fundi-bg"
          >
            <Info size={13} />
          </button>
        </div>

        <button
          type="button"
          onClick={openMainFile}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left transition ${
            isMainFileActive ? 'bg-fundi-bg' : 'hover:bg-fundi-bg/60'
          }`}
        >
          <Folder size={18} className="text-fundi-blue" />
          <span className="text-sm font-medium text-fundi-dark">
            Main File
          </span>
        </button>

        <div className="flex-1 overflow-y-auto">
          <div className="mb-2 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-fundi-dark/50">
            <Clock size={13} />
            Recent
          </div>
          <div className="space-y-1">
            {recentFolders.length === 0 ? (
              <p className="px-3 text-xs text-gray-400">
                No recent folders yet
              </p>
            ) : (
              recentFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => openFolder(folder)}
                  className="w-full truncate rounded-lg px-3 py-1.5 text-left text-sm text-fundi-dark transition hover:bg-fundi-bg/60"
                >
                  {folder.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2 text-gray-400">
          <Trash2 size={18} />
          <span className="text-sm">
            Bin <span className="text-xs">(coming soon)</span>
          </span>
        </div>
      </div>

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {!mainFileOpened ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <MousePointer2 size={28} className="text-fundi-blue" />
            <h1 className="text-2xl font-semibold text-fundi-blue">
              Select a folder to start
            </h1>
            <p className="max-w-sm text-sm text-gray-500">
              Upload or explore content in each folder in the Fundi Workspace
              Folders.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setSelectedFolder(null)}
                className={
                  selectedFolder
                    ? 'text-fundi-dark hover:underline'
                    : 'font-medium text-fundi-blue'
                }
              >
                Main File
              </button>
              {selectedFolder && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="font-medium text-fundi-blue">
                    {selectedFolder.name}
                  </span>
                </>
              )}
            </div>

            <h3 className="mb-3 text-sm font-semibold text-fundi-dark/70">
              Folders
            </h3>

            <div
              className="flex-1 overflow-y-auto"
              onClick={() => openMenuId && setOpenMenuId(null)}
            >
              {!selectedFolder ? (
                foldersError ? (
                  <ErrorBox message={foldersError} />
                ) : foldersLoading ? (
                  <SkeletonGrid />
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => openFolder(folder)}
                        className="flex flex-col items-center gap-2 rounded-2xl bg-fundi-bg p-4 text-fundi-dark transition hover:bg-fundi-blue hover:text-white"
                      >
                        <Folder size={28} />
                        <span className="w-full truncate text-center text-sm">
                          {folder.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : filesError ? (
                <ErrorBox message={filesError} />
              ) : filesLoading ? (
                <SkeletonGrid />
              ) : files.length === 0 ? (
                <p className="mt-16 text-center text-sm text-gray-400">
                  No files in this folder yet
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {files.map((file, index) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      isMenuOpen={openMenuId === file.id}
                      onToggleMenu={() =>
                        setOpenMenuId((prev) =>
                          prev === file.id ? null : file.id,
                        )
                      }
                      onOpen={() => setLightboxIndex(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          key={files[lightboxIndex]?.id}
          files={files}
          index={lightboxIndex}
          client={client}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl bg-fundi-bg"
        />
      ))}
    </div>
  )
}

function ErrorBox({ message }) {
  return (
    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
      {message}
    </div>
  )
}

function FileCard({ file, isMenuOpen, onToggleMenu, onOpen }) {
  const [imgError, setImgError] = useState(false)
  const name = file.name ?? file.filename ?? 'Untitled'

  return (
    <div className="overflow-hidden rounded-2xl bg-fundi-bg">
      <div className="flex items-center justify-between gap-2 bg-gray-200/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Image size={14} className="flex-shrink-0 text-gray-500" />
          <span className="truncate text-xs font-medium text-fundi-dark">
            {name}
          </span>
        </div>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu()
            }}
            className="rounded p-1 text-gray-500 hover:bg-gray-300"
          >
            <MoreVertical size={14} />
          </button>
          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg bg-white p-1 shadow-lg"
            >
              <a
                href={`/api/image?fileId=${file.id}&download=1&name=${encodeURIComponent(name)}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fundi-dark hover:bg-fundi-bg"
              >
                <Download size={12} />
                Download
              </a>
              <div className="px-2 py-1.5 text-xs text-gray-400">
                File Size: {file.sizeKB}KB
              </div>
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={onOpen} className="block w-full">
        {imgError || !file.thumbnailUrl ? (
          <div className="flex h-32 w-full items-center justify-center bg-gray-100 text-gray-300">
            <Cloud size={28} />
          </div>
        ) : (
          <img
            src={`/api/image?fileId=${file.id}`}
            alt={name}
            onError={() => setImgError(true)}
            className="h-32 w-full object-cover"
          />
        )}
      </button>
    </div>
  )
}

function BotAvatar({ botName }) {
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-fundi-dark text-xs font-semibold text-white">
      {botName.charAt(0)}
    </div>
  )
}

const SELECTION_THRESHOLD = 2

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

function Lightbox({ files, index, client, onClose, onNavigate }) {
  const file = files[index]
  const name = file.name ?? file.filename ?? 'Untitled'
  const botName = BOT_NAMES[client.bot_assigned] ?? 'Fundi'

  const [approved, setApproved] = useState(false)
  const [approving, setApproving] = useState(false)
  const [justConfirmed, setJustConfirmed] = useState(false)
  const [approveError, setApproveError] = useState(null)

  const [dragging, setDragging] = useState(false)
  const [draftRegion, setDraftRegion] = useState(null)
  const [cardMode, setCardMode] = useState(null) // 'form' | 'sending' | null
  const [commentText, setCommentText] = useState('')
  const [submitError, setSubmitError] = useState(null)
  const [submittedRegions, setSubmittedRegions] = useState([])

  const imageRef = useRef(null)
  const dragStartRef = useRef(null)
  const confirmTimeoutRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function checkApproval() {
      const { data, error } = await supabase
        .from('file_reviews')
        .select('id')
        .eq('file_id', file.id)
        .eq('client_email', client.email)
        .eq('kind', 'approve')

      if (cancelled) return
      if (!error && data && data.length > 0) {
        setApproved(true)
      }
    }

    checkApproval()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSubmittedRegions() {
      const { data, error } = await supabase
        .from('file_reviews')
        .select('*')
        .eq('file_id', file.id)
        .eq('client_email', client.email)
        .eq('kind', 'comment')

      if (cancelled) return
      if (error) {
        console.error('Failed to load submitted regions:', error.message)
        return
      }
      setSubmittedRegions(data ?? [])
    }

    loadSubmittedRegions()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(confirmTimeoutRef.current)
    }
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
    if (!imageRef.current) return
    e.preventDefault()
    const point = getRelativePercent(e, imageRef.current)
    dragStartRef.current = point
    // Discards any in-progress, unsubmitted draft — it was never saved.
    setDraftRegion({ x: point.x, y: point.y, width: 0, height: 0 })
    setCardMode(null)
    setSubmitError(null)
    setDragging(true)
  }

  async function handleApprove() {
    if (approving || approved) return
    setApproving(true)
    setApproveError(null)
    try {
      const { error } = await supabase.from('file_reviews').insert({
        client_email: client.email,
        file_id: file.id,
        file_name: name,
        kind: 'approve',
      })
      if (error) throw new Error(error.message)

      setApproved(true)
      setJustConfirmed(true)
      clearTimeout(confirmTimeoutRef.current)
      confirmTimeoutRef.current = setTimeout(
        () => setJustConfirmed(false),
        1500,
      )
    } catch (err) {
      setApproveError(err.message)
    } finally {
      setApproving(false)
    }
  }

  function handleCancelDraft() {
    setDraftRegion(null)
    setCardMode(null)
    setCommentText('')
    setSubmitError(null)
  }

  async function handleSubmitComment() {
    const trimmed = commentText.trim()
    if (!trimmed || !draftRegion) return

    setCardMode('sending')
    setSubmitError(null)

    try {
      const { data: insertedReview, error: reviewError } = await supabase
        .from('file_reviews')
        .insert({
          client_email: client.email,
          file_id: file.id,
          file_name: name,
          kind: 'comment',
          region_json: draftRegion,
          comment: trimmed,
        })
        .select()
        .single()
      if (reviewError) throw new Error(reviewError.message)

      const summary =
        `Revision request on ${name}: ${trimmed}` +
        `\n\nView the marked-up image: ${window.location.origin}/review/${insertedReview.id}`

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

      setSubmittedRegions((prev) => [...prev, insertedReview])
      setDraftRegion(null)
      setCardMode(null)
      setCommentText('')
    } catch (err) {
      setSubmitError(err.message)
      setCardMode('form')
    }
  }

  const hasPrev = index > 0
  const hasNext = index < files.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
      onClick={onClose}
    >
      <div className="absolute left-6 top-6 flex items-center gap-2 text-white">
        <Image size={16} />
        <p className="text-sm font-medium">{name}</p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X size={20} />
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(index - 1)
          }}
          aria-label="Previous file"
          className="absolute left-6 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-fundi-dark text-white transition hover:bg-fundi-dark/80"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(index + 1)
          }}
          aria-label="Next file"
          className="absolute right-6 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-fundi-dark text-white transition hover:bg-fundi-dark/80"
        >
          <ChevronRight size={22} />
        </button>
      )}

      <div
        className="relative max-h-[85vh] max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          ref={imageRef}
          src={`/api/image?fileId=${file.id}`}
          alt={name}
          onMouseDown={handleImageMouseDown}
          className="max-h-[85vh] max-w-full select-none rounded-lg object-contain"
          style={{ cursor: 'crosshair' }}
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

        <div className="absolute right-4 top-4 flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving || approved}
            aria-label="Approve file"
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition ${
              approved
                ? 'bg-fundi-green text-white'
                : 'bg-white text-fundi-dark hover:bg-fundi-green hover:text-white'
            }`}
          >
            {justConfirmed ? (
              <Check size={20} />
            ) : (
              <ThumbsUp size={18} fill={approved ? 'currentColor' : 'none'} />
            )}
          </button>
          {approveError && (
            <div className="max-w-[200px] rounded-lg bg-red-50 px-2 py-1 text-right text-xs text-red-600">
              {approveError}
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-4 flex max-w-xs items-start gap-2 rounded-2xl bg-gradient-to-br from-fundi-blue to-fundi-dark p-3 text-white shadow-lg">
          <BotAvatar botName={botName} />
          <p className="text-xs leading-snug">
            <span className="font-semibold">{botName}</span> — If you don't
            want anything changed, give it a thumbs up.
          </p>
        </div>

        {draftRegion && cardMode && (
          <div
            className="absolute z-10 w-64 rounded-xl bg-white p-3 shadow-xl"
            style={{
              left: `${draftRegion.x}%`,
              top: `${Math.min(draftRegion.y + draftRegion.height, 90)}%`,
              marginTop: '0.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2">
              <BotAvatar botName={botName} />
              <p className="text-sm font-medium text-fundi-dark">
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
                onClick={handleSubmitComment}
                disabled={cardMode === 'sending' || !commentText.trim()}
                className="rounded-full bg-fundi-blue px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {cardMode === 'sending' ? 'Sending...' : 'Comment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
