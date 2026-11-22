import React from 'react';
import { Bell, Check, PlusCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { DashboardLayout } from '../components/DashboardLayout';
import { ALL_PLATFORMS, PLATFORM_LABELS, PlatformIcon } from '../components/PlatformIcon';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { formatCurrency, formatNumber, formatTimestamp } from '../lib/validation';

export function DashboardPage() {
  const { wallet } = useAuth();
  const { orders, transactions, notifications, services } = useData();
  const { navigate } = useRouter();

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;
  const pendingOrders = orders.filter((o) =>
    ['pending', 'processing', 'in_progress'].includes(o.status)
  ).length;
  const cancelledOrders = orders.filter((o) =>
    ['cancelled', 'refunded', 'failed'].includes(o.status)
  ).length;

  const markRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  return (
    <DashboardLayout title="Dashboard">
      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Account Balance</p>
          <p className="text-2xl font-display font-bold text-white tabular-nums mt-2">
            {formatCurrency(wallet?.balance ?? 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            Total spent {formatCurrency(wallet?.totalSpent ?? 0)}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Total Orders</p>
          <p className="text-2xl font-display font-bold text-white tabular-nums mt-2">
            {formatNumber(totalOrders)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">All submitted campaigns</p>
        </div>

        <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Completed Orders</p>
          <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums mt-2">
            {formatNumber(completedOrders)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Delivered in full</p>
        </div>

        <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Pending Orders</p>
          <p className="text-2xl font-display font-bold text-amber-400 tabular-nums mt-2">
            {formatNumber(pendingOrders)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Queued or in progress</p>
        </div>

        <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08]">
          <p className="text-xs text-zinc-400">Cancelled Orders</p>
          <p className="text-2xl font-display font-bold text-rose-400 tabular-nums mt-2">
            {formatNumber(cancelledOrders)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Cancelled, refunded, or failed</p>
        </div>
      </div>

      {/* Quick Access to Services */}
      <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Quick Access to Services</h2>
            <p className="text-xs text-zinc-400">
              {services.filter((s) => s.status === 'active').length} active services across seven networks
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/new-order')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Place Order</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {ALL_PLATFORMS.map((platform) => {
            const count = services.filter((s) => s.platform === platform && s.status === 'active').length;
            return (
              <button
                key={platform}
                type="button"
                onClick={() => navigate(`/services?platform=${encodeURIComponent(platform)}`)}
                className="p-3 rounded-lg bg-[#050507] border border-white/[0.08] hover:border-[#2563EB]/50 transition-colors text-left space-y-1.5"
              >
                <div className="flex items-center justify-between text-white">
                  <PlatformIcon platform={platform} className="w-4 h-4" />
                  <span className="text-[11px] font-mono tabular-nums text-zinc-500">{count}</span>
                </div>
                <p className="text-xs font-medium text-zinc-200 truncate">{PLATFORM_LABELS[platform]}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Recent Orders + Notifications & Recent Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent Orders</h2>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="text-xs font-medium text-[#60A5FA] hover:underline"
            >
              View All
            </button>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm font-medium text-white">No orders placed yet</p>
              <p className="text-xs text-zinc-400">
                Fund your wallet and submit your first campaign to track delivery here.
              </p>
              <button
                type="button"
                onClick={() => navigate('/new-order')}
                className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
              >
                Create First Order
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-zinc-400">
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4 text-right">Charge</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {orders.slice(0, 6).map((order) => (
                    <tr key={order.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono text-xs text-zinc-400 whitespace-nowrap">
                        {order.id.slice(0, 12)}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-white truncate max-w-[200px]">
                          {order.serviceName}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                          {order.targetLink}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-zinc-300">
                        {formatNumber(order.quantity)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-white">
                        {formatCurrency(order.charge)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="xl:col-span-5 space-y-6">
          {/* Notifications */}
          <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-base font-semibold text-white">
                <Bell className="w-4 h-4 text-[#3B82F6]" />
                <span>Notifications</span>
              </span>
              <span className="text-xs text-zinc-500 tabular-nums">
                {notifications.filter((n) => !n.read).length} unread
              </span>
            </div>
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">No notifications yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.06] max-h-64 overflow-y-auto">
                {notifications.slice(0, 6).map((n) => (
                  <div key={n.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className={`text-xs font-medium ${n.read ? 'text-zinc-400' : 'text-white'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-zinc-500 leading-relaxed">{n.message}</p>
                      <p className="text-[11px] text-zinc-600">{formatTimestamp(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        title="Mark as read"
                        className="p-1.5 text-zinc-400 hover:text-white border border-white/10 rounded-md shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Recent Transactions</h2>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="text-xs font-medium text-[#60A5FA] hover:underline"
              >
                Ledger
              </button>
            </div>
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No wallet transactions recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{tx.description}</p>
                      <p className="text-[11px] text-zinc-500">{formatTimestamp(tx.createdAt)}</p>
                    </div>
                    <span
                      className={`text-xs font-mono font-medium tabular-nums shrink-0 ${
                        tx.amount >= 0 ? 'text-emerald-400' : 'text-zinc-200'
                      }`}
                    >
                      {tx.amount >= 0 ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
