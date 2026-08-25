import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BOTS, BOT_IDS } from '../../lib/bots'

const BOT_CHECKBOX_LABELS = {
  poppie: 'Poppie (Social Media)',
  chad: 'Chad (Website/eCommerce)',
}

const STEP_DEFS = [
  { id: 'provision', label: 'Creating Drive folders, fundi.file & schedule sheet...' },
  { id: 'client', label: 'Saving client record...' },
  { id: 'bots', label: 'Setting up bot access...' },
  { id: 'invite', label: 'Sending invite email...' },
]

const EMPTY_FORM = {
  businessName: '',
  email: '',
  fullName: '',
  plan: '',
  selectedBots: {},
  instructions: {},
}

function ResourceLink({ href, label }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-fundi-blue shadow-sm transition hover:opacity-80"
    >
      <ExternalLink size={14} />
      {label}
    </a>
  )
}

function ResourceLinks({ result }) {
  const hasAny = result?.driveFolderUrl || result?.fundiFileUrl || result?.scheduleSheetUrl
  if (!hasAny) return null

  return (
    <div className="flex flex-col gap-2">
      <ResourceLink href={result.driveFolderUrl} label="Open Drive Folder" />
      <ResourceLink href={result.fundiFileUrl} label="Open Fundi File" />
      <ResourceLink href={result.scheduleSheetUrl} label="Open Schedule Sheet" />
    </div>
  )
}

