import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, CreditCard, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { authorizedFetch } from '../lib/api';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { formatCurrency, formatTimestamp, generateSafeId } from '../lib/validation';
import type { PaymentRecord } from '../types';

interface ServerPaymentStatus {
  flutterwaveConfigured: boolean;
  flutterwaveWebhookConfigured: boolean;
}

export function WalletPage() {
  const { firebaseUser, wallet, emailVerified, isAdmin } = useAuth();
  const { adminSettings, paymentRecords } = useData();
  const { search } = useRouter();

  const [amount, setAmount] = useState<number>(25);
  const [currency, setCurrency] = useState<'USD' | 'NGN' | 'EUR' | 'GBP'>('USD');
  const [verifyRef, setVerifyRef] = useState('');
  const [verifyTxId, setVerifyTxId] = useState('');
  const [serverStatus, setServerStatus] = useState<ServerPaymentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const processedCallbackRef = useRef<string>('');

  useEffect(() => {
    if (!firebaseUser || !emailVerified) return;
    authorizedFetch<{ ok?: boolean; status?: ServerPaymentStatus }>('/api/payments/status')
      .then((res) => {
        if (res.ok && res.data.status) {
          setServerStatus(res.data.status);
        }
      })
      .catch(() => {
        // Handled cleanly by UI state
      });
  }, [firebaseUser, emailVerified]);

  const flutterwaveEnabled = adminSettings ? adminSettings.flutterwaveEnabled : true;
  const minDeposit = adminSettings?.minDepositUsd ?? 5;

  const verifyWithServer = useCallback(
    async (reference: string, transactionId: string, matchedRecord?: PaymentRecord) => {
      if (!firebaseUser || !emailVerified) return;
      setBusy(true);
      try {
        const res = await authorizedFetch<{
          verified?: boolean;
          message?: string;
          amount?: number;
          currency?: string;
          transactionId?: string;
        }>('/api/payments/verify', {
          method: 'POST',
          body: JSON.stringify({
            gateway: 'flutterwave',
            reference: reference.trim(),
            transactionId: transactionId.trim() || undefined,
            expectedAmount: matchedRecord?.amount,
            expectedCurrency: matchedRecord?.currency,
          }),
        });

        if (res.data.verified) {
          const verifiedAmt = res.data.amount ?? matchedRecord?.amount ?? 0;
          const verifiedCur = res.data.currency ?? matchedRecord?.currency ?? 'USD';

          if (
            isAdmin &&
            matchedRecord &&
            matchedRecord.status !== 'verified' &&
            wallet &&
            verifiedCur.toUpperCase() === 'USD'
          ) {
            const creditAmount = matchedRecord.amount;
            const nextBalance = Math.round((wallet.balance + creditAmount) * 10000) / 10000;
            const txId = generateSafeId('tx');
            const notifId = generateSafeId('ntf');
            const batch = writeBatch(db);
            batch.update(doc(db, 'paymentRecords', matchedRecord.id), {
              status: 'verified',
              verifiedByServer: true,
              gatewayMessage: `Verified via Flutterwave (ID ${transactionId.trim()})`,
              updatedAt: serverTimestamp(),
            });
            batch.update(doc(db, 'wallets', firebaseUser.uid), {
              balance: nextBalance,
              totalDeposited: Math.round((wallet.totalDeposited + creditAmount) * 10000) / 10000,
              updatedAt: serverTimestamp(),
            });
            batch.set(doc(db, 'transactions', txId), {
              id: txId,
              userId: firebaseUser.uid,
              type: 'deposit',
              amount: creditAmount,
              balanceAfter: nextBalance,
              reference: matchedRecord.reference,
              orderId: '',
              gateway: 'flutterwave',
              status: 'completed',
              description: `Flutterwave deposit (${matchedRecord.reference})`,
              createdAt: serverTimestamp(),
            });
            batch.set(doc(db, 'notifications', notifId), {
              id: notifId,
              userId: firebaseUser.uid,
              title: 'Wallet Funded',
              message: `${formatCurrency(creditAmount)} credited via Flutterwave (${matchedRecord.reference}).`,
              category: 'wallet',
              read: false,
              createdAt: serverTimestamp(),
            });
            await batch.commit();
            setFeedback({
              ok: true,
              text: `Flutterwave payment ${reference} verified and ${formatCurrency(creditAmount)} credited to your wallet.`,
            });
          } else {
            setFeedback({
              ok: true,
              text: `Server verified Flutterwave payment ${reference} (${verifiedAmt} ${verifiedCur}). Wallet credit posts via verified ledger settlement.`,
            });
          }
        } else {
          setFeedback({
            ok: false,
            text: res.data.message || 'Flutterwave payment reference could not be verified.',
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'paymentRecords');
      } finally {
        setBusy(false);
      }
    },
    [emailVerified, firebaseUser, isAdmin, wallet]
  );

  // Handle Flutterwave redirect callback query parameters (/wallet?status=...&tx_ref=...&transaction_id=...)
  useEffect(() => {
    if (!firebaseUser || !emailVerified || !search) return;
    const params = new URLSearchParams(search);
    const txRef = (params.get('tx_ref') || '').trim();
    const txId = (params.get('transaction_id') || '').trim();
    const cbStatus = (params.get('status') || '').trim().toLowerCase();

    if (!txRef) return;
    const callbackKey = `${txRef}:${txId}:${cbStatus}`;
    if (processedCallbackRef.current === callbackKey) return;

    const matchedRecord = paymentRecords.find((r) => r.reference === txRef);
    if (!matchedRecord && paymentRecords.length === 0) {
      // Wait briefly if Firestore snapshot hasn't arrived yet? We still prefill immediately.
    }

    setVerifyRef(txRef);
    if (txId) setVerifyTxId(txId);

    if (cbStatus === 'cancelled' || cbStatus === 'failed') {
      processedCallbackRef.current = callbackKey;
      if (matchedRecord && ['initialized', 'pending'].includes(matchedRecord.status)) {
        updateDoc(doc(db, 'paymentRecords', matchedRecord.id), {
          status: 'failed',
          gatewayMessage: 'Flutterwave checkout was cancelled or declined.',
          updatedAt: serverTimestamp(),
        }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `paymentRecords/${matchedRecord.id}`));
      }
      setFeedback({
        ok: false,
        text: `Flutterwave checkout for ${txRef} was ${cbStatus}. No funds were charged.`,
      });
      return;
    }

    if ((cbStatus === 'successful' || cbStatus === 'completed') && txId) {
      processedCallbackRef.current = callbackKey;
      void verifyWithServer(txRef, txId, matchedRecord);
    }
  }, [emailVerified, firebaseUser, paymentRecords, search, verifyWithServer]);

  const handleInitializeDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!firebaseUser || !emailVerified) {
      setFeedback({ ok: false, text: 'Verify your email address before initiating wallet deposits.' });
      return;
    }
    if (!flutterwaveEnabled) {
      setFeedback({ ok: false, text: 'Flutterwave deposits are currently paused by the administrator.' });
      return;
    }
    if (!Number.isFinite(amount) || amount < minDeposit) {
      setFeedback({ ok: false, text: `Minimum deposit is ${formatCurrency(minDeposit)}.` });
      return;
    }

    setBusy(true);
    const paymentId = generateSafeId('pay');
    const reference = generateSafeId('xb_flw');

    try {
      await setDoc(doc(db, 'paymentRecords', paymentId), {
        id: paymentId,
        userId: firebaseUser.uid,
        userEmail: firebaseUser.email || '',
        gateway: 'flutterwave',
        reference,
        amount,
        currency,
        status: 'initialized',
        gatewayMessage: 'Flutterwave checkout session requested on server.',
        verifiedByServer: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const res = await authorizedFetch<{
        ok?: boolean;
        message?: string;
        authorizationUrl?: string;
      }>('/api/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ gateway: 'flutterwave', amount, currency, reference }),
      });

      if (res.ok && res.data.authorizationUrl) {
        setFeedback({
          ok: true,
          text: `Flutterwave checkout initialized for reference ${reference}. Opening payment provider...`,
        });
        window.location.assign(res.data.authorizationUrl);
        return;
      }

      const failMessage = (res.data.message || 'Flutterwave is not configured on the server.').slice(0, 300);
      await updateDoc(doc(db, 'paymentRecords', paymentId), {
        status: 'failed',
        gatewayMessage: failMessage,
        updatedAt: serverTimestamp(),
      });
      setFeedback({ ok: false, text: failMessage });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `paymentRecords/${paymentId}`);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyReference = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!verifyRef.trim()) return;
    const matchedRecord = paymentRecords.find((r) => r.reference === verifyRef.trim());
    await verifyWithServer(verifyRef.trim(), verifyTxId.trim(), matchedRecord);
  };

  return (
    <DashboardLayout title="Wallet & Funding">
      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Available Balance</p>
          <p className="text-3xl font-display font-bold text-white tabular-nums mt-2">
            {formatCurrency(wallet?.balance ?? 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Protected server-side ledger</p>
        </div>

        <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Total Deposited</p>
          <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums mt-2">
            {formatCurrency(wallet?.totalDeposited ?? 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Verified deposits only</p>
        </div>

        <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Total Spent on Orders</p>
          <p className="text-2xl font-display font-bold text-zinc-100 tabular-nums mt-2">
            {formatCurrency(wallet?.totalSpent ?? 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Atomic order deductions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Add Funds Form */}
        <div className="lg:col-span-7 bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Add Funds</h2>
              <p className="text-xs text-zinc-400">
                Payments are processed through Flutterwave and verified strictly on the server.
              </p>
            </div>
            <CreditCard className="w-5 h-5 text-[#3B82F6]" />
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                feedback.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}
            >
              {feedback.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleInitializeDeposit} className="space-y-4">
            <div className="p-4 rounded-lg border border-[#2563EB] bg-[#2563EB]/10 text-left">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-white">Flutterwave Checkout</span>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Cards, Bank Transfer, Mobile Money &amp; Multi-Currency Global Payments
                  </p>
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    !flutterwaveEnabled
                      ? 'text-amber-400'
                      : serverStatus?.flutterwaveConfigured
                        ? 'text-emerald-400'
                        : 'text-zinc-400'
                  }`}
                >
                  {!flutterwaveEnabled
                    ? 'Paused by Admin'
                    : serverStatus === null
                      ? 'Checking'
                      : serverStatus.flutterwaveConfigured
                        ? 'Ready'
                        : 'Key Required'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Amount (Min {formatCurrency(minDeposit)})
                </label>
                <input
                  type="number"
                  min={minDeposit}
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'NGN' | 'EUR' | 'GBP')}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="USD">USD</option>
                  <option value="NGN">NGN</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !emailVerified || !flutterwaveEnabled}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors"
            >
              {busy ? 'Initializing Checkout...' : 'Continue to Flutterwave'}
            </button>
          </form>
        </div>

        {/* Server Verification Box */}
        <div className="lg:col-span-5 bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-base font-semibold text-white">Verify Flutterwave Payment</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Returned from Flutterwave checkout? Submit your transaction reference and numeric transaction ID for server-side verification.
          </p>

          <form onSubmit={handleVerifyReference} className="space-y-3">
            <input
              type="text"
              required
              value={verifyRef}
              onChange={(e) => setVerifyRef(e.target.value)}
              placeholder="Payment reference (e.g. xb_flw_...)"
              className="w-full px-3.5 py-2 text-sm font-mono bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
            />
            <input
              type="text"
              value={verifyTxId}
              onChange={(e) => setVerifyTxId(e.target.value)}
              placeholder="Flutterwave numeric transaction_id (optional if webhook received)"
              className="w-full px-3.5 py-2 text-sm font-mono bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
            />
            <button
              type="submit"
              disabled={busy || !emailVerified}
              className="w-full py-2 px-4 text-xs font-medium text-white border border-white/15 hover:bg-white/[0.05] rounded-lg transition-colors disabled:opacity-50"
            >
              Verify with Server
            </button>
          </form>
        </div>
      </div>

      {/* Payment Attempts History */}
      <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08]">
          <h2 className="text-base font-semibold text-white">Payment Records</h2>
        </div>
        {paymentRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">No payment attempts recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs text-zinc-400">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Gateway</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {paymentRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-xs text-white">{rec.reference}</td>
                    <td className="py-3 px-4 text-xs capitalize text-zinc-300">{rec.gateway}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-white">
                      {rec.amount.toFixed(2)} {rec.currency}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={rec.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-400 max-w-xs truncate">
                      {rec.gatewayMessage}
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-500 whitespace-nowrap">
                      {formatTimestamp(rec.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
