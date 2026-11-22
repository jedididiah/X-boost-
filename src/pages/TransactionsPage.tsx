import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { StatusText } from '../components/StatusText';
import { useData } from '../context/DataContext';
import { formatCurrency, formatTimestamp } from '../lib/validation';
import type { TransactionType } from '../types';

export function TransactionsPage() {
  const { transactions } = useData();
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!q) return true;
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q)
      );
    });
  }, [transactions, typeFilter, searchQuery]);

  return (
    <DashboardLayout title="Transaction History">
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'deposit', 'order_debit', 'refund', 'admin_adjustment'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                  typeFilter === t
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#0B0C10] text-zinc-400 hover:text-white border border-white/[0.08]'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference or description..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#0B0C10] border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-400">
              No transactions match your current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs font-medium text-zinc-400">
                    <th className="py-3.5 px-4">Reference</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                    <th className="py-3.5 px-4 text-right">Balance After</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02]">
                      <td className="py-3.5 px-4 font-mono text-xs text-zinc-300 whitespace-nowrap">
                        {tx.reference}
                      </td>
                      <td className="py-3.5 px-4 text-xs capitalize text-zinc-400 whitespace-nowrap">
                        {tx.type.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-white max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                          tx.amount >= 0 ? 'text-emerald-400' : 'text-zinc-200'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-zinc-400 whitespace-nowrap">
                        {formatCurrency(tx.balanceAfter)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusText status={tx.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-500 whitespace-nowrap">
                        {formatTimestamp(tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
