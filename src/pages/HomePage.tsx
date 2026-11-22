import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ChevronDown, ShieldCheck, Sliders, Wallet, Zap } from 'lucide-react';
import { ALL_PLATFORMS, PLATFORM_LABELS, PlatformIcon } from '../components/PlatformIcon';
import { PublicLayout } from '../components/PublicLayout';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { STARTER_CATALOG } from '../lib/seedCatalog';
import { formatCurrency, formatNumber } from '../lib/validation';

const FAQ_ITEMS = [
  {
    q: 'How quickly do orders start after submission?',
    a: 'Start times depend on the selected service tier and platform queue. Each service card lists an explicit estimated delivery window before you place an order, ranging from minutes for instant views to gradual daily pacing for high-retention followers.',
  },
  {
    q: 'How does wallet funding and payment verification work?',
    a: 'Wallet deposits are initialized and verified exclusively through server-side Flutterwave payment endpoints supporting cards, bank transfers, and mobile money. Funds are never credited from the browser without trusted verification.',
  },
  {
    q: 'What happens if an order drops or needs cancellation?',
    a: 'Services marked with Refill or Cancel support expose direct action buttons inside your Order History. When a provider accepts a cancellation, any remaining unfulfilled portion is refunded to your wallet ledger.',
  },
  {
    q: 'Is my social media account password required?',
    a: 'No. 𝕏 Boost only requires the public profile handle, channel link, or post URL where engagement should be delivered. Never share account passwords.',
  },
  {
    q: 'How does provider synchronization with Delex Gains work?',
    a: 'All provider API credentials and routing endpoints remain strictly on our backend server. Once connected and mapped in the Admin Dashboard, internal order IDs synchronize automatically with provider order IDs.',
  },
];

