import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';

function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method). You can sign in immediately with Google below, or enable Email/Password in Firebase Console.';
  }
  if (msg.includes('auth/email-already-in-use')) return 'An account with this email already exists.';
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'Invalid email or password.';
  }
  if (msg.includes('auth/user-not-found')) return 'No account found with this email address.';
  if (msg.includes('auth/weak-password')) return 'Password must be at least 6 characters long.';
  if (msg.includes('auth/too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
  if (msg.includes('auth/popup-closed-by-user')) return 'Sign-in popup was closed before completing.';
  return msg;
}

export function LoginPage() {
  const { loginWithEmail, loginWithGoogle, firebaseUser } = useAuth();
  const { navigate, search } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const redirectTo = new URLSearchParams(search).get('redirect') || '/dashboard';

  useEffect(() => {
    if (firebaseUser) {
      navigate(redirectTo);
    }
  }, [firebaseUser, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginWithEmail(email, password);
      navigate(redirectTo);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle();
      navigate(redirectTo);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F6] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <button type="button" onClick={() => navigate('/')}>
            <BrandLogo size="lg" />
          </button>
        </div>

        <div className="bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-white">Sign in to 𝕏 Boost</h1>
            <p className="text-sm text-zinc-400">Access your wallet, active orders, and services.</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-medium text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 rounded-lg transition-colors disabled:opacity-50"
          >
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-white/[0.08]" />
            <span className="px-3 bg-[#0B0C10] text-xs text-zinc-500">or</span>
            <div className="w-full border-t border-white/[0.08]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-300">Password</label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs text-[#60A5FA] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors disabled:opacity-50"
            >
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-center text-zinc-400">
            Need an account?{' '}
            <button type="button" onClick={() => navigate('/register')} className="text-[#60A5FA] hover:underline font-medium">
              Create account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { registerWithEmail, loginWithGoogle, firebaseUser } = useAuth();
  const { navigate } = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (firebaseUser) {
      navigate('/dashboard');
    }
  }, [firebaseUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (displayName.trim().length < 2) {
      setError('Please enter your name or brand handle.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await registerWithEmail(displayName, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F6] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <button type="button" onClick={() => navigate('/')}>
            <BrandLogo size="lg" />
          </button>
        </div>

        <div className="bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-white">Create your account</h1>
            <p className="text-sm text-zinc-400">Start managing social campaigns across seven platforms.</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-medium text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 rounded-lg transition-colors disabled:opacity-50"
          >
            <span>Sign up with Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-white/[0.08]" />
            <span className="px-3 bg-[#0B0C10] text-xs text-zinc-500">or</span>
            <div className="w-full border-t border-white/[0.08]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Full Name</label>
              <input
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Confirm Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors disabled:opacity-50"
            >
              {busy ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-xs text-center text-zinc-400">
            Already registered?{' '}
            <button type="button" onClick={() => navigate('/login')} className="text-[#60A5FA] hover:underline font-medium">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const { sendResetEmail } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await sendResetEmail(email);
      setSent(true);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F6] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <button type="button" onClick={() => navigate('/')}>
            <BrandLogo size="lg" />
          </button>
        </div>

        <div className="bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-white">Reset your password</h1>
            <p className="text-sm text-zinc-400">
              Enter your registered email address to receive a password reset link.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          {sent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-200">
                  If an account matches {email}, a password reset link has been sent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg disabled:opacity-50"
              >
                {busy ? 'Sending link...' : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2 text-xs text-zinc-400 hover:text-white"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const { confirmResetCode, applyEmailVerificationCode } = useAuth();
  const { navigate, search } = useRouter();
  const params = new URLSearchParams(search);
  const mode = params.get('mode') || 'resetPassword';
  const oobCode = params.get('oobCode') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === 'verifyEmail' && oobCode) {
      setBusy(true);
      applyEmailVerificationCode(oobCode)
        .then(() => setStatusMessage('Your email address has been verified.'))
        .catch((err) => setError(mapAuthError(err)))
        .finally(() => setBusy(false));
    }
  }, [mode, oobCode, applyEmailVerificationCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!oobCode) {
      setError('Missing password reset verification code. Request a new link from Forgot Password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await confirmResetCode(oobCode, newPassword);
      setStatusMessage('Password updated successfully. You can now sign in with your new password.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F6] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <button type="button" onClick={() => navigate('/')}>
            <BrandLogo size="lg" />
          </button>
        </div>

        <div className="bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 sm:p-8 space-y-6">
          <h1 className="font-display text-2xl font-bold text-white">
            {mode === 'verifyEmail' ? 'Email Verification' : 'Set New Password'}
          </h1>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          {statusMessage ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-200">
                {statusMessage}
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg"
              >
                Continue to Sign In
              </button>
            </div>
          ) : mode === 'verifyEmail' ? (
            <p className="text-sm text-zinc-400">{busy ? 'Verifying email code...' : 'Open the verification link from your email.'}</p>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg disabled:opacity-50"
              >
                {busy ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
