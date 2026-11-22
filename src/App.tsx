/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { NewOrderPage } from './pages/NewOrderPage';
import { OrdersPage } from './pages/OrdersPage';
import { PricingPage } from './pages/PricingPage';
import { ProfilePage } from './pages/ProfilePage';
import { ServicesPage } from './pages/ServicesPage';
import { SupportPage } from './pages/SupportPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { WalletPage } from './pages/WalletPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, authReady } = useAuth();
  const { navigate, pathname, search } = useRouter();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#050507] text-zinc-400 flex items-center justify-center text-sm">
        Loading workspace...
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-[#050507] text-[#F4F4F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0B0C10] border border-white/[0.08] rounded-xl p-8 text-center space-y-4">
          <h1 className="font-display text-xl font-bold text-white">Sign in required</h1>
          <p className="text-sm text-zinc-400">
            Sign in to access your 𝕏 Boost wallet, orders, and dashboard.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(pathname + search)}`)}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { pathname } = useRouter();

  switch (pathname) {
    case '/':
      return <HomePage />;
    case '/services':
      return <ServicesPage />;
    case '/pricing':
      return <PricingPage />;
    case '/login':
      return <LoginPage />;
    case '/register':
      return <RegisterPage />;
    case '/forgot-password':
      return <ForgotPasswordPage />;
    case '/reset-password':
      return <ResetPasswordPage />;
    case '/support':
      return <SupportPage />;
    case '/dashboard':
      return (
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      );
    case '/new-order':
      return (
        <ProtectedRoute>
          <NewOrderPage />
        </ProtectedRoute>
      );
    case '/orders':
      return (
        <ProtectedRoute>
          <OrdersPage />
        </ProtectedRoute>
      );
    case '/wallet':
      return (
        <ProtectedRoute>
          <WalletPage />
        </ProtectedRoute>
      );
    case '/transactions':
      return (
        <ProtectedRoute>
          <TransactionsPage />
        </ProtectedRoute>
      );
    case '/profile':
      return (
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      );
    case '/admin':
      return (
        <ProtectedRoute>
          <AdminDashboardPage />
        </ProtectedRoute>
      );
    default:
      return <HomePage />;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <AuthProvider>
          <DataProvider>
            <AppRoutes />
          </DataProvider>
        </AuthProvider>
      </RouterProvider>
    </ErrorBoundary>
  );
}
