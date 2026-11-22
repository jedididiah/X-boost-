import fs from 'node:fs';
import path from 'node:path';

export type WebhookRecordStatus = 'verified' | 'failed' | 'ignored';

export interface WebhookTransactionRecord {
  txRef: string;
  transactionId: string;
  flwRef?: string;
  event: string;
  amount: number;
  chargedAmount?: number;
  currency: string;
  customerEmail?: string;
  metaUserId?: string;
  status: WebhookRecordStatus;
  verified: boolean;
  credited: boolean;
  message: string;
  receivedAt: string;
  updatedAt: string;
}

const LEDGER_FILE = path.join('/tmp', 'xboost-flutterwave-webhooks.json');
const byTxRef = new Map<string, WebhookTransactionRecord>();
const verifiedTxIds = new Set<string>();
let hydrated = false;

function hydrateOnce() {
  if (hydrated) return;
  hydrated = true;
  try {
    if (!fs.existsSync(LEDGER_FILE)) return;
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
    const parsed = JSON.parse(raw) as WebhookTransactionRecord[];
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      if (item && typeof item.txRef === 'string') {
        byTxRef.set(item.txRef, item);
        if (item.verified && item.transactionId) {
          verifiedTxIds.add(item.transactionId);
        }
      }
    }
  } catch {
    // Non-fatal: fall back to clean in-memory map
  }
}

function persistLedger() {
  try {
    const entries = Array.from(byTxRef.values()).slice(-500);
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(entries, null, 2), { mode: 0o600 });
  } catch {
    // Non-fatal in read-only or restricted temp environments
  }
}

export function findVerifiedDuplicate(
  txRef: string,
  transactionId?: string
): WebhookTransactionRecord | null {
  hydrateOnce();
  const byRef = byTxRef.get(txRef);
  if (byRef && byRef.verified) {
    return byRef;
  }
  if (transactionId && verifiedTxIds.has(transactionId)) {
    for (const rec of byTxRef.values()) {
      if (rec.transactionId === transactionId && rec.verified) {
        return rec;
      }
    }
  }
  return null;
}

export function recordWebhookTransaction(entry: WebhookTransactionRecord): WebhookTransactionRecord {
  hydrateOnce();
  const existing = byTxRef.get(entry.txRef);
  if (existing?.verified) {
    return existing;
  }
  byTxRef.set(entry.txRef, entry);
  if (entry.verified && entry.transactionId) {
    verifiedTxIds.add(entry.transactionId);
  }
  persistLedger();
  return entry;
}

export function getWebhookTransactionByRef(txRef: string): WebhookTransactionRecord | undefined {
  hydrateOnce();
  return byTxRef.get(txRef);
}

export function markWebhookCredited(txRef: string): WebhookTransactionRecord | null {
  hydrateOnce();
  const existing = byTxRef.get(txRef);
  if (!existing) return null;
  const updated: WebhookTransactionRecord = {
    ...existing,
    credited: true,
    updatedAt: new Date().toISOString(),
  };
  byTxRef.set(txRef, updated);
  persistLedger();
  return updated;
}

export function listWebhookTransactions(): WebhookTransactionRecord[] {
  hydrateOnce();
  return Array.from(byTxRef.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
