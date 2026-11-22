import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { RefreshCw, Search } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { PlatformIcon } from '../components/PlatformIcon';
import { StatusText } from '../components/StatusText';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { authorizedFetch } from '../lib/api';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { formatCurrency, formatNumber, formatTimestamp } from '../lib/validation';
import type { OrderStatus, SmmOrder } from '../types';

const STATUS_FILTERS: Array<'all' | OrderStatus> = [
  'all',
  'pending',
  'processing',
  'in_progress',
  'completed',
  'cancelled',
  'failed',
];

export function OrdersPage() {
  const { orders } = useData();
  const { navigate } = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [queryText, setQueryText] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (!q) return true;
      return (
        order.id.toLowerCase().includes(q) ||
        order.providerOrderId.toLowerCase().includes(q) ||
        order.serviceName.toLowerCase().includes(q) ||
        order.targetLink.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, queryText]);

  const handleCheckStatus = async (order: SmmOrder) => {
    setBusyId(order.id);
    setActionMessage('');
    try {
      if (!order.providerOrderId) {
        setActionMessage(
          `Order ${order.id} is currently "${order.status}" in internal queue (awaiting provider synchronization).`
        );
        return;
      }
      const res = await authorizedFetch<{ ok?: boolean; message?: string; providerStatus?: string }>(
        '/api/provider/orders/status',
        {
          method: 'POST',
          body: JSON.stringify({ providerOrderId: order.providerOrderId }),
        }
      );
      setActionMessage(res.data.message || `Provider status: ${res.data.providerStatus || order.status}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestCancel = async (order: SmmOrder) => {
    setBusyId(order.id);
    setActionMessage('');
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        cancelRequested: true,
        updatedAt: serverTimestamp(),
      });
      if (order.providerOrderId) {
        const res = await authorizedFetch<{ message?: string }>('/api/provider/orders/cancel', {
          method: 'POST',
          body: JSON.stringify({ providerOrderId: order.providerOrderId }),
        });
        setActionMessage(res.data.message || `Cancellation requested for ${order.id}.`);
      } else {
        setActionMessage(`Cancellation request logged for order ${order.id}.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestRefill = async (order: SmmOrder) => {
    setBusyId(order.id);
    setActionMessage('');
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        refillRequested: true,
        refillStatus: 'requested',
        updatedAt: serverTimestamp(),
      });
      if (order.providerOrderId) {
        const res = await authorizedFetch<{ message?: string }>('/api/provider/orders/refill', {
          method: 'POST',
          body: JSON.stringify({ providerOrderId: order.providerOrderId }),
        });
        setActionMessage(res.data.message || `Refill requested for ${order.id}.`);
      } else {
        setActionMessage(`Refill request logged for order ${order.id}.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout title="Order History">
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#0B0C10] text-zinc-400 hover:text-white border border-white/[0.08]'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search order ID or link..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#0B0C10] border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        {actionMessage && (
          <div className="p-3.5 rounded-lg bg-[#0B0C10] border border-[#2563EB]/40 text-xs text-zinc-200">
            {actionMessage}
          </div>
        )}

        <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-white">No matching orders found</p>
              <button
                type="button"
                onClick={() => navigate('/new-order')}
                className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
              >
                Place New Order
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs font-medium text-zinc-400">
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Service & Target</th>
                    <th className="py-3.5 px-4 text-right">Qty</th>
                    <th className="py-3.5 px-4 text-right">Remains</th>
                    <th className="py-3.5 px-4 text-right">Charge</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filtered.map((order) => {
                    const canCancel =
                      order.supportsCancel &&
                      !order.cancelRequested &&
                      ['pending', 'processing', 'in_progress'].includes(order.status);
                    const canRefill =
                      order.supportsRefill &&
                      !order.refillRequested &&
                      order.status === 'completed';

                    return (
                      <tr key={order.id} className="hover:bg-white/[0.02]">
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <p className="font-mono text-xs text-white">{order.id}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            {order.providerOrderId ? `Provider #${order.providerOrderId}` : 'Local Queue'}
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">{formatTimestamp(order.createdAt)}</p>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                            <PlatformIcon platform={order.platform} className="w-3.5 h-3.5 shrink-0" />
                            <span>{order.serviceName}</span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 break-all max-w-xs">{order.targetLink}</p>
                        </td>
                        <td className="py-3.5 px-4 align-top text-right font-mono text-xs tabular-nums text-zinc-200">
                          {formatNumber(order.quantity)}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right font-mono text-xs tabular-nums text-zinc-400">
                          {formatNumber(order.remains)}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right font-mono text-xs tabular-nums text-white">
                          {formatCurrency(order.charge)}
                        </td>
                        <td className="py-3.5 px-4 align-top space-y-1">
                          <StatusText status={order.status} />
                          {order.cancelRequested && (
                            <p className="text-[11px] text-amber-400">Cancel requested</p>
                          )}
                          {order.refillRequested && (
                            <p className="text-[11px] text-[#60A5FA]">
                              Refill: {order.refillStatus || 'requested'}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === order.id}
                              onClick={() => handleCheckStatus(order)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white border border-white/10 rounded-md"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Sync</span>
                            </button>
                            {canCancel && (
                              <button
                                type="button"
                                disabled={busyId === order.id}
                                onClick={() => handleRequestCancel(order)}
                                className="px-2.5 py-1.5 text-xs text-rose-300 hover:text-white border border-rose-500/30 hover:bg-rose-500/20 rounded-md"
                              >
                                Cancel
                              </button>
                            )}
                            {canRefill && (
                              <button
                                type="button"
                                disabled={busyId === order.id}
                                onClick={() => handleRequestRefill(order)}
                                className="px-2.5 py-1.5 text-xs text-[#60A5FA] hover:text-white border border-[#2563EB]/40 hover:bg-[#2563EB]/20 rounded-md"
                              >
                                Refill
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
