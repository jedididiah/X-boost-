import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import type { UserProfile, Wallet } from '../types';

const BOOTSTRAP_ADMIN_EMAIL = 'jedidiahobongha139@gmail.com';

interface AuthContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  profile: UserProfile | null;
  wallet: Wallet | null;
  isAdmin: boolean;
  emailVerified: boolean;
  registerWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  confirmResetCode: (oobCode: string, newPassword: string) => Promise<void>;
  applyEmailVerificationCode: (oobCode: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationState: () => Promise<boolean>;
  updateDisplayName: (displayName: string) => Promise<void>;
  changeAccountPassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureUserDocuments(user: User): Promise<boolean> {
  const userRef = doc(db, 'users', user.uid);
  const walletRef = doc(db, 'wallets', user.uid);
  const adminRef = doc(db, 'admins', user.uid);

  const isBootstrap =
    (user.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified;

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      const displayName = (user.displayName || user.email?.split('@')[0] || 'Member').slice(0, 80);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName,
        photoURL: (user.photoURL || '').slice(0, 500),
        role: isBootstrap ? 'admin' : 'user',
        status: 'active',
        emailVerified: user.emailVerified,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (userSnap.data().emailVerified !== user.emailVerified) {
      await updateDoc(userRef, {
        emailVerified: user.emailVerified,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  try {
    const walletSnap = await getDoc(walletRef);
    if (!walletSnap.exists()) {
      await setDoc(walletRef, {
        userId: user.uid,
        balance: 0,
        currency: 'USD',
        totalDeposited: 0,
        totalSpent: 0,
        lastOrderId: '',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `wallets/${user.uid}`);
  }

  let hasAdminMarker = false;
  try {
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      hasAdminMarker = true;
    } else if (isBootstrap) {
      await setDoc(adminRef, {
        uid: user.uid,
        email: user.email || BOOTSTRAP_ADMIN_EMAIL,
        grantedBy: 'bootstrap',
        createdAt: serverTimestamp(),
      });
      hasAdminMarker = true;
    }
  } catch {
    hasAdminMarker = isBootstrap;
  }

  return (hasAdminMarker || isBootstrap) && user.emailVerified;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubWallet: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }
      if (unsubWallet) {
        unsubWallet();
        unsubWallet = null;
      }

      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setWallet(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      try {
        const adminStatus = await ensureUserDocuments(user);
        setIsAdmin(adminStatus);

        unsubUser = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserProfile;
              setProfile(data);
              if (data.role === 'admin' && user.emailVerified) {
                setIsAdmin(true);
              }
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
        );

        unsubWallet = onSnapshot(
          doc(db, 'wallets', user.uid),
          (snap) => {
            if (snap.exists()) {
              setWallet(snap.data() as Wallet);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `wallets/${user.uid}`);
          }
        );
      } finally {
        setAuthReady(true);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
      if (unsubWallet) unsubWallet();
    };
  }, []);

  const registerWithEmail = useCallback(
    async (displayName: string, email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 80) });
      await sendEmailVerification(cred.user);
      await ensureUserDocuments(cred.user);
    },
    []
  );

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const confirmResetCode = useCallback(async (oobCode: string, newPassword: string) => {
    await confirmPasswordReset(auth, oobCode, newPassword);
  }, []);

  const applyEmailVerificationCode = useCallback(async (oobCode: string) => {
    await applyActionCode(auth, oobCode);
    if (auth.currentUser) {
      await auth.currentUser.reload();
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) throw new Error('No active user session.');
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshVerificationState = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updatedUser = auth.currentUser;
    setFirebaseUser(updatedUser);
    if (updatedUser.emailVerified) {
      const adminStatus = await ensureUserDocuments(updatedUser);
      setIsAdmin(adminStatus);
    }
    return updatedUser.emailVerified;
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('You must be signed in.');
    const sanitized = displayName.trim().slice(0, 80);
    await updateProfile(user, { displayName: sanitized });
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: sanitized,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  }, []);

  const changeAccountPassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('Password changes require an email/password account.');
      }
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authReady,
        profile,
        wallet,
        isAdmin,
        emailVerified: Boolean(firebaseUser?.emailVerified),
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        sendResetEmail,
        confirmResetCode,
        applyEmailVerificationCode,
        resendVerificationEmail,
        refreshVerificationState,
        updateDisplayName,
        changeAccountPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
