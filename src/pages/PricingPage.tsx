import React, { useMemo, useState } from 'react';
import { PlatformIcon, PLATFORM_LABELS } from '../components/PlatformIcon';
import { PublicLayout } from '../components/PublicLayout';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { calculateOrderCharge, formatCurrency, formatNumber } from '../lib/validation';

export function PricingPage() {
  const { services } = useData();
  const { firebaseUser } = useAuth();
  const { navigate } = useRouter();

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1000);

  const activeService = useMemo(() => {
    if (!services.length) return null;
    return services.find((s) => s.id === selectedServiceId) || services[0];
  }, [services, selectedServiceId]);

  const estimatedCharge = activeService
    ? calculateOrderCharge(activeService.ratePer1000, Math.max(0, quantity))
    : 0;

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="space-y-3 max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Transparent Per-1,000 Pricing
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Pay strictly for the exact quantity ordered with no monthly subscriptions or hidden platform fees.
          </p>
        </div>

        {/* Live Cost Estimator */}
        {activeService && (
          <div className="p-6 rounded-xl bg-[#0B0C10] border border-white/[0.08] grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-5 space-y-2">
              <label className="block text-xs font-medium text-zinc-400">Select Service</label>
              <select
                value={activeService.id}
                onChange={(e) => {
                  const srv = services.find((s) => s.id === e.target.value);
                  setSelectedServiceId(e.target.value);
                  if (srv) setQuantity(srv.minQuantity);
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {PLATFORM_LABELS[s.platform]} — {s.name} ({formatCurrency(s.ratePer1000)}/1k)
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3 space-y-2">
              <label className="block text-xs font-medium text-zinc-400">
                Quantity ({formatNumber(activeService.minQuantity)}–{formatNumber(activeService.maxQuantity)})
              </label>
              <input
                type="number"
                min={activeService.minQuantity}
                max={activeService.maxQuantity}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="lg:col-span-2">
              <p className="text-xs text-zinc-500">Calculated Price</p>
              <p className="text-2xl font-mono font-semibold text-white tabular-nums mt-1">
                {formatCurrency(estimatedCharge)}
              </p>
            </div>

            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    firebaseUser
                      ? `/new-order?service=${encodeURIComponent(activeService.id)}`
                      : '/register'
                  )
                }
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap"
              >
                {firebaseUser ? 'Order Now' : 'Get Started'}
              </button>
            </div>
          </div>
        )}

        {/* Pricing Table */}
        <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs font-medium text-zinc-400">
                  <th className="py-3.5 px-5">Platform</th>
                  <th className="py-3.5 px-5">Service</th>
                  <th className="py-3.5 px-5 text-right">Min</th>
                  <th className="py-3.5 px-5 text-right">Max</th>
                  <th className="py-3.5 px-5">Est. Time</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Rate / 1K</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-sm">
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-5 text-center text-zinc-400">
                      No live services published yet. Visit the Admin Dashboard to publish your catalog.
                    </td>
                  </tr>
                ) : (
                  services.map((srv) => (
                    <tr key={srv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 text-zinc-200 font-medium">
                          <PlatformIcon platform={srv.platform} className="w-4 h-4" />
                          <span>{PLATFORM_LABELS[srv.platform]}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-medium text-white">{srv.name}</p>
                        <p className="text-xs text-zinc-500">{srv.category}</p>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono tabular-nums text-zinc-300">
                        {formatNumber(srv.minQuantity)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono tabular-nums text-zinc-300">
                        {formatNumber(srv.maxQuantity)}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-300 whitespace-nowrap">{srv.estimatedTime}</td>
                      <td className="py-3.5 px-5">
                        <StatusText status={srv.status} />
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-white tabular-nums">
                        {formatCurrency(srv.ratePer1000)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
