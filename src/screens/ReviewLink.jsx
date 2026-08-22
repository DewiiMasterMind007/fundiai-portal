import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'

export default function ReviewLink() {
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
          `/api/review?id=${encodeURIComponent(reviewId)}`,
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
          <ReviewContent review={review} />
        )}
      </div>
    </div>
  )
}

function ReviewContent({ review }) {
  const region = review.region_json
  const isApprove = review.kind === 'approve'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fundi-dark">
          {review.file_name}
        </h1>
        <p className="text-sm text-gray-500">{review.client_email}</p>
        {review.created_at && (
          <p className="text-xs text-gray-400">
            {format(new Date(review.created_at), "PPP 'at' p")}
          </p>
        )}
      </div>

      {isApprove ? (
        <p className="rounded-xl bg-fundi-green/10 p-3 text-sm font-medium text-fundi-green">
          ✅ Approved — no changes requested
        </p>
      ) : (
        review.comment && (
          <p className="rounded-xl bg-fundi-bg p-3 text-sm text-fundi-dark">
            {review.comment}
          </p>
        )
      )}

      <div className="relative inline-block max-w-full">
        <img
          src={`/api/image?fileId=${review.file_id}`}
          alt={review.file_name}
          className="max-h-[70vh] max-w-full rounded-lg object-contain"
        />
        {!isApprove && region && (
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
    </div>
  )
}
