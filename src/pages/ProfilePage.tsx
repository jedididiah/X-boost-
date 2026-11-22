import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { StatusText } from '../components/StatusText';
import { useAuth } from '../context/AuthContext';
import { VALIDATION_LIMITS } from '../lib/validation';

export function ProfilePage() {
  const {
    firebaseUser,
    profile,
    emailVerified,
    isAdmin,
    updateDisplayName,
    changeAccountPassword,
    resendVerificationEmail,
    refreshVerificationState,
  } = useAuth();

  const [displayName, setDisplayName] = useState(
    profile?.displayName || firebaseUser?.displayName || ''
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const hasPasswordProvider = Boolean(
    firebaseUser?.providerData.some((p) => p.providerId === 'password')
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setProfileMsg('');
    if (displayName.trim().length < VALIDATION_LIMITS.displayNameMin) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }
    setBusy(true);
    try {
      await updateDisplayName(displayName);
      setProfileMsg('Profile display name updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPasswordMsg('');
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await changeAccountPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMsg('Account password updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout title="Profile Settings">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Account Profile</h2>
            <StatusText status={profile?.status || 'active'} />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}
          {profileMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">Display Name</label>
              <input
                type="text"
                required
                maxLength={VALIDATION_LIMITS.displayNameMax}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">Email Address</label>
              <input
                type="email"
                disabled
                value={firebaseUser?.email || ''}
                className="w-full px-3.5 py-2.5 text-sm bg-[#050507]/60 border border-white/10 rounded-lg text-zinc-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
              <div>
                <p className="text-zinc-500">Role</p>
                <p className="text-white font-medium mt-0.5">{isAdmin ? 'Administrator' : 'Member'}</p>
              </div>
              <div>
                <p className="text-zinc-500">Email Verification</p>
                <p className={`font-medium mt-0.5 ${emailVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {emailVerified ? 'Verified' : 'Pending Verification'}
                </p>
              </div>
            </div>

            {!emailVerified && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void resendVerificationEmail()}
                  className="px-3 py-1.5 text-xs text-zinc-200 border border-white/15 rounded-lg hover:bg-white/[0.05]"
                >
                  Resend Verification Email
                </button>
                <button
                  type="button"
                  onClick={() => void refreshVerificationState()}
                  className="px-3 py-1.5 text-xs text-[#60A5FA] border border-[#2563EB]/40 rounded-lg hover:bg-[#2563EB]/10"
                >
                  Refresh Status
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg disabled:opacity-50"
            >
              Save Profile
            </button>
          </form>
        </div>

        <div className="lg:col-span-6 bg-[#0B0C10] border border-white/[0.08] rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-white">Security & Password</h2>

          {passwordMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
              {passwordMsg}
            </div>
          )}

          {hasPasswordProvider ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-400">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-400">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2.5 text-sm font-medium text-white border border-white/15 hover:bg-white/[0.05] rounded-lg disabled:opacity-50"
              >
                Update Password
              </button>
            </form>
          ) : (
            <p className="text-sm text-zinc-400 leading-relaxed">
              Your account is authenticated via Google Sign-In. Password management is handled through your Google account security settings.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
