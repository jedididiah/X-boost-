import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CreditCard,
  HeadphonesIcon,
  Layers,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  PlusCircle,
  ShieldCheck,
  UserCog,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useRouter } from '../context/RouterContext';
import { formatCurrency } from '../lib/validation';
import { BrandLogo } from './BrandLogo';

interface DashboardLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function DashboardLayout({ title, children }: DashboardLayoutProps) {
  const { navigate, pathname } = useRouter();
  const {
    firebaseUser,
    profile,
    wallet,
    isAdmin,
    emailVerified,
    logout,
    resendVerificationEmail,
    refreshVerificationState,
  } = useAuth();
  const { announcements, notifications } = useData();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeAnnouncements = announcements.filter((a) => a.active);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'New Order', path: '/new-order', icon: PlusCircle },
    { label: 'Order History', path: '/orders', icon: ListOrdered },
    { label: 'Wallet', path: '/wallet', icon: Wallet },
    { label: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
    { label: 'Services', path: '/services', icon: Layers },
    { label: 'Profile', path: '/profile', icon: UserCog },
    { label: 'Support', path: '/support', icon: HeadphonesIcon },
  ];

  const handleNav = (path: string) => {
    setSidebarOpen(false);
    navigate(path);
  };

  const handleResendVerification = async () => {
    setVerifyBusy(true);
    setVerifyMsg(null);
    try {
      await resendVerificationEmail();
      setVerifyMsg('Verification email sent. Check your inbox and spam folder.');
    } catch (err) {
      setVerifyMsg(err instanceof Error ? err.message : 'Unable to send verification email.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setVerifyBusy(true);
    setVerifyMsg(null);
    try {
      const verified = await refreshVerificationState();
      setVerifyMsg(
        verified
          ? 'Email verified. Full wallet and order permissions are now active.'
          : 'Email is not marked verified yet. Click the link in your inbox, then refresh again.'
      );
    } catch (err) {
      setVerifyMsg(err instanceof Error ? err.message : 'Unable to refresh verification status.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#08090C] border-r border-white/[0.08]">
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/[0.08]">
        <button
          type="button"
          onClick={() => handleNav('/')}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-lg"
        >
          <BrandLogo size="sm" />
        </button>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-1.5 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b border-white/[0.06]">
        <p className="text-xs text-zinc-500">Available Balance</p>
        <p className="text-xl font-display font-semibold text-white tabular-nums mt-0.5">
          {formatCurrency(wallet?.balance ?? 0)}
        </p>
        <button
          type="button"
          onClick={() => handleNav('/wallet')}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Add Funds</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#2563EB]/15 text-white border border-[#2563EB]/40'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <span className="inline-flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#3B82F6]' : ''}`} />
                <span>{item.label}</span>
              </span>
              {item.path === '/dashboard' && unreadCount > 0 && (
                <span className="text-xs font-mono tabular-nums text-[#60A5FA]">{unreadCount}</span>
              )}
            </button>
          );
        })}

        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={() => handleNav('/admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                pathname === '/admin'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-zinc-200 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Admin Dashboard</span>
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-white/[0.08] space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {profile?.displayName || firebaseUser?.displayName || 'Account'}
          </p>
          <p className="text-xs text-zinc-400 truncate">{firebaseUser?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white border border-white/10 hover:bg-white/[0.04] rounded-lg transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F6] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-64 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Workspace Main Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-[#050507]/90 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 text-zinc-300 hover:text-white border border-white/10 rounded-lg shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-zinc-500 hidden sm:inline whitespace-nowrap">𝕏 Boost</span>
              <span className="text-zinc-600 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-white truncate">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-[11px] text-zinc-500 leading-none">Balance</p>
              <p className="text-sm font-mono font-medium text-white tabular-nums mt-1">
                {formatCurrency(wallet?.balance ?? 0)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleNav('/new-order')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Order</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Email verification notice */}
          {firebaseUser && !emailVerified && (
            <div className="bg-[#0B0C10] border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">Verify your email address to activate orders and wallet funding</p>
                  <p className="text-xs text-zinc-400">
                    A verification link was sent to {firebaseUser.email}. Once confirmed, refresh your status below.
                  </p>
                  {verifyMsg && <p className="text-xs text-[#60A5FA]">{verifyMsg}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={verifyBusy}
                  onClick={handleResendVerification}
                  className="px-3 py-2 text-xs font-medium text-zinc-200 border border-white/15 hover:bg-white/[0.05] rounded-lg whitespace-nowrap disabled:opacity-50"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  disabled={verifyBusy}
                  onClick={handleRefreshVerification}
                  className="px-3 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg whitespace-nowrap disabled:opacity-50"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          )}

          {/* Active Admin Announcements */}
          {activeAnnouncements.length > 0 && (
            <div className="space-y-2">
              {activeAnnouncements.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#0B0C10] border border-white/10 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-white">
                      <span className="text-[#3B82F6] mr-2">Announcement ·</span>
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-400">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
