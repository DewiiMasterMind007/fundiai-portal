// Standardized ticket status values used across the admin and client
// screens. The `status` column itself is free text in Supabase — this is
// the single source of truth for which values the app actually uses.
export const TICKET_STATUSES = {
  open: { label: 'Open', color: 'bg-gray-200 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-fundi-blue/10 text-fundi-blue' },
  completed: { label: 'Completed', color: 'bg-fundi-green/10 text-fundi-green' },
  awaiting_client_approval: {
    label: 'Awaiting Client Approval',
    color: 'bg-amber-100 text-amber-800',
  },
  approved: { label: 'Approved', color: 'bg-fundi-green/10 text-fundi-green' },
}
