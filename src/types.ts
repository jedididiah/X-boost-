export type SocialPlatform =
  | 'X'
  | 'Instagram'
  | 'TikTok'
  | 'Facebook'
  | 'YouTube'
  | 'Telegram'
  | 'WhatsApp';

export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export type ServiceStatus = 'active' | 'paused' | 'maintenance';

export interface SmmService {
  id: string;
  platform: SocialPlatform;
  category: string;
  name: string;
  description: string;
  ratePer1000: number;
  providerRatePer1000: number;
  marginPercent: number;
  minQuantity: number;
  maxQuantity: number;
  estimatedTime: string;
  status: ServiceStatus;
  supportsCancel: boolean;
  supportsRefill: boolean;
  providerServiceId: string;
  providerName: string;
  popular: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Wallet {
  userId: string;
  balance: number;
  currency: 'USD';
  totalDeposited: number;
  totalSpent: number;
  lastOrderId: string;
  updatedAt: unknown;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'in_progress'
  | 'completed'
  | 'partial'
  | 'cancelled'
  | 'refunded'
  | 'failed';

export interface SmmOrder {
  id: string;
  userId: string;
  userEmail: string;
  serviceId: string;
  serviceName: string;
  platform: SocialPlatform;
  targetLink: string;
  quantity: number;
  charge: number;
  status: OrderStatus;
  providerOrderId: string;
  providerStatus: string;
  startCount: number;
  remains: number;
  supportsCancel: boolean;
  supportsRefill: boolean;
  cancelRequested: boolean;
  refillRequested: boolean;
  refillStatus: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export type TransactionType = 'deposit' | 'order_debit' | 'refund' | 'admin_adjustment';
export type TransactionStatus = 'completed' | 'pending' | 'failed';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  reference: string;
  orderId: string;
  gateway: string;
  status: TransactionStatus;
  description: string;
  createdAt: unknown;
}

export type PaymentGatewayId = 'flutterwave';
export type PaymentRecordStatus = 'initialized' | 'pending' | 'verified' | 'failed';

export interface PaymentRecord {
  id: string;
  userId: string;
  userEmail: string;
  gateway: PaymentGatewayId;
  reference: string;
  amount: number;
  currency: 'USD' | 'NGN' | 'EUR' | 'GBP';
  status: PaymentRecordStatus;
  gatewayMessage: string;
  verifiedByServer: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'order' | 'wallet' | 'system' | 'support';
  read: boolean;
  createdAt: unknown;
}

export type TicketCategory = 'order' | 'payment' | 'refill' | 'account' | 'other';
export type TicketStatus = 'open' | 'in_review' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  category: TicketCategory;
  orderId: string;
  message: string;
  status: TicketStatus;
  adminReply: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AdminSettings {
  id: string;
  defaultMarginPercent: number;
  minDepositUsd: number;
  flutterwaveEnabled: boolean;
  providerAutoSync: boolean;
  maintenanceMode: boolean;
  supportEmail: string;
  updatedAt: unknown;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'notice' | 'maintenance';
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}
