import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const PLATFORMS = ['facebook', 'instagram', 'blog']
const PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  blog: 'Blog',
}

const EMPTY_FORM = { date: '', time: '', title: '', caption: '', image_url: '' }

// post.time may come back as "16:00" or "4:00 PM" — parse both so posts
// with a 12-hour time still sort correctly against 24-hour ones.
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

function postSortKey(post) {
  const { hours, minutes } = parseTimeParts(post.time)
  return `${post.date || ''} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function StatusBadge({ status }) {
  const isApproved = status === 'approved'
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isApproved
          ? 'bg-fundi-green/10 text-fundi-green'
          : 'bg-gray-200 text-gray-700'
      }`}
    >
      {status || 'scheduled'}
    </span>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-fundi-bg" />
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

function PostRow({ post, onEdit, onDelete, deleting, deleteError }) {
  return (
    <div className="rounded-2xl bg-fundi-bg p-4">
      <div className="flex items-start gap-3">
        {post.image_url ? (
          <img
            src={post.image_url}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-gray-400">
            <ImageIcon size={20} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-fundi-dark">
              {post.date || 'No date'} {post.time && `· ${post.time}`}
            </p>
            <StatusBadge status={post.status} />
          </div>
          {post.title && (
            <p className="mt-0.5 text-sm font-medium text-fundi-dark">
              {post.title}
            </p>
          )}
          <p className="mt-0.5 truncate text-xs text-fundi-dark/60">
            {post.caption || 'No caption'}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(post)}
            aria-label="Edit post"
            className="flex h-8 w-8 items-center justify-center rounded-full text-fundi-dark transition hover:bg-white"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(post)}
            disabled={deleting}
            aria-label="Delete post"
            className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 transition hover:bg-white disabled:opacity-50"
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {deleteError}
        </div>
      )}
    </div>
  )
}

