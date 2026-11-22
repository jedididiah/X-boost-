export const VALIDATION_LIMITS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  idMaxLength: 128,
  displayNameMin: 1,
  displayNameMax: 80,
  targetLinkMin: 2,
  targetLinkMax: 300,
  serviceNameMin: 3,
  serviceNameMax: 140,
  serviceDescMin: 5,
  serviceDescMax: 600,
  ticketSubjectMin: 3,
  ticketSubjectMax: 140,
  ticketMessageMin: 5,
  ticketMessageMax: 1200,
  announcementTitleMin: 3,
  announcementTitleMax: 120,
  announcementBodyMin: 5,
  announcementBodyMax: 600,
} as const;

export function generateSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'id';
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${cleanPrefix}_${rand}`;
}

export function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function isValidTargetInput(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < VALIDATION_LIMITS.targetLinkMin || trimmed.length > VALIDATION_LIMITS.targetLinkMax) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
    return false;
  }
  return true;
}

export function calculateOrderCharge(ratePer1000: number, quantity: number): number {
  const raw = (ratePer1000 * quantity) / 1000;
  return Math.round(raw * 10000) / 10000;
}

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.abs(amount) > 0 && Math.abs(amount) < 0.01 ? 4 : 2,
    maximumFractionDigits: Math.abs(amount) > 0 && Math.abs(amount) < 1 ? 4 : 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return '—';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (ts instanceof Date) {
    return ts.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return '—';
}
