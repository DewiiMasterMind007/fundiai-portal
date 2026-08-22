import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'

const PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  blog: 'Blog',
}

export default function ScheduleReviewLink() {
  const { reviewId } = useParams()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchReview() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/schedule-review?id=${encodeURIComponent(reviewId)}`,
        )
        const data = await response.json()
        if (cancelled) return

        if (!response.ok) {
          setError(data?.error || `Request failed with status ${response.status}`)
          setReview(null)
          return
        }
        setReview(data)
      } catch (err) {
        if (cancelled) return
        setError(err.message)
        setReview(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchReview()

    return () => {
      cancelled = true
    }
  }, [reviewId])

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundi-bg p-6 font-sans">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-lg">
        {loading ? (
          <p className="text-center text-sm text-gray-400">
            Loading review...
          </p>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <ScheduleReviewContent review={review} />
        )}
      </div>
    </div>
  )
}

function ScheduleReviewContent({ review }) {
  const isImageComment = review.kind === 'image_comment'
  const region = review.region_json
  const platformLabel = PLATFORM_LABELS[review.tab] ?? review.tab

  let formattedDate
  try {
    formattedDate = format(parseISO(review.post_date), 'EEEE, d MMMM yyyy')
  } catch {
    formattedDate = review.post_date
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fundi-dark">
          {formattedDate} — {platformLabel}
        </h1>
        <p className="text-sm text-gray-500">{review.client_email}</p>
      </div>

      {review.caption_snapshot && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fundi-dark/50">
            Caption
          </p>
          <p className="whitespace-pre-wrap rounded-lg bg-fundi-bg p-3 text-sm text-fundi-dark">
            {review.caption_snapshot}
          </p>
        </div>
      )}

      {review.image_url && (
        <div className="relative inline-block max-w-full">
          <img
            src={review.image_url}
            alt=""
            className="max-h-[60vh] max-w-full rounded-lg object-contain"
          />
          {isImageComment && region && (
            <div
              className="pointer-events-none absolute border-2 border-fundi-blue bg-fundi-blue/20"
              style={{
                left: `${region.x}%`,
                top: `${region.y}%`,
                width: `${region.width}%`,
                height: `${region.height}%`,
              }}
            />
          )}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fundi-dark/50">
          {isImageComment ? 'Comment on image' : 'Comment on caption'}
        </p>
        <p className="whitespace-pre-wrap rounded-lg bg-fundi-blue/10 p-3 text-sm text-fundi-dark">
          {review.comment}
        </p>
      </div>
    </div>
  )
}