export function HomePage() {
  const { navigate } = useRouter();
  const { firebaseUser } = useAuth();
  const { services } = useData();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [studioImgFailed, setStudioImgFailed] = useState(false);
  const [networkImgFailed, setNetworkImgFailed] = useState(false);

  const popularLive = services.filter((s) => s.popular && s.status === 'active').slice(0, 6);
  const popularItems = popularLive.length > 0 ? popularLive : STARTER_CATALOG.filter((s) => s.popular).slice(0, 6);
  const isCatalogPreview = popularLive.length === 0;

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 flex flex-col justify-center space-y-6"
          >
            <p className="text-sm font-medium text-[#60A5FA] tracking-wide">
              Multi-Platform Social Growth Infrastructure
            </p>
            <h1
              className="font-display font-bold tracking-tight text-white text-balance leading-[1.08]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)' }}
            >
              Grow Your Social Media Presence with 𝕏 Boost.
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 max-w-xl leading-relaxed">
              Purchase verified-rate followers, likes, views, comments, and channel engagement across seven major networks through one transparent wallet and order ledger.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => navigate(firebaseUser ? '/dashboard' : '/register')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/services')}
                className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-zinc-200 border border-white/15 hover:bg-white/[0.05] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Explore Services
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <div className="relative h-full min-h-[280px] lg:min-h-[380px] rounded-xl overflow-hidden border border-white/10 bg-[#0B0C10]">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_xboost_visual_1795361105663.jpg"
                  alt="Obsidian geometric monoliths with electric blue edge lighting representing multi-platform social growth"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0B0C10] via-[#0F172A] to-[#050507] p-8">
                  <span className="font-display text-3xl font-bold text-white">𝕏 Boost</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050507]/85 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-300">
                <span>7 Supported Networks</span>
                <span aria-hidden="true">·</span>
                <span>Real-Time Order Tracking</span>
                <span aria-hidden="true">·</span>
                <span>Server-Verified Ledger</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Social Media Platforms Strip */}
        <div className="mt-14 pt-10 border-t border-white/[0.08]">
          <p className="text-xs font-medium text-zinc-500 mb-6">Supported Social Platforms</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {ALL_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => navigate(`/services?platform=${encodeURIComponent(platform)}`)}
                className="flex items-center gap-3 px-4 py-3.5 bg-[#0B0C10] hover:bg-[#111318] border border-white/[0.08] hover:border-[#2563EB]/50 rounded-xl transition-colors text-left"
              >
                <span className="text-white shrink-0">
                  <PlatformIcon platform={platform} className="w-5 h-5" />
                </span>
                <span className="text-sm font-medium text-zinc-200 truncate">
                  {PLATFORM_LABELS[platform]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="border-t border-white/[0.08] bg-[#08090C] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-5">
              <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-white/10 bg-[#0B0C10]">
                {!studioImgFailed ? (
                  <img
                    src="/src/assets/images/creator_studio_workspace_1795361107296.jpg"
                    alt="Digital creator studio desk with dark anodized aluminum display"
                    referrerPolicy="no-referrer"
                    onError={() => setStudioImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#0B0C10] p-8 text-zinc-500 text-sm">
                    Creator Studio Infrastructure
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-center space-y-8">
              <div className="space-y-3">
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-white text-balance">
                  Why Choose 𝕏 Boost
                </h2>
                <p className="text-zinc-400 max-w-2xl leading-relaxed">
                  Built with strict backend controls, transparent unit economics, and real-time order synchronization rather than opaque reseller templates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-2">
                  <Wallet className="w-5 h-5 text-[#3B82F6]" />
                  <h3 className="text-base font-semibold text-white">Protected Wallet Ledger</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Every deposit requires server-side payment verification, and order deductions execute atomically against your verified balance.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-2">
                  <Zap className="w-5 h-5 text-[#3B82F6]" />
                  <h3 className="text-base font-semibold text-white">Calculated Upfront Pricing</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Inspect per-1,000 rates, minimum/maximum quantity bounds, and exact order charges before submitting any campaign.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-2">
                  <Sliders className="w-5 h-5 text-[#3B82F6]" />
                  <h3 className="text-base font-semibold text-white">Refill & Cancel Controls</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Services with provider refill or cancellation support provide one-click status checks and direct request tracking.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-2">
                  <ShieldCheck className="w-5 h-5 text-[#3B82F6]" />
                  <h3 className="text-base font-semibold text-white">No Account Passwords</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Supply only the public username or post link. Your social media credentials never leave your possession.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-white/[0.08] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7 space-y-3">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white text-balance">
                How It Works
              </h2>
              <p className="text-zinc-400 max-w-xl">
                Four structured steps from verified account onboarding to live delivery tracking.
              </p>
            </div>
            <div className="lg:col-span-5">
              <div className="h-36 rounded-xl overflow-hidden border border-white/10 bg-[#0B0C10]">
                {!networkImgFailed ? (
                  <img
                    src="/src/assets/images/delivery_network_core_1795361106740.jpg"
                    alt="Black anodized optical routing hardware representing automated order delivery"
                    referrerPolicy="no-referrer"
                    onError={() => setNetworkImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#0B0C10]" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01. Create & Verify Account',
                desc: 'Register with email and password or Google sign-in, then confirm your email address to activate wallet and order access.',
              },
              {
                step: '02. Fund Your Wallet',
                desc: 'Deposit funds securely using Flutterwave checkout verified strictly on the server.',
              },
              {
                step: '03. Configure Your Order',
                desc: 'Select a social platform, choose a service, enter your target profile or post link, and preview the exact charge.',
              },
              {
                step: '04. Track & Manage',
                desc: 'Monitor order status, provider synchronization, start counts, and submit refill or cancellation requests when eligible.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-6 rounded-xl bg-[#0B0C10] border border-white/[0.08] space-y-3"
              >
                <h3 className="text-base font-semibold text-white">{item.step}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Services */}
      <section className="border-t border-white/[0.08] bg-[#08090C] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                Popular Services
              </h2>
              <p className="text-sm text-zinc-400">
                {isCatalogPreview
                  ? 'Reference rate schedule across core platforms. Publish services in Admin Dashboard to enable checkout.'
                  : 'Active high-demand services currently available for immediate order placement.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/services')}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#60A5FA] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>View Full Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {popularItems.map((service) => (
              <div
                key={service.id}
                className="p-6 rounded-xl bg-[#0B0C10] border border-white/[0.08] flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-2 text-zinc-200 font-medium">
                      <PlatformIcon platform={service.platform} className="w-4 h-4" />
                      <span>{PLATFORM_LABELS[service.platform]}</span>
                    </span>
                    <StatusText status={service.status} />
                  </div>
                  <h3 className="text-base font-semibold text-white leading-snug">
                    {service.name}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">
                    {service.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      Min {formatNumber(service.minQuantity)} · Max {formatNumber(service.maxQuantity)}
                    </span>
                    <span>{service.estimatedTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500">Per 1,000</p>
                      <p className="text-lg font-mono font-semibold text-white tabular-nums">
                        {formatCurrency(service.ratePer1000)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          firebaseUser
                            ? `/new-order?service=${encodeURIComponent(service.id)}`
                            : '/register'
                        )
                      }
                      className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      {firebaseUser ? 'Order Service' : 'Get Started'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section id="faq" className="border-t border-white/[0.08] py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="space-y-2">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-zinc-400">
              Operational details on account verification, deposits, delivery pacing, and refills.
            </p>
          </div>

          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <span className="text-base font-medium text-white">{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm text-zinc-400 leading-relaxed pr-6">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
