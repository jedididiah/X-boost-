import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ALL_PLATFORMS, PLATFORM_LABELS, PlatformIcon } from '../components/PlatformIcon';
import { PublicLayout } from '../components/PublicLayout';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { formatCurrency, formatNumber } from '../lib/validation';
import type { SocialPlatform } from '../types';

export function ServicesPage() {
  const { firebaseUser } = useAuth();
  const { services, servicesLoading } = useData();
  const { navigate, search } = useRouter();

  const initialPlatform = useMemo(() => {
    const params = new URLSearchParams(search);
    const p = params.get('platform');
    return ALL_PLATFORMS.includes(p as SocialPlatform) ? (p as SocialPlatform) : 'All';
  }, [search]);

  const [selectedPlatform, setSelectedPlatform] = useState<'All' | SocialPlatform>(initialPlatform);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter((s) => {
      if (selectedPlatform !== 'All' && s.platform !== selectedPlatform) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q)
      );
    });
  }, [services, selectedPlatform, searchQuery]);

  const content = (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Services Directory
          </h2>
          <p className="text-sm text-zinc-400">
            Browse live social media engagement packages with transparent minimums, maximums, and delivery estimates.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#0B0C10] border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#2563EB]"
          />
        </div>
      </div>

      {/* Interactive Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-white/[0.08]">
        <button
          type="button"
          onClick={() => setSelectedPlatform('All')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            selectedPlatform === 'All'
              ? 'bg-[#2563EB] text-white'
              : 'bg-[#0B0C10] text-zinc-400 hover:text-white border border-white/[0.08]'
          }`}
        >
          All Platforms
        </button>
        {ALL_PLATFORMS.map((platform) => (
          <button
            key={platform}
            type="button"
            onClick={() => setSelectedPlatform(platform)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedPlatform === platform
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#0B0C10] text-zinc-400 hover:text-white border border-white/[0.08]'
            }`}
          >
            <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
            <span>{PLATFORM_LABELS[platform]}</span>
          </button>
        ))}
      </div>

      {servicesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-56 rounded-xl bg-[#0B0C10] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-[#0B0C10] border border-white/[0.08] p-10 text-center space-y-3">
          <p className="text-base font-medium text-white">No services match your current filter</p>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            {services.length === 0
              ? 'No services have been published to the catalog yet. Administrators can publish or sync services from the Admin Dashboard.'
              : 'Try selecting a different platform or clearing your search query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((service) => (
            <div
              key={service.id}
              className="p-6 rounded-xl bg-[#0B0C10] border border-white/[0.08] flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-2 text-zinc-200 font-medium">
                    <PlatformIcon platform={service.platform} className="w-4 h-4" />
                    <span>{PLATFORM_LABELS[service.platform]}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400">{service.category}</span>
                  </span>
                  <StatusText status={service.status} />
                </div>
                <h3 className="text-base font-semibold text-white">{service.name}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{service.description}</p>
              </div>

              <div className="pt-4 border-t border-white/[0.06] space-y-4">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Min / Max</p>
                    <p className="text-zinc-200 font-mono tabular-nums mt-0.5">
                      {formatNumber(service.minQuantity)}–{formatNumber(service.maxQuantity)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Est. Time</p>
                    <p className="text-zinc-200 mt-0.5 truncate">{service.estimatedTime}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Protection</p>
                    <p className="text-zinc-200 mt-0.5">
                      {service.supportsRefill ? 'Refill' : service.supportsCancel ? 'Cancel' : 'Standard'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">Rate per 1,000</p>
                    <p className="text-lg font-mono font-semibold text-white tabular-nums">
                      {formatCurrency(service.ratePer1000)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={service.status !== 'active'}
                    onClick={() =>
                      navigate(
                        firebaseUser
                          ? `/new-order?service=${encodeURIComponent(service.id)}`
                          : `/login?redirect=${encodeURIComponent(`/new-order?service=${service.id}`)}`
                      )
                    }
                    className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {service.status === 'active' ? 'Order Now' : 'Unavailable'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (firebaseUser) {
    return <DashboardLayout title="Services">{content}</DashboardLayout>;
  }

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">{content}</div>
    </PublicLayout>
  );
}
