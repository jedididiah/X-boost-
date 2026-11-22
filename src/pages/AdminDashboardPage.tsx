import React, { useEffect, useState } from 'react';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Plug,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ALL_PLATFORMS, PLATFORM_LABELS } from '../components/PlatformIcon';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { authorizedFetch } from '../lib/api';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { STARTER_CATALOG } from '../lib/seedCatalog';
import {
  VALIDATION_LIMITS,
  formatCurrency,
  formatNumber,
  formatTimestamp,
  generateSafeId,
  sanitizeText,
} from '../lib/validation';
import type {
  OrderStatus,
  PaymentRecord,
  ServiceStatus,
  SmmOrder,
  SocialPlatform,
  TicketStatus,
} from '../types';

type AdminTab = 'orders' | 'services' | 'users' | 'payments' | 'api' | 'comms';

interface ProviderStatusPayload {
  provider: string;
  apiUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  endpointSpecConfirmed: boolean;
  ready: boolean;
  missingRequirements: string[];
  requiredEnvVars: string[];
}

interface ServerGatewayStatus {
  flutterwaveConfigured: boolean;
  flutterwaveWebhookConfigured: boolean;
}

interface WebhookEventItem {
  txRef: string;
  transactionId: string;
  event: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  status: 'verified' | 'failed' | 'ignored';
  verified: boolean;
  credited: boolean;
  message: string;
  updatedAt: string;
}