function PostForm({ client, platform, editingPost, onClose, onSaved }) {
  const [fields, setFields] = useState(() =>
    editingPost
      ? {
          date: editingPost.date || '',
          time: editingPost.time || '',
          title: editingPost.title || '',
          caption: editingPost.caption || '',
          image_url: editingPost.image_url || '',
        }
      : EMPTY_FORM,
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  function updateField(field, value) {
    setFields((prev) => ({ ...prev, [field]: value }))
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setUploading(true)

    try {
      const clientSlug = (client.business_name || 'client')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
      const yyyyMM = format(new Date(), 'yyyy-MM')
      const path = `${clientSlug}/${yyyyMM}/${Date.now()}-${file.name}`

      const { error: uploadErr } = await supabase.storage
        .from('post-images')
        .upload(path, file)
      if (uploadErr) throw new Error(uploadErr.message)

      const { data: publicUrlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(path)

      updateField('image_url', publicUrlData.publicUrl)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const body = editingPost
        ? {
            type: 'update_post',
            sheet_id: client.schedule_sheet_id,
            tab: platform,
            row_number: editingPost.rowNumber,
            fields,
          }
        : {
            type: 'create_post',
            sheet_id: client.schedule_sheet_id,
            tab: platform,
            fields: { ...fields, status: 'scheduled' },
          }

      const response = await fetch('/api/admin-schedule-write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || data?.error) {
        throw new Error(data?.error || `Request failed with status ${response.status}`)
      }

      onSaved()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fundi-dark">
            {editingPost ? 'Edit Post' : 'New Post'}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
                Date
              </label>
              <input
                type="date"
                required
                disabled={saving}
                value={fields.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm text-fundi-dark focus:border-fundi-blue focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
                Time
              </label>
              <input
                type="text"
                required
                placeholder="3:30 PM"
                disabled={saving}
                value={fields.time}
                onChange={(e) => updateField('time', e.target.value)}
                className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm text-fundi-dark focus:border-fundi-blue focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
              Title
            </label>
            <input
              type="text"
              disabled={saving}
              value={fields.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm text-fundi-dark focus:border-fundi-blue focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
              Caption
            </label>
            <textarea
              rows={4}
              disabled={saving}
              value={fields.caption}
              onChange={(e) => updateField('caption', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-fundi-dark outline-none focus:border-fundi-blue disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
              Image
            </label>
            <div className="flex items-center gap-3">
              {fields.image_url ? (
                <img
                  src={fields.image_url}
                  alt=""
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-fundi-bg text-gray-400">
                  <ImageIcon size={18} />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={uploading || saving}
                onChange={handleImageChange}
                className="flex-1 text-xs text-fundi-dark file:mr-3 file:rounded-full file:border-0 file:bg-fundi-bg file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-fundi-dark hover:file:bg-fundi-bg/70 disabled:opacity-50"
              />
              {uploading && (
                <Loader2 size={16} className="flex-shrink-0 animate-spin text-fundi-blue" />
              )}
            </div>
            {uploadError && (
              <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                {uploadError}
              </div>
            )}
          </div>

          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full px-4 py-2 text-sm font-medium text-fundi-dark transition hover:bg-fundi-bg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-full bg-fundi-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminSchedule() {
  const [clients, setClients] = useState([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [clientsError, setClientsError] = useState(null)
  const [selectedClientEmail, setSelectedClientEmail] = useState('')

  const [platform, setPlatform] = useState('facebook')

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [deletingRow, setDeletingRow] = useState(null)
  const [deleteErrors, setDeleteErrors] = useState({})

  const [formOpen, setFormOpen] = useState(false)
  const [editingPost, setEditingPost] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchClients() {
      setLoadingClients(true)
      setClientsError(null)

      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('email, business_name, schedule_sheet_id')
        .not('schedule_sheet_id', 'is', null)
        .order('business_name', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setClientsError(fetchError.message)
        setClients([])
      } else {
        setClients(data ?? [])
      }
      setLoadingClients(false)
    }

    fetchClients()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedClient = useMemo(
    () => clients.find((c) => c.email === selectedClientEmail) ?? null,
    [clients, selectedClientEmail],
  )

  async function fetchPosts() {
    if (!selectedClient) {
      setPosts([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/schedule?action=schedule&sheetId=${encodeURIComponent(selectedClient.schedule_sheet_id)}&tab=${encodeURIComponent(platform)}`,
      )
      const data = await response.json()

      if (!response.ok || data?.error) {
        throw new Error(data?.error || `Request failed with status ${response.status}`)
      }

      const rows = Array.isArray(data) ? data : (data.posts ?? [])
      setPosts(rows)
    } catch (err) {
      setError(err.message)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient?.schedule_sheet_id, platform])

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => (postSortKey(a) < postSortKey(b) ? -1 : 1)),
    [posts],
  )

  function openCreateForm() {
    setEditingPost(null)
    setFormOpen(true)
  }

  function openEditForm(post) {
    setEditingPost(post)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingPost(null)
  }

  function handleSaved() {
    closeForm()
    fetchPosts()
  }

  async function handleDelete(post) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return

    setDeletingRow(post.rowNumber)
    setDeleteErrors((prev) => ({ ...prev, [post.rowNumber]: null }))

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/admin-schedule-write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'delete_post',
          sheet_id: selectedClient.schedule_sheet_id,
          tab: platform,
          row_number: post.rowNumber,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || data?.error) {
        throw new Error(data?.error || `Request failed with status ${response.status}`)
      }

      setPosts((prev) => prev.filter((p) => p.rowNumber !== post.rowNumber))
    } catch (err) {
      setDeleteErrors((prev) => ({ ...prev, [post.rowNumber]: err.message }))
    } finally {
      setDeletingRow(null)
    }
  }

  return (
    <div className="font-sans">
      <h1 className="text-2xl font-semibold text-fundi-dark">Schedule</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage a client's scheduled posts.
      </p>

      <div className="mt-6">
        <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
          Client
        </label>
        {clientsError ? (
          <ErrorBox message={clientsError} />
        ) : (
          <select
            value={selectedClientEmail}
            disabled={loadingClients}
            onChange={(e) => setSelectedClientEmail(e.target.value)}
            className="w-full max-w-sm rounded-full border border-gray-300 px-4 py-2 text-sm text-fundi-dark outline-none focus:border-fundi-blue disabled:opacity-50"
          >
            <option value="">
              {loadingClients ? 'Loading clients...' : 'Select a client'}
            </option>
            {clients.map((c) => (
              <option key={c.email} value={c.email}>
                {c.business_name || c.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedClient && (
        <>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    platform === p
                      ? 'bg-fundi-blue text-white'
                      : 'bg-fundi-bg text-fundi-dark hover:bg-fundi-bg/70'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={openCreateForm}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-fundi-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              <Plus size={16} />
              New Post
            </button>
          </div>

          <div className="mt-4">
            {error ? (
              <ErrorBox message={error} />
            ) : loading ? (
              <SkeletonRows />
            ) : sortedPosts.length === 0 ? (
              <p className="mt-16 text-center text-sm text-gray-400">
                No posts yet
              </p>
            ) : (
              <div className="space-y-2">
                {sortedPosts.map((post, i) => (
                  <PostRow
                    key={post.rowNumber ?? i}
                    post={post}
                    onEdit={openEditForm}
                    onDelete={handleDelete}
                    deleting={deletingRow === post.rowNumber}
                    deleteError={deleteErrors[post.rowNumber]}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {formOpen && selectedClient && (
        <PostForm
          client={selectedClient}
          platform={platform}
          editingPost={editingPost}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
