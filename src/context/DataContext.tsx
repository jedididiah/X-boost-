import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import type {
  AdminSettings,
  Announcement,
  PaymentRecord,
  SmmOrder,
  SmmService,
  SupportTicket,
  UserNotification,
  UserProfile,
  Wallet,
  WalletTransaction,
} from '../types';
import { useAuth } from './AuthContext';

interface DataContextValue {
  services: SmmService[];
  servicesLoading: boolean;
  adminSettings: AdminSettings | null;
  announcements: Announcement[];
  orders: SmmOrder[];
  transactions: WalletTransaction[];
  paymentRecords: PaymentRecord[];
  notifications: UserNotification[];
  supportTickets: SupportTicket[];
  allUsers: UserProfile[];
  allWallets: Wallet[];
  allOrders: SmmOrder[];
  allTransactions: WalletTransaction[];
  allPayments: PaymentRecord[];
  allTickets: SupportTicket[];
}

const DataContext = createContext<DataContextValue | null>(null);

function toMillis(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function sortByCreatedDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, authReady, isAdmin } = useAuth();

  const [services, setServices] = useState<SmmService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [orders, setOrders] = useState<SmmOrder[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allWallets, setAllWallets] = useState<Wallet[]>([]);
  const [allOrders, setAllOrders] = useState<SmmOrder[]>([]);
  const [allTransactions, setAllTransactions] = useState<WalletTransaction[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);

  // Public catalog, settings, and announcements
  useEffect(() => {
    const unsubServices = onSnapshot(
      collection(db, 'services'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as SmmService);
        setServices(list.sort((a, b) => a.platform.localeCompare(b.platform) || a.ratePer1000 - b.ratePer1000));
        setServicesLoading(false);
      },
      (error) => {
        setServicesLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'services');
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'adminSettings', 'platform'),
      (snap) => {
        setAdminSettings(snap.exists() ? (snap.data() as AdminSettings) : null);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'adminSettings/platform');
      }
    );

    const unsubAnnouncements = onSnapshot(
      collection(db, 'announcements'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Announcement);
        setAnnouncements(sortByCreatedDesc(list));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'announcements');
      }
    );

    return () => {
      unsubServices();
      unsubSettings();
      unsubAnnouncements();
    };
  }, []);

  // Authenticated customer subscriptions
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setOrders([]);
      setTransactions([]);
      setPaymentRecords([]);
      setNotifications([]);
      setSupportTickets([]);
      return;
    }

    const uid = firebaseUser.uid;

    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), where('userId', '==', uid)),
      (snap) => setOrders(sortByCreatedDesc(snap.docs.map((d) => d.data() as SmmOrder))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );

    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', uid)),
      (snap) => setTransactions(sortByCreatedDesc(snap.docs.map((d) => d.data() as WalletTransaction))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'paymentRecords'), where('userId', '==', uid)),
      (snap) => setPaymentRecords(sortByCreatedDesc(snap.docs.map((d) => d.data() as PaymentRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'paymentRecords')
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
      (snap) => setNotifications(sortByCreatedDesc(snap.docs.map((d) => d.data() as UserNotification))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    );

    const unsubTickets = onSnapshot(
      query(collection(db, 'supportTickets'), where('userId', '==', uid)),
      (snap) => setSupportTickets(sortByCreatedDesc(snap.docs.map((d) => d.data() as SupportTicket))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'supportTickets')
    );

    return () => {
      unsubOrders();
      unsubTx();
      unsubPayments();
      unsubNotifs();
      unsubTickets();
    };
  }, [authReady, firebaseUser]);

  // Admin-only full collection subscriptions
  useEffect(() => {
    if (!authReady || !firebaseUser || !isAdmin) {
      setAllUsers([]);
      setAllWallets([]);
      setAllOrders([]);
      setAllTransactions([]);
      setAllPayments([]);
      setAllTickets([]);
      return;
    }

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setAllUsers(sortByCreatedDesc(snap.docs.map((d) => d.data() as UserProfile))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubWallets = onSnapshot(
      collection(db, 'wallets'),
      (snap) => setAllWallets(snap.docs.map((d) => d.data() as Wallet)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'wallets')
    );

    const unsubAllOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => setAllOrders(sortByCreatedDesc(snap.docs.map((d) => d.data() as SmmOrder))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );

    const unsubAllTx = onSnapshot(
      collection(db, 'transactions'),
      (snap) => setAllTransactions(sortByCreatedDesc(snap.docs.map((d) => d.data() as WalletTransaction))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
    );

    const unsubAllPayments = onSnapshot(
      collection(db, 'paymentRecords'),
      (snap) => setAllPayments(sortByCreatedDesc(snap.docs.map((d) => d.data() as PaymentRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'paymentRecords')
    );

    const unsubAllTickets = onSnapshot(
      collection(db, 'supportTickets'),
      (snap) => setAllTickets(sortByCreatedDesc(snap.docs.map((d) => d.data() as SupportTicket))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'supportTickets')
    );

    return () => {
      unsubUsers();
      unsubWallets();
      unsubAllOrders();
      unsubAllTx();
      unsubAllPayments();
      unsubAllTickets();
    };
  }, [authReady, firebaseUser, isAdmin]);

  return (
    <DataContext.Provider
      value={{
        services,
        servicesLoading,
        adminSettings,
        announcements,
        orders,
        transactions,
        paymentRecords,
        notifications,
        supportTickets,
        allUsers,
        allWallets,
        allOrders,
        allTransactions,
        allPayments,
        allTickets,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