function StepList({ stepStatus, stepErrors }) {
  return (
    <div className="mt-6 space-y-3 rounded-2xl bg-fundi-bg p-4">
      {STEP_DEFS.map((step) => {
        const status = stepStatus[step.id]
        if (!status) return null

        return (
          <div key={step.id} className="flex items-start gap-2 text-sm">
            {status === 'success' && (
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-fundi-green" />
            )}
            {status === 'active' && (
              <Loader2 size={16} className="mt-0.5 flex-shrink-0 animate-spin text-fundi-blue" />
            )}
            {status === 'queued' && (
              <div className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-gray-300" />
            )}
            {status === 'error' && (
              <XCircle size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
            )}
            <div className="min-w-0">
              <p
                className={
                  status === 'error'
                    ? 'text-red-600'
                    : status === 'queued'
                      ? 'text-fundi-dark/40'
                      : 'text-fundi-dark'
                }
              >
                {step.label}
              </p>
              {status === 'error' && stepErrors[step.id] && (
                <p className="mt-1 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                  {stepErrors[step.id]}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminNewClient() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [stepStatus, setStepStatus] = useState({})
  const [stepErrors, setStepErrors] = useState({})
  const [result, setResult] = useState(null)

  const checkedBots = BOT_IDS.filter((id) => form.selectedBots[id])
  const isComplete = result && !result.partial

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleBot(botId, checked) {
    setForm((prev) => ({
      ...prev,
      selectedBots: { ...prev.selectedBots, [botId]: checked },
    }))
  }

  function updateInstructions(botId, value) {
    setForm((prev) => ({
      ...prev,
      instructions: { ...prev.instructions, [botId]: value },
    }))
  }

  function markStep(id, status, error) {
    setStepStatus((prev) => ({ ...prev, [id]: status }))
    if (error !== undefined) {
      setStepErrors((prev) => ({ ...prev, [id]: error }))
    }
  }

  function handleReset() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setSubmitting(false)
    setStepStatus({})
    setStepErrors({})
    setResult(null)
  }

  async function authedFetch(url, body, token) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error || `Request failed with status ${response.status}`)
    }
    return data
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)

    if (checkedBots.length === 0) {
      setFormError('Select at least one bot.')
      return
    }

    setSubmitting(true)
    setStepStatus({
      provision: 'active',
      client: 'queued',
      bots: 'queued',
      invite: 'queued',
    })
    setStepErrors({})
    setResult(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    // Step 1 — provision Drive resources via the server (needs the
    // service-role-backed Apps Script call, not something the client can
    // do directly).
    let provisionData
    try {
      provisionData = await authedFetch(
        '/api/admin-provision',
        { business_name: form.businessName },
        token,
      )
      markStep('provision', 'success')
    } catch (err) {
      markStep('provision', 'error', err.message)
      setSubmitting(false)
      return
    }

    const { driveFolderId, fundiFileUrl, scheduleSheetId, driveFolderUrl, scheduleSheetUrl } =
      provisionData

    // Step 2 — save the client row directly with the admin's own session,
    // relying on the RLS insert policy.
    markStep('client', 'active')
    try {
      const { error } = await supabase.from('clients').insert({
        email: form.email,
        full_name: form.fullName,
        business_name: form.businessName,
        bot_assigned: checkedBots[0],
        plan: form.plan,
        drive_folder_id: driveFolderId,
        fundi_file_url: fundiFileUrl,
        schedule_sheet_id: scheduleSheetId,
      })
      if (error) throw new Error(error.message)
      markStep('client', 'success')
    } catch (err) {
      markStep('client', 'error', err.message)
      setSubmitting(false)
      setResult({ driveFolderUrl, fundiFileUrl, scheduleSheetUrl, partial: true })
      return
    }

    // Step 3 — one client_bots row per checked bot.
    markStep('bots', 'active')
    try {
      for (const botId of checkedBots) {
        const { error } = await supabase.from('client_bots').insert({
          client_email: form.email,
          bot: botId,
          instructions: form.instructions[botId]?.trim() || null,
        })
        if (error) throw new Error(error.message)
      }
      markStep('bots', 'success')
    } catch (err) {
      markStep('bots', 'error', err.message)
      setSubmitting(false)
      setResult({ driveFolderUrl, fundiFileUrl, scheduleSheetUrl, partial: true })
      return
    }

    // Step 4 — invite email.
    markStep('invite', 'active')
    try {
      await authedFetch('/api/admin-invite', { email: form.email }, token)
      markStep('invite', 'success')
    } catch (err) {
      markStep('invite', 'error', err.message)
      setSubmitting(false)
      setResult({ driveFolderUrl, fundiFileUrl, scheduleSheetUrl, partial: true })
      return
    }

    setSubmitting(false)
    setResult({ driveFolderUrl, fundiFileUrl, scheduleSheetUrl, partial: false })
  }

  return (
    <div className="max-w-2xl font-sans">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin"
          aria-label="Back to dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-full text-fundi-dark transition hover:bg-fundi-bg"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-2xl font-semibold text-fundi-dark">New Client</h1>
      </div>

      {isComplete ? (
        <div className="space-y-4 rounded-2xl bg-fundi-green/10 p-6">
          <div className="flex items-center gap-2 text-fundi-green">
            <CheckCircle2 size={20} />
            <p className="font-semibold">Client set up successfully</p>
          </div>
          <ResourceLinks result={result} />
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full bg-fundi-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Set Up Another Client
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
                Business Name
              </label>
              <input
                type="text"
                required
                disabled={submitting}
                value={form.businessName}
                onChange={(e) => updateField('businessName', e.target.value)}
                className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
                Client Email
              </label>
              <input
                type="email"
                required
                disabled={submitting}
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
                Full Name
              </label>
              <input
                type="text"
                required
                disabled={submitting}
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-fundi-dark/60">
                Plan
              </label>
              <input
                type="text"
                required
                disabled={submitting}
                value={form.plan}
                onChange={(e) => updateField('plan', e.target.value)}
                className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-fundi-dark/60">
                Bots
              </label>
              <div className="space-y-3">
                {BOT_IDS.map((botId) => (
                  <div key={botId} className="rounded-xl border border-gray-200 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-fundi-dark">
                      <input
                        type="checkbox"
                        disabled={submitting}
                        checked={!!form.selectedBots[botId]}
                        onChange={(e) => toggleBot(botId, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-fundi-blue focus:ring-fundi-blue"
                      />
                      {BOT_CHECKBOX_LABELS[botId]}
                    </label>
                    {form.selectedBots[botId] && (
                      <textarea
                        rows={2}
                        disabled={submitting}
                        value={form.instructions[botId] ?? ''}
                        onChange={(e) => updateInstructions(botId, e.target.value)}
                        placeholder={`Custom instructions for ${BOTS[botId].name} (optional)`}
                        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-fundi-dark outline-none focus:border-fundi-blue disabled:opacity-50"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-fundi-blue px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Setting up...' : 'Create Client'}
            </button>
          </form>

          {Object.keys(stepStatus).length > 0 && (
            <StepList stepStatus={stepStatus} stepErrors={stepErrors} />
          )}

          {result?.partial && (
            <div className="mt-4 space-y-2 rounded-2xl bg-fundi-bg p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-fundi-dark/50">
                Google resources already created
              </p>
              <ResourceLinks result={result} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
