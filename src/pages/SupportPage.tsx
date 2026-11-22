import React, { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2 } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { PublicLayout } from '../components/PublicLayout';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import {
  VALIDATION_LIMITS,
  formatTimestamp,
  generateSafeId,
  sanitizeText,
} from '../lib/validation';
import type { TicketCategory } from '../types';

export function SupportPage() {
  const { firebaseUser, emailVerified } = useAuth();
  const { supportTickets, orders } = useData();
  const { navigate } = useRouter();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('order');
  const [orderId, setOrderId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitted(false);
    if (!firebaseUser) {
      navigate('/login');
      return;
    }
    if (!emailVerified) {
      setError('Verify your email address before opening a support ticket.');
      return;
    }
    if (subject.trim().length < VALIDATION_LIMITS.ticketSubjectMin) {
      setError('Subject must be at least 3 characters.');
      return;
    }
    if (message.trim().length < VALIDATION_LIMITS.ticketMessageMin) {
      setError('Please describe your issue in at least 5 characters.');
      return;
    }

    setBusy(true);
    const ticketId = generateSafeId('tkt');
    try {
      await setDoc(doc(db, 'supportTickets', ticketId), {
        id: ticketId,
        userId: firebaseUser.uid,
        userEmail: firebaseUser.email || '',
        subject: sanitizeText(subject, VALIDATION_LIMITS.ticketSubjectMax),
        category,
        orderId: sanitizeText(orderId, VALIDATION_LIMITS.idMaxLength),
        message: sanitizeText(message, VALIDATION_LIMITS.ticketMessageMax),
        status: 'open',
        adminReply: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSubject('');
      setOrderId('');
      setMessage('');
      setSubmitted(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `supportTickets/${ticketId}`);
    } finally {
      setBusy(false);
    }
  };

  const inner = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-5 bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">Open Support Ticket</h2>
          <p className="text-xs text-zinc-400">
            Include an order or payment reference for faster resolution.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}
        {submitted && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Support ticket submitted. Track replies on the right.</span>
          </div>
        )}

        {!firebaseUser ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Sign in to submit and track support tickets tied to your account orders.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login?redirect=/support')}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
            >
              Sign In for Support
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Subject</label>
              <input
                type="text"
                required
                maxLength={VALIDATION_LIMITS.ticketSubjectMax}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Order speed or refill inquiry"
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="order">Order</option>
                  <option value="payment">Payment</option>
                  <option value="refill">Refill</option>
                  <option value="account">Account</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Order ID (Optional)</label>
                <select
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="">None</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Message</label>
              <textarea
                rows={4}
                required
                maxLength={VALIDATION_LIMITS.ticketMessageMax}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Provide details so our team can inspect your request..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !emailVerified}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors"
            >
              {busy ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </form>
        )}
      </div>

      <div className="lg:col-span-7 bg-[#0B0C10] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08]">
          <h2 className="text-base font-semibold text-white">Your Tickets</h2>
        </div>
        {!firebaseUser || supportTickets.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No support tickets found for your account.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {supportTickets.map((t) => (
              <div key={t.id} className="p-5 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{t.subject}</p>
                  <StatusText status={t.status} />
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{t.message}</p>
                <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                  <span className="capitalize">{t.category}</span>
                  {t.orderId && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{t.orderId}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{formatTimestamp(t.createdAt)}</span>
                </div>
                {t.adminReply && (
                  <div className="mt-2 p-3 rounded-lg bg-[#050507] border border-[#2563EB]/30 text-xs text-zinc-200">
                    <span className="text-[#60A5FA] font-medium block mb-1">Admin Response</span>
                    {t.adminReply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (firebaseUser) {
    return <DashboardLayout title="Support">{inner}</DashboardLayout>;
  }
  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">{inner}</div>
    </PublicLayout>
  );
}