export function AdminDashboardPage() {
  const { isAdmin, authReady, firebaseUser } = useAuth();
  const {
    services,
    adminSettings,
    announcements,
    allUsers,
    allWallets,
    allOrders,
    allTransactions,
    allPayments,
    allTickets,
  } = useData();
  const { navigate } = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Service creation state
  const [srvPlatform, setSrvPlatform] = useState<SocialPlatform>('X');
  const [srvCategory, setSrvCategory] = useState('Followers');
  const [srvName, setSrvName] = useState('');
  const [srvDesc, setSrvDesc] = useState('');
  const [srvProviderRate, setSrvProviderRate] = useState(2.0);
  const [srvMargin, setSrvMargin] = useState(35);
  const [srvMin, setSrvMin] = useState(100);
  const [srvMax, setSrvMax] = useState(50000);
  const [srvEta, setSrvEta] = useState('1 - 6 hours');
  const [srvProviderId, setSrvProviderId] = useState('');
  const [srvCancel, setSrvCancel] = useState(true);
  const [srvRefill, setSrvRefill] = useState(true);
  const [srvPopular, setSrvPopular] = useState(false);
  const [batchMargin, setBatchMargin] = useState(35);

  // Wallet adjustment state
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(10);
  const [adjustReason, setAdjustReason] = useState('Verified deposit credit');

  // Announcement state
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annSeverity, setAnnSeverity] = useState<'info' | 'notice' | 'maintenance'>('info');

  // Ticket reply state
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // Provider & Payment server status
  const [providerStatus, setProviderStatus] = useState<ProviderStatusPayload | null>(null);
  const [providerTestMsg, setProviderTestMsg] = useState('');
  const [paymentServerStatus, setPaymentServerStatus] = useState<ServerGatewayStatus | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventItem[]>([]);
  const [flwTxIds, setFlwTxIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAdmin) return;
    authorizedFetch<{ ok?: boolean; status?: ProviderStatusPayload }>('/api/provider/status')
      .then((res) => {
        if (res.ok && res.data.status) setProviderStatus(res.data.status);
      })
      .catch(() => {});
    authorizedFetch<{ ok?: boolean; status?: ServerGatewayStatus }>('/api/payments/status')
      .then((res) => {
        if (res.ok && res.data.status) setPaymentServerStatus(res.data.status);
      })
      .catch(() => {});
    authorizedFetch<{ ok?: boolean; events?: WebhookEventItem[] }>('/api/payments/webhook-events')
      .then((res) => {
        if (res.ok && Array.isArray(res.data.events)) setWebhookEvents(res.data.events);
      })
      .catch(() => {});
  }, [isAdmin]);

  if (authReady && (!firebaseUser || !isAdmin)) {
    return (
      <DashboardLayout title="Admin Access Restricted">
        <div className="bg-[#0B0C10] border border-rose-500/30 rounded-xl p-8 max-w-lg space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <ShieldAlert className="w-6 h-6" />
            <h2 className="text-lg font-semibold text-white">Administrator Authorization Required</h2>
          </div>
          <p className="text-sm text-zinc-400">
            This console is strictly restricted to verified administrators.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const totalRevenue = allTransactions
    .filter((t) => t.type === 'order_debit' && t.status === 'completed')
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const pendingOrders = allOrders.filter((o) =>
    ['pending', 'processing', 'in_progress'].includes(o.status)
  ).length;
  const completedOrders = allOrders.filter((o) => o.status === 'completed').length;
  const failedOrders = allOrders.filter((o) =>
    ['failed', 'cancelled', 'refunded'].includes(o.status)
  ).length;

  const handleSeedCatalog = async () => {
    setBusy(true);
    setNotice('');
    try {
      const batch = writeBatch(db);
      for (const item of STARTER_CATALOG) {
        batch.set(doc(db, 'services', item.id), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      if (!adminSettings) {
        batch.set(doc(db, 'adminSettings', 'platform'), {
          id: 'platform',
          defaultMarginPercent: 35,
          minDepositUsd: 5,
          flutterwaveEnabled: true,
          providerAutoSync: false,
          maintenanceMode: false,
          supportEmail: firebaseUser?.email || 'support@xboost.app',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setNotice(`Published ${STARTER_CATALOG.length} starter services across all 7 platforms.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'services');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    const serviceId = generateSafeId('srv');
    const ratePer1000 = Math.round(srvProviderRate * (1 + srvMargin / 100) * 10000) / 10000;
    try {
      await setDoc(doc(db, 'services', serviceId), {
        id: serviceId,
        platform: srvPlatform,
        category: sanitizeText(srvCategory, 60),
        name: sanitizeText(srvName, VALIDATION_LIMITS.serviceNameMax),
        description: sanitizeText(srvDesc, VALIDATION_LIMITS.serviceDescMax),
        providerRatePer1000: Number(srvProviderRate),
        marginPercent: Number(srvMargin),
        ratePer1000: Math.max(0.01, ratePer1000),
        minQuantity: Math.max(1, Math.floor(srvMin)),
        maxQuantity: Math.max(Math.floor(srvMin), Math.floor(srvMax)),
        estimatedTime: sanitizeText(srvEta, 80),
        status: 'active',
        supportsCancel: srvCancel,
        supportsRefill: srvRefill,
        providerServiceId: sanitizeText(srvProviderId, 80),
        providerName: 'Delex Gains',
        popular: srvPopular,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSrvName('');
      setSrvDesc('');
      setSrvProviderId('');
      setNotice(`Service "${srvName}" created at ${formatCurrency(ratePer1000)}/1k.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `services/${serviceId}`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleServiceStatus = async (serviceId: string, nextStatus: ServiceStatus) => {
    try {
      await updateDoc(doc(db, 'services', serviceId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `services/${serviceId}`);
    }
  };

  const handleApplyBatchMargin = async () => {
    if (services.length === 0) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      for (const s of services) {
        const nextRate =
          Math.round(s.providerRatePer1000 * (1 + batchMargin / 100) * 10000) / 10000;
        batch.update(doc(db, 'services', s.id), {
          marginPercent: batchMargin,
          ratePer1000: Math.max(0.01, nextRate),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setNotice(`Applied ${batchMargin}% margin across ${services.length} services.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'services');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      await deleteDoc(doc(db, 'services', serviceId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `services/${serviceId}`);
    }
  };

  const handleUpdateOrderStatus = async (order: SmmOrder, nextStatus: OrderStatus) => {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', order.id), {
        status: nextStatus,
        remains: nextStatus === 'completed' ? 0 : order.remains,
        refillStatus: order.refillRequested && nextStatus === 'completed' ? 'completed' : order.refillStatus,
        updatedAt: serverTimestamp(),
      });

      // Automatic refund when admin marks order refunded or cancelled from active state
      if (
        (nextStatus === 'refunded' || nextStatus === 'cancelled') &&
        !['refunded', 'cancelled'].includes(order.status)
      ) {
        const userWallet = allWallets.find((w) => w.userId === order.userId);
        if (userWallet) {
          const refundedBalance = Math.round((userWallet.balance + order.charge) * 10000) / 10000;
          const txId = generateSafeId('tx');
          const notifId = generateSafeId('ntf');
          batch.update(doc(db, 'wallets', order.userId), {
            balance: refundedBalance,
            updatedAt: serverTimestamp(),
          });
          batch.set(doc(db, 'transactions', txId), {
            id: txId,
            userId: order.userId,
            type: 'refund',
            amount: order.charge,
            balanceAfter: refundedBalance,
            reference: order.id,
            orderId: order.id,
            gateway: 'system_refund',
            status: 'completed',
            description: `Refund for ${nextStatus} order ${order.id}`,
            createdAt: serverTimestamp(),
          });
          batch.set(doc(db, 'notifications', notifId), {
            id: notifId,
            userId: order.userId,
            title: 'Order Refunded',
            message: `${formatCurrency(order.charge)} refunded to your wallet for order ${order.id}.`,
            category: 'wallet',
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      setNotice(`Order ${order.id} updated to "${nextStatus}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUserId || !Number.isFinite(adjustAmount) || adjustAmount === 0) return;
    const targetWallet = allWallets.find((w) => w.userId === adjustUserId);
    if (!targetWallet) return;

    const nextBalance = Math.round((targetWallet.balance + adjustAmount) * 10000) / 10000;
    if (nextBalance < 0) {
      setNotice('Adjustment would make wallet balance negative.');
      return;
    }

    setBusy(true);
    const txId = generateSafeId('tx');
    const notifId = generateSafeId('ntf');
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'wallets', adjustUserId), {
        balance: nextBalance,
        totalDeposited:
          adjustAmount > 0
            ? Math.round((targetWallet.totalDeposited + adjustAmount) * 10000) / 10000
            : targetWallet.totalDeposited,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: adjustUserId,
        type: adjustAmount > 0 ? 'deposit' : 'admin_adjustment',
        amount: adjustAmount,
        balanceAfter: nextBalance,
        reference: txId,
        orderId: '',
        gateway: 'admin_ledger',
        status: 'completed',
        description: sanitizeText(adjustReason || 'Admin ledger adjustment', 240),
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: adjustUserId,
        title: 'Wallet Updated',
        message: `${adjustAmount >= 0 ? 'Credited' : 'Adjusted'} ${formatCurrency(Math.abs(adjustAmount))} (${adjustReason}).`,
        category: 'wallet',
        read: false,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      setNotice(`Updated wallet balance for user ${adjustUserId} to ${formatCurrency(nextBalance)}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `wallets/${adjustUserId}`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleFlutterwave = async (value: boolean) => {
    const cleanSettings = {
      id: 'platform',
      defaultMarginPercent: adminSettings?.defaultMarginPercent ?? 35,
      minDepositUsd: adminSettings?.minDepositUsd ?? 5,
      flutterwaveEnabled: value,
      providerAutoSync: adminSettings?.providerAutoSync ?? false,
      maintenanceMode: adminSettings?.maintenanceMode ?? false,
      supportEmail: adminSettings?.supportEmail || firebaseUser?.email || 'support@xboost.app',
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'adminSettings', 'platform'), cleanSettings);
      setNotice(`Flutterwave gateway ${value ? 'activated' : 'paused'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'adminSettings/platform');
    }
  };

  const handleVerifyAndCreditPayment = async (record: PaymentRecord) => {
    if (record.status === 'verified') {
      setNotice(`Payment ${record.reference} is already verified and settled.`);
      return;
    }

    const matchedWebhook = webhookEvents.find((ev) => ev.txRef === record.reference && ev.transactionId);
    const txId = (flwTxIds[record.id] || matchedWebhook?.transactionId || '').trim();
    if (!txId || !/^[0-9]+$/.test(txId)) {
      setNotice('Enter the numeric Flutterwave transaction_id before verifying.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      const res = await authorizedFetch<{
        verified?: boolean;
        message?: string;
        amount?: number;
        currency?: string;
      }>('/api/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          gateway: 'flutterwave',
          reference: record.reference,
          transactionId: txId,
          expectedAmount: record.amount,
          expectedCurrency: record.currency,
        }),
      });

      if (!res.data.verified) {
        await updateDoc(doc(db, 'paymentRecords', record.id), {
          status: 'failed',
          gatewayMessage: (res.data.message || 'Flutterwave verification failed.').slice(0, 300),
          updatedAt: serverTimestamp(),
        });
        setNotice(res.data.message || `Verification failed for ${record.reference}.`);
        return;
      }

      const targetWallet = allWallets.find((w) => w.userId === record.userId);
      if (!targetWallet) {
        setNotice(`Verified on Flutterwave, but wallet not found for user ${record.userId}.`);
        return;
      }

      if (record.currency !== 'USD') {
        await updateDoc(doc(db, 'paymentRecords', record.id), {
          status: 'verified',
          verifiedByServer: true,
          gatewayMessage: `Verified ${res.data.amount ?? record.amount} ${res.data.currency ?? record.currency} (ID ${txId}). Convert & credit USD in Users & Wallets.`,
          updatedAt: serverTimestamp(),
        });
        setNotice(
          `Verified ${record.reference} (${res.data.amount ?? record.amount} ${record.currency}). Apply USD equivalent via Users & Wallets.`
        );
        return;
      }

      const nextBalance = Math.round((targetWallet.balance + record.amount) * 10000) / 10000;
      const ledgerTxId = generateSafeId('tx');
      const notifId = generateSafeId('ntf');
      const batch = writeBatch(db);
      batch.update(doc(db, 'paymentRecords', record.id), {
        status: 'verified',
        verifiedByServer: true,
        gatewayMessage: `Verified via Flutterwave (ID ${txId})`,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'wallets', record.userId), {
        balance: nextBalance,
        totalDeposited: Math.round((targetWallet.totalDeposited + record.amount) * 10000) / 10000,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'transactions', ledgerTxId), {
        id: ledgerTxId,
        userId: record.userId,
        type: 'deposit',
        amount: record.amount,
        balanceAfter: nextBalance,
        reference: record.reference,
        orderId: '',
        gateway: 'flutterwave',
        status: 'completed',
        description: `Flutterwave deposit (${record.reference})`,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: record.userId,
        title: 'Wallet Funded',
        message: `${formatCurrency(record.amount)} credited via Flutterwave (${record.reference}).`,
        category: 'wallet',
        read: false,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      await authorizedFetch('/api/payments/webhook-events/mark-credited', {
        method: 'POST',
        body: JSON.stringify({ reference: record.reference }),
      }).catch(() => {});
      setWebhookEvents((prev) =>
        prev.map((ev) => (ev.txRef === record.reference ? { ...ev, credited: true } : ev))
      );
      setNotice(`Verified ${record.reference} and credited ${formatCurrency(record.amount)} to ${record.userEmail}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `paymentRecords/${record.id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleTestProvider = async () => {
    setBusy(true);
    setProviderTestMsg('');
    try {
      const res = await authorizedFetch<{ message?: string }>('/api/provider/test', {
        method: 'POST',
      });
      setProviderTestMsg(res.data.message || 'Checked provider connection.');
    } finally {
      setBusy(false);
    }
  };

  const handleFetchProviderServices = async () => {
    setBusy(true);
    setProviderTestMsg('');
    try {
      const res = await authorizedFetch<{ message?: string }>('/api/provider/services');
      setProviderTestMsg(res.data.message || 'Checked provider service catalog endpoint.');
    } finally {
      setBusy(false);
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const id = generateSafeId('ann');
    try {
      await setDoc(doc(db, 'announcements', id), {
        id,
        title: sanitizeText(annTitle, VALIDATION_LIMITS.announcementTitleMax),
        body: sanitizeText(annBody, VALIDATION_LIMITS.announcementBodyMax),
        severity: annSeverity,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAnnTitle('');
      setAnnBody('');
      setNotice('Announcement published.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `announcements/${id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReplyTicket = async (ticketId: string, status: TicketStatus) => {
    const reply = (replyDrafts[ticketId] || '').trim();
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status,
        adminReply: sanitizeText(reply, 1200),
        updatedAt: serverTimestamp(),
      });
      setNotice(`Updated ticket ${ticketId}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${ticketId}`);
    }
  };

  return (
    <DashboardLayout title="Admin Dashboard">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Registered Users</p>
          <p className="text-2xl font-display font-bold text-white tabular-nums mt-1.5">
            {formatNumber(allUsers.length)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Order Revenue</p>
          <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums mt-1.5">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Total Orders</p>
          <p className="text-2xl font-display font-bold text-white tabular-nums mt-1.5">
            {formatNumber(allOrders.length)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Pending Orders</p>
          <p className="text-2xl font-display font-bold text-amber-400 tabular-nums mt-1.5">
            {formatNumber(pendingOrders)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Completed</p>
          <p className="text-2xl font-display font-bold text-[#60A5FA] tabular-nums mt-1.5">
            {formatNumber(completedOrders)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Failed / Cancelled</p>
          <p className="text-2xl font-display font-bold text-rose-400 tabular-nums mt-1.5">
            {formatNumber(failedOrders)}
          </p>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg bg-[#0B0C10] border border-[#2563EB]/40 text-xs text-zinc-100 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#3B82F6] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Admin Tab Bar */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-white/[0.08]">
        {[
          { id: 'orders', label: 'Orders Queue' },
          { id: 'services', label: 'Services & Margins' },
          { id: 'users', label: 'Users & Wallets' },
          { id: 'payments', label: 'Payments & Ledger' },
          { id: 'api', label: 'Delex Gains API' },
          { id: 'comms', label: 'Announcements & Support' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#0B0C10] text-zinc-400 hover:text-white border border-white/[0.08]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ORDERS */}
      {activeTab === 'orders' && (
        <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">All Customer Orders</h2>
            <span className="text-xs text-zinc-400 tabular-nums">{allOrders.length} total</span>
          </div>
          {allOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">No customer orders submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-zinc-400">
                    <th className="py-3 px-4">Order / User</th>
                    <th className="py-3 px-4">Service & Target</th>
                    <th className="py-3 px-4 text-right">Qty / Charge</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {allOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-3 px-4">
                        <p className="font-mono text-xs text-white">{order.id}</p>
                        <p className="text-[11px] text-zinc-400">{order.userEmail}</p>
                        <p className="text-[11px] text-zinc-600">{formatTimestamp(order.createdAt)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-white">{order.serviceName}</p>
                        <p className="text-xs text-zinc-500 truncate max-w-xs">{order.targetLink}</p>
                        {order.cancelRequested && (
                          <span className="text-[11px] text-amber-400 block mt-0.5">
                            Customer requested cancel
                          </span>
                        )}
                        {order.refillRequested && (
                          <span className="text-[11px] text-[#60A5FA] block mt-0.5">
                            Customer requested refill
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        <p className="text-white">{formatNumber(order.quantity)}</p>
                        <p className="text-zinc-400">{formatCurrency(order.charge)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={order.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select
                          value={order.status}
                          disabled={busy}
                          onChange={(e) => void handleUpdateOrderStatus(order, e.target.value as OrderStatus)}
                          className="px-2.5 py-1.5 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
                        >
                          <option value="pending">pending</option>
                          <option value="processing">processing</option>
                          <option value="in_progress">in_progress</option>
                          <option value="completed">completed</option>
                          <option value="partial">partial</option>
                          <option value="cancelled">cancelled (refunds)</option>
                          <option value="refunded">refunded (refunds)</option>
                          <option value="failed">failed</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SERVICES & MARGINS */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">Catalog & Global Profit Margin</h2>
              <p className="text-xs text-zinc-400">
                Publish starter services across all 7 platforms or batch-update profit margins on provider rates.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={batchMargin}
                  onChange={(e) => setBatchMargin(Number(e.target.value) || 0)}
                  className="w-20 px-2.5 py-2 text-xs font-mono bg-[#050507] border border-white/15 rounded-lg text-white"
                />
                <button
                  type="button"
                  disabled={busy || services.length === 0}
                  onClick={handleApplyBatchMargin}
                  className="px-3 py-2 text-xs font-medium text-zinc-200 border border-white/15 hover:bg-white/[0.05] rounded-lg whitespace-nowrap"
                >
                  Apply % Margin to All
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleSeedCatalog}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg whitespace-nowrap"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Publish Starter Catalog (7 Platforms)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleCreateService}
              className="lg:col-span-5 p-6 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-4"
            >
              <h3 className="text-base font-semibold text-white">Add New Service</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">Platform</label>
                  <select
                    value={srvPlatform}
                    onChange={(e) => setSrvPlatform(e.target.value as SocialPlatform)}
                    className="w-full px-3 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
                  >
                    {ALL_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {PLATFORM_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">Category</label>
                  <input
                    type="text"
                    required
                    value={srvCategory}
                    onChange={(e) => setSrvCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-zinc-400">Service Name</label>
                <input
                  type="text"
                  required
                  value={srvName}
                  onChange={(e) => setSrvName(e.target.value)}
                  placeholder="X (Twitter) High-Retention Followers"
                  className="w-full px-3 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-zinc-400">Description</label>
                <textarea
                  rows={2}
                  required
                  value={srvDesc}
                  onChange={(e) => setSrvDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">Provider $/1K</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={srvProviderRate}
                    onChange={(e) => setSrvProviderRate(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#050507] border border-white/15 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">Margin %</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={srvMargin}
                    onChange={(e) => setSrvMargin(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#050507] border border-white/15 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">Sell $/1K</label>
                  <div className="px-3 py-2 text-xs font-mono text-emerald-400 bg-[#050507] border border-white/10 rounded-lg">
                    {formatCurrency(srvProviderRate * (1 + srvMargin / 100))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">Min Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={srvMin}
                    onChange={(e) => setSrvMin(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#050507] border border-white/15 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">Max Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={srvMax}
                    onChange={(e) => setSrvMax(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#050507] border border-white/15 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-zinc-400">Est. Time</label>
                  <input
                    type="text"
                    required
                    value={srvEta}
                    onChange={(e) => setSrvEta(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-zinc-400">Delex Gains Service ID (Optional)</label>
                <input
                  type="text"
                  value={srvProviderId}
                  onChange={(e) => setSrvProviderId(e.target.value)}
                  placeholder="Mapped once API docs/credentials are connected"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#050507] border border-white/15 rounded-lg text-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={srvCancel} onChange={(e) => setSrvCancel(e.target.checked)} />
                  <span>Supports Cancel</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={srvRefill} onChange={(e) => setSrvRefill(e.target.checked)} />
                  <span>Supports Refill</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={srvPopular} onChange={(e) => setSrvPopular(e.target.checked)} />
                  <span>Popular</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Create Service</span>
              </button>
            </form>

            <div className="lg:col-span-7 rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.08]">
                <h3 className="text-base font-semibold text-white">Published Services ({services.length})</h3>
              </div>
              <div className="divide-y divide-white/[0.06] max-h-[620px] overflow-y-auto">
                {services.map((s) => (
                  <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-white truncate">{s.name}</p>
                      <p className="text-xs text-zinc-400">
                        {PLATFORM_LABELS[s.platform]} · Cost {formatCurrency(s.providerRatePer1000)} · Margin {s.marginPercent}% · Sell{' '}
                        <span className="text-white font-mono">{formatCurrency(s.ratePer1000)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={s.status}
                        onChange={(e) => void handleToggleServiceStatus(s.id, e.target.value as ServiceStatus)}
                        className="px-2.5 py-1.5 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
                      >
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                        <option value="maintenance">maintenance</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleDeleteService(s.id)}
                        aria-label={`Delete ${s.name}`}
                        className="p-1.5 text-rose-400 hover:text-white border border-white/10 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USERS & WALLETS */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08]">
              <h2 className="text-base font-semibold text-white">Registered Accounts</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-zinc-400">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Wallet Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {allUsers.map((u) => {
                    const uw = allWallets.find((w) => w.userId === u.uid);
                    return (
                      <tr key={u.uid}>
                        <td className="py-3 px-4">
                          <p className="text-xs font-medium text-white">{u.displayName}</p>
                          <p className="text-[11px] text-zinc-400">{u.email}</p>
                        </td>
                        <td className="py-3 px-4 text-xs capitalize text-zinc-300">{u.role}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-white">
                          {formatCurrency(uw?.balance ?? 0)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusText status={u.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setAdjustUserId(u.uid)}
                            className="px-2.5 py-1 text-xs text-[#60A5FA] border border-[#2563EB]/40 rounded-md hover:bg-[#2563EB]/15"
                          >
                            Select Wallet
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={handleAdjustWallet}
            className="lg:col-span-4 p-6 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-4"
          >
            <h3 className="text-base font-semibold text-white">Ledger Credit / Adjustment</h3>
            <p className="text-xs text-zinc-400">
              Credit verified offline/custom deposits or issue manual adjustments with an immutable ledger log.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-400">User</label>
              <select
                required
                value={adjustUserId}
                onChange={(e) => setAdjustUserId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
              >
                <option value="">Select user...</option>
                {allUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-400">Amount (USD, negative to debit)</label>
              <input
                type="number"
                step="0.01"
                required
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#050507] border border-white/15 rounded-lg text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-400">Reason / Reference</label>
              <input
                type="text"
                required
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !adjustUserId}
              className="w-full py-2.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg disabled:opacity-50"
            >
              Apply Ledger Entry
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: PAYMENTS & LEDGER */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white">Flutterwave</span>
                  <p className="text-xs text-zinc-400 mt-0.5">Primary customer payment gateway</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleToggleFlutterwave(!(adminSettings ? adminSettings.flutterwaveEnabled : true))
                  }
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    (adminSettings ? adminSettings.flutterwaveEnabled : true)
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {(adminSettings ? adminSettings.flutterwaveEnabled : true) ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-[#050507] border border-white/[0.06]">
                  <p className="text-[11px] text-zinc-400">Secret Key (FLUTTERWAVE_SECRET_KEY)</p>
                  <p
                    className={`text-xs font-semibold mt-1 ${
                      paymentServerStatus?.flutterwaveConfigured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {paymentServerStatus?.flutterwaveConfigured ? 'Configured' : 'Not Set'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#050507] border border-white/[0.06]">
                  <p className="text-[11px] text-zinc-400">Webhook Hash (FLUTTERWAVE_WEBHOOK_HASH)</p>
                  <p
                    className={`text-xs font-semibold mt-1 ${
                      paymentServerStatus?.flutterwaveWebhookConfigured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {paymentServerStatus?.flutterwaveWebhookConfigured ? 'Configured' : 'Not Set'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-2.5">
              <span className="text-sm font-semibold text-white">Webhook &amp; Callback Endpoints</span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Configure your Flutterwave V3 dashboard webhook URL to receive signed <code className="text-zinc-200">verif-hash</code> notifications.
              </p>
              <div className="p-3 rounded-lg bg-[#050507] border border-white/[0.06] font-mono text-xs text-zinc-300 space-y-1 break-all">
                <div>Webhook URL: {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/flutterwave` : '/api/webhooks/flutterwave'}</div>
                <div>Callback URL: {typeof window !== 'undefined' ? `${window.location.origin}/wallet` : '/wallet'}</div>
              </div>
            </div>
          </div>

          {webhookEvents.length > 0 && (
            <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.08]">
                <h2 className="text-base font-semibold text-white">
                  Flutterwave Webhook Log ({webhookEvents.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs text-zinc-400">
                      <th className="py-3 px-4">Reference (tx_ref)</th>
                      <th className="py-3 px-4">Transaction ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Ledger Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {webhookEvents.map((ev) => (
                      <tr key={`${ev.txRef}-${ev.transactionId}`}>
                        <td className="py-3 px-4 font-mono text-xs text-white">{ev.txRef}</td>
                        <td className="py-3 px-4 font-mono text-xs text-zinc-300">{ev.transactionId || '—'}</td>
                        <td className="py-3 px-4 text-xs text-zinc-300">{ev.customerEmail || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-white">
                          {ev.amount.toFixed(2)} {ev.currency}
                        </td>
                        <td className="py-3 px-4">
                          <StatusText status={ev.status} />
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className={ev.credited ? 'text-emerald-400' : 'text-amber-400'}>
                            {ev.credited ? 'Credited' : 'Pending Settlement'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08]">
              <h2 className="text-base font-semibold text-white">All Payment Records ({allPayments.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-zinc-400">
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Gateway</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Message</th>
                    <th className="py-3 px-4 text-right">Flutterwave Verify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {allPayments.map((p) => {
                    const webhookMatch = webhookEvents.find((ev) => ev.txRef === p.reference);
                    const effectiveInputVal = flwTxIds[p.id] ?? webhookMatch?.transactionId ?? '';
                    return (
                      <tr key={p.id}>
                        <td className="py-3 px-4 font-mono text-xs text-white">{p.reference}</td>
                        <td className="py-3 px-4 text-xs text-zinc-300">{p.userEmail}</td>
                        <td className="py-3 px-4 text-xs capitalize text-zinc-400">{p.gateway}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-white">
                          {p.amount.toFixed(2)} {p.currency}
                        </td>
                        <td className="py-3 px-4">
                          <StatusText status={p.status} />
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-400 max-w-xs truncate">
                          {p.gatewayMessage}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {p.status !== 'verified' ? (
                            <div className="inline-flex items-center gap-2">
                              <input
                                type="text"
                                value={effectiveInputVal}
                                onChange={(e) =>
                                  setFlwTxIds((prev) => ({ ...prev, [p.id]: e.target.value }))
                                }
                                placeholder="transaction_id"
                                className="w-28 px-2 py-1 text-xs font-mono bg-[#050507] border border-white/15 rounded text-white"
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleVerifyAndCreditPayment(p)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded whitespace-nowrap disabled:opacity-50"
                              >
                                Verify &amp; Credit
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-400">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DELEX GAINS API */}
      {activeTab === 'api' && (
        <div className="bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Plug className="w-5 h-5 text-[#3B82F6]" />
                <h2 className="text-lg font-semibold text-white">Delex Gains Provider Integration</h2>
              </div>
              <p className="text-xs text-zinc-400">
                Credentials and provider requests remain strictly on the backend server. No undocumented endpoints are assumed.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleTestProvider}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Test Connection</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleFetchProviderServices}
                className="px-3.5 py-2 text-xs font-medium text-zinc-200 border border-white/15 hover:bg-white/[0.05] rounded-lg"
              >
                Sync Provider Services
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[#050507] border border-white/[0.08]">
              <p className="text-xs text-zinc-400">API URL (`DELEX_GAINS_API_URL`)</p>
              <p className={`text-sm font-semibold mt-1 ${providerStatus?.apiUrlConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                {providerStatus?.apiUrlConfigured ? 'Configured' : 'Missing Secret'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#050507] border border-white/[0.08]">
              <p className="text-xs text-zinc-400">API Key (`DELEX_GAINS_API_KEY`)</p>
              <p className={`text-sm font-semibold mt-1 ${providerStatus?.apiKeyConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                {providerStatus?.apiKeyConfigured ? 'Configured' : 'Missing Secret'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#050507] border border-white/[0.08]">
              <p className="text-xs text-zinc-400">Endpoint Spec Mapping</p>
              <p className={`text-sm font-semibold mt-1 ${providerStatus?.endpointSpecConfirmed ? 'text-emerald-400' : 'text-amber-400'}`}>
                {providerStatus?.endpointSpecConfirmed ? 'Confirmed' : 'Awaiting Documentation'}
              </p>
            </div>
          </div>

          {providerStatus && providerStatus.missingRequirements.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Required to Activate Live Provider Sync</span>
              </div>
              <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1">
                {providerStatus.missingRequirements.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {providerTestMsg && (
            <div className="p-3.5 rounded-lg bg-[#050507] border border-white/15 text-xs text-zinc-200">
              {providerTestMsg}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ANNOUNCEMENTS & SUPPORT */}
      {activeTab === 'comms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handlePublishAnnouncement}
              className="p-6 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-4"
            >
              <h3 className="text-base font-semibold text-white">Publish Announcement</h3>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Announcement title"
                className="w-full px-3.5 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
              />
              <select
                value={annSeverity}
                onChange={(e) => setAnnSeverity(e.target.value as 'info' | 'notice' | 'maintenance')}
                className="w-full px-3.5 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
              >
                <option value="info">Info</option>
                <option value="notice">Notice</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <textarea
                rows={3}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Announcement details for all dashboard users..."
                className="w-full px-3.5 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
              >
                Publish Announcement
              </button>
            </form>

            <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] divide-y divide-white/[0.06]">
              {announcements.map((a) => (
                <div key={a.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">{a.title}</p>
                    <p className="text-xs text-zinc-400">{a.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        void updateDoc(doc(db, 'announcements', a.id), {
                          active: !a.active,
                          updatedAt: serverTimestamp(),
                        })
                      }
                      className="px-2 py-1 text-[11px] border border-white/15 rounded text-zinc-300"
                    >
                      {a.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteDoc(doc(db, 'announcements', a.id))}
                      className="p-1 text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08]">
              <h3 className="text-base font-semibold text-white">Support Tickets ({allTickets.length})</h3>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {allTickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">No support tickets submitted.</div>
              ) : (
                allTickets.map((t) => (
                  <div key={t.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{t.subject}</p>
                        <p className="text-xs text-zinc-500">{t.userEmail} · {t.category}</p>
                      </div>
                      <StatusText status={t.status} />
                    </div>
                    <p className="text-xs text-zinc-300">{t.message}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={replyDrafts[t.id] ?? t.adminReply}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                        placeholder="Write reply..."
                        className="flex-1 px-3 py-2 text-xs bg-[#050507] border border-white/15 rounded-lg text-white"
                      />
                      <button
                        type="button"
                        onClick={() => void handleReplyTicket(t.id, 'resolved')}
                        className="px-3 py-2 text-xs font-medium text-white bg-[#2563EB] rounded-lg whitespace-nowrap"
                      >
                        Reply & Resolve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
