import React from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';

type StatusVariant =
  | 'active'
  | 'completed'
  | 'verified'
  | 'resolved'
  | 'pending'
  | 'initialized'
  | 'in_review'
  | 'processing'
  | 'in_progress'
  | 'partial'
  | 'paused'
  | 'maintenance'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'suspended'
  | 'open'
  | 'closed';

const LABEL_MAP: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  verified: 'Verified',
  resolved: 'Resolved',
  pending: 'Pending',
  initialized: 'Initialized',
  in_review: 'In Review',
  processing: 'Processing',
  in_progress: 'In Progress',
  partial: 'Partial',
  paused: 'Paused',
  maintenance: 'Maintenance',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  failed: 'Failed',
  suspended: 'Suspended',
  open: 'Open',
  closed: 'Closed',
};

export function StatusText({ status }: { status: StatusVariant | string }) {
  const normalized = status.toLowerCase();
  const label = LABEL_MAP[normalized] || status;

  if (['active', 'completed', 'verified', 'resolved'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  if (['processing', 'in_progress', 'in_review', 'open'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#60A5FA] whitespace-nowrap">
        <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  if (['pending', 'initialized', 'partial', 'paused', 'maintenance'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  if (['cancelled', 'failed', 'suspended'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 whitespace-nowrap">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
