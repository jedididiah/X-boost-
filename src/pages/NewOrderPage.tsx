import React, { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { CheckCircle2, Info } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ALL_PLATFORMS, PLATFORM_LABELS, PlatformIcon } from '../components/PlatformIcon';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { authorizedFetch } from '../lib/api';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import {
  VALIDATION_LIMITS,
  calculateOrderCharge,
  formatCurrency,
  formatNumber,
  generateSafeId,
  isValidTargetInput,
  sanitizeText,
} from '../lib/validation';
import type { SocialPlatform } from '../types';

export function NewOrderPage() {
  const { firebaseUser, wallet, emailVerified } = useAuth();
  const { services } = useData();
  const { navigate, search } = useRouter();

  const preselectedServiceId = useMemo(
    () => new URLSearchParams(search).get('service') || '',
    [search]
  );

  const preselectedService = useMemo(
    () => services.find((s) => s.id === preselectedServiceId) || null,
    [services, preselectedServiceId]
  );

  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>(
    preselectedService?.platform || 'X'
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preselectedService?.id || ''
  );
  const [targetLink, setTargetLink] = useState('');
  const [quantity, setQuantity] = useState<number>(preselectedService?.minQuantity || 100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ orderId: string; providerNote: string } | null>(null);

  const platformServices = useMemo(
    () => services.filter((s) => s.platform === selectedPlatform),
    [services, selectedPlatform]
  );

  const activeService = useMemo(
    () => platformServices.find((s) => s.id === selectedServiceId) || platformServices[0] || null,
    [platformServices, selectedServiceId]
  );

  useEffect(() => {
    if (preselectedService) {
      setSelectedPlatform(preselectedService.platform);
      setSelectedServiceId(preselectedService.id);
      setQuantity(preselectedService.minQuantity);
    }
  }, [preselectedService]);

  useEffect(() => {
    if (activeService && activeService.id !== selectedServiceId) {
      setSelectedServiceId(activeService.id);
      setQuantity(activeService.minQuantity);
    }
  }, [activeService, selectedServiceId]);

  const currentBalance = wallet?.balance ?? 0;
  const calculatedCharge = activeService
    ? calculateOrderCharge(activeService.ratePer1000, Math.max(0, Math.floor(quantity)))
    : 0;
  const insufficientBalance = calculatedCharge > currentBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessInfo(null);

    if (!firebaseUser) {
      navigate('/login');
      return;
    }
    if (!emailVerified) {
      setError('Please verify your email address before placing an order.');
      return;
    }
    if (!activeService) {
      setError('No service is selected.');
      return;
    }
    if (activeService.status !== 'active') {
      setError('This service is currently paused or in maintenance.');
      return;
    }
    if (!isValidTargetInput(targetLink)) {
      setError('Enter a valid profile URL or username (2 to 300 characters).');
      return;
    }
    const cleanQty = Math.floor(Number(quantity));
    if (
      !Number.isInteger(cleanQty) ||
      cleanQty < activeService.minQuantity ||
      cleanQty > activeService.maxQuantity
    ) {
      setError(
        `Quantity must be between ${formatNumber(activeService.minQuantity)} and ${formatNumber(activeService.maxQuantity)}.`
      );
      return;
    }
    if (calculatedCharge <= 0 || calculatedCharge > currentBalance) {
      setError('Insufficient wallet balance. Add funds to your wallet before placing this order.');
      return;
    }

    setBusy(true);
    const orderId = generateSafeId('ord');
    const txId = generateSafeId('tx');
    const notifId = generateSafeId('ntf');
    const newBalance = Math.round((currentBalance - calculatedCharge) * 10000) / 10000;
    const newTotalSpent = Math.round(((wallet?.totalSpent ?? 0) + calculatedCharge) * 10000) / 10000;

    try {
      const batch = writeBatch(db);

      batch.set(doc(db, 'orders', orderId), {
        id: orderId,
        userId: firebaseUser.uid,
        userEmail: firebaseUser.email || '',
        serviceId: activeService.id,
        serviceName: sanitizeText(activeService.name, VALIDATION_LIMITS.serviceNameMax),
        platform: activeService.platform,
        targetLink: sanitizeText(targetLink, VALIDATION_LIMITS.targetLinkMax),
        quantity: cleanQty,
        charge: calculatedCharge,
        status: 'pending',
        providerOrderId: '',
        providerStatus: 'awaiting_dispatch',
        startCount: 0,
        remains: cleanQty,
        supportsCancel: activeService.supportsCancel,
        supportsRefill: activeService.supportsRefill,
        cancelRequested: false,
        refillRequested: false,
        refillStatus: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(doc(db, 'wallets', firebaseUser.uid), {
        balance: newBalance,
        totalSpent: newTotalSpent,
        lastOrderId: orderId,
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: firebaseUser.uid,
        type: 'order_debit',
        amount: -calculatedCharge,
        balanceAfter: newBalance,
        reference: orderId,
        orderId,
        gateway: 'wallet',
        status: 'completed',
        description: sanitizeText(`Order ${orderId} · ${activeService.name}`, 240),
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: firebaseUser.uid,
        title: 'Order Submitted',
        message: `${formatNumber(cleanQty)} units queued for ${activeService.name} (${formatCurrency(calculatedCharge)}).`,
        category: 'order',
        read: false,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      // Dispatch to server-side Delex Gains integration endpoint
      let providerNote = 'Order recorded in Firestore queue.';
      try {
        const providerRes = await authorizedFetch<{ ok?: boolean; message?: string; providerOrderId?: string }>(
          '/api/provider/orders/submit',
          {
            method: 'POST',
            body: JSON.stringify({
              internalOrderId: orderId,
              providerServiceId: activeService.providerServiceId || activeService.id,
              targetLink: sanitizeText(targetLink, VALIDATION_LIMITS.targetLinkMax),
              quantity: cleanQty,
            }),
          }
        );
        if (providerRes.ok && providerRes.data.providerOrderId) {
          providerNote = `Synchronized with provider order #${providerRes.data.providerOrderId}.`;
        } else if (providerRes.data.message) {
          providerNote = `Queued locally — ${providerRes.data.message}`;
        }
      } catch {
        providerNote = 'Order saved locally; provider dispatch awaits server connection.';
      }

      setSuccessInfo({ orderId, providerNote });
      setTargetLink('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout title="New Order">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Place New Social Growth Order</h2>
            <p className="text-xs text-zinc-400">
              Choose a platform, pick an active service, and preview your exact charge before confirming.
            </p>
          </div>

          {/* Platform selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">Platform</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => {
                    setSelectedPlatform(platform);
                    setSelectedServiceId('');
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors ${
                    selectedPlatform === platform
                      ? 'bg-[#2563EB]/20 border-[#2563EB] text-white'
                      : 'bg-[#050507] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <PlatformIcon platform={platform} className="w-4 h-4 shrink-0" />
                  <span className="truncate">{PLATFORM_LABELS[platform]}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          {successInfo && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>Order {successInfo.orderId} submitted</span>
              </div>
              <p className="text-xs text-zinc-300">{successInfo.providerNote}</p>
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="text-xs font-medium text-[#60A5FA] hover:underline"
              >
                Track in Order History
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Service</label>
              <select
                value={activeService?.id || ''}
                onChange={(e) => {
                  const srv = platformServices.find((s) => s.id === e.target.value);
                  setSelectedServiceId(e.target.value);
                  if (srv) setQuantity(srv.minQuantity);
                }}
                disabled={platformServices.length === 0}
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB] disabled:opacity-50"
              >
                {platformServices.length === 0 ? (
                  <option value="">No services published for {PLATFORM_LABELS[selectedPlatform]}</option>
                ) : (
                  platformServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatCurrency(s.ratePer1000)} / 1,000 ({s.status})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Target Link or Username
              </label>
              <input
                type="text"
                required
                maxLength={VALIDATION_LIMITS.targetLinkMax}
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
                placeholder="https://x.com/username/status/... or @handle"
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Quantity{' '}
                {activeService && (
                  <span className="text-zinc-500">
                    (Min {formatNumber(activeService.minQuantity)} · Max {formatNumber(activeService.maxQuantity)})
                  </span>
                )}
              </label>
              <input
                type="number"
                required
                min={activeService?.minQuantity || 1}
                max={activeService?.maxQuantity || 1000000}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="p-4 rounded-lg bg-[#050507] border border-white/[0.08] flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-zinc-400">Calculated Total</p>
                <p className="text-2xl font-mono font-bold text-white tabular-nums mt-0.5">
                  {formatCurrency(calculatedCharge)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">Wallet Balance</p>
                <p
                  className={`text-sm font-mono font-medium tabular-nums mt-0.5 ${
                    insufficientBalance ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(currentBalance)}
                </p>
              </div>
            </div>

            {insufficientBalance && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                <span>Wallet balance is lower than the calculated order charge.</span>
                <button
                  type="button"
                  onClick={() => navigate('/wallet')}
                  className="font-semibold text-white underline whitespace-nowrap"
                >
                  Add Funds
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !activeService || activeService.status !== 'active' || insufficientBalance || !emailVerified}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors"
            >
              {busy ? 'Submitting Order...' : `Confirm & Pay ${formatCurrency(calculatedCharge)}`}
            </button>
          </form>
        </div>

        {/* Service Details Panel */}
        <div className="lg:col-span-5 bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-white">Service Specification</h3>
            {activeService && <StatusText status={activeService.status} />}
          </div>

          {activeService ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500">{PLATFORM_LABELS[activeService.platform]} · {activeService.category}</p>
                <p className="text-base font-medium text-white mt-1">{activeService.name}</p>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{activeService.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.06] text-xs">
                <div>
                  <p className="text-zinc-500">Rate per 1,000</p>
                  <p className="text-sm font-mono font-semibold text-white tabular-nums mt-0.5">
                    {formatCurrency(activeService.ratePer1000)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Estimated Delivery</p>
                  <p className="text-sm text-white mt-0.5">{activeService.estimatedTime}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Min / Max Order</p>
                  <p className="text-sm font-mono text-white tabular-nums mt-0.5">
                    {formatNumber(activeService.minQuantity)} – {formatNumber(activeService.maxQuantity)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Cancel / Refill</p>
                  <p className="text-sm text-white mt-0.5">
                    {activeService.supportsCancel ? 'Cancel Yes' : 'Cancel No'} · {activeService.supportsRefill ? 'Refill Yes' : 'Refill No'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#050507] border border-white/[0.06] flex items-start gap-2.5 text-xs text-zinc-400">
                <Info className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                <span>
                  Ensure the target profile or channel is set to public before submitting. Private accounts cannot receive delivery.
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              Select a platform with active services to inspect delivery limits and rate specifications.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
