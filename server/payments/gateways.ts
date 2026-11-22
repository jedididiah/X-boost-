import crypto from 'node:crypto';

export type PaymentGatewayId = 'flutterwave';

export interface GatewayConfigurationStatus {
  flutterwaveConfigured: boolean;
  flutterwaveWebhookConfigured: boolean;
}

export interface InitializePaymentInput {
  gateway: PaymentGatewayId;
  amount: number;
  currency: 'USD' | 'NGN' | 'EUR' | 'GBP';
  email: string;
  userId: string;
  reference: string;
  callbackUrl: string;
}

export interface InitializePaymentResult {
  ok: boolean;
  code: string;
  message: string;
  gateway: PaymentGatewayId;
  reference: string;
  authorizationUrl?: string;
}

export interface VerifyPaymentResult {
  ok: boolean;
  verified: boolean;
  retryable?: boolean;
  code: string;
  message: string;
  gateway: PaymentGatewayId;
  reference: string;
  transactionId?: string;
  flwRef?: string;
  amount?: number;
  chargedAmount?: number;
  currency?: string;
  customerEmail?: string;
  metaUserId?: string;
}

export function isFlutterwaveWebhookHashConfigured(): boolean {
  return Boolean((process.env.FLUTTERWAVE_WEBHOOK_HASH || '').trim());
}

export function getPaymentGatewayServerStatus(): GatewayConfigurationStatus {
  return {
    flutterwaveConfigured: Boolean((process.env.FLUTTERWAVE_SECRET_KEY || '').trim()),
    flutterwaveWebhookConfigured: isFlutterwaveWebhookHashConfigured(),
  };
}

export async function initializeGatewayPayment(
  input: InitializePaymentInput
): Promise<InitializePaymentResult> {
  if (input.gateway !== 'flutterwave') {
    return {
      ok: false,
      code: 'INVALID_GATEWAY',
      message: 'Only Flutterwave is supported for customer payments.',
      gateway: 'flutterwave',
      reference: input.reference,
    };
  }

  if (!Number.isFinite(input.amount) || input.amount < 1 || input.amount > 1000000) {
    return {
      ok: false,
      code: 'INVALID_AMOUNT',
      message: 'Deposit amount must be between 1 and 1,000,000.',
      gateway: 'flutterwave',
      reference: input.reference,
    };
  }

  if (!input.email || !input.email.includes('@')) {
    return {
      ok: false,
      code: 'INVALID_CUSTOMER_EMAIL',
      message: 'A verified customer email address is required for Flutterwave checkout.',
      gateway: 'flutterwave',
      reference: input.reference,
    };
  }

  const secret = (process.env.FLUTTERWAVE_SECRET_KEY || '').trim();
  if (!secret) {
    return {
      ok: false,
      code: 'GATEWAY_NOT_CONFIGURED',
      message: 'FLUTTERWAVE_SECRET_KEY is not configured on the server.',
      gateway: 'flutterwave',
      reference: input.reference,
    };
  }

  try {
    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.callbackUrl,
        customer: { email: input.email },
        meta: { userId: input.userId },
        customizations: {
          title: '𝕏 Boost Wallet Top-Up',
          description: 'Wallet funding deposit',
        },
      }),
    });

    const data = (await res.json()) as {
      status?: string;
      message?: string;
      data?: { link?: string };
    };

    if (!res.ok || data.status !== 'success' || !data.data?.link) {
      return {
        ok: false,
        code: 'FLUTTERWAVE_INIT_FAILED',
        message: data.message || 'Flutterwave rejected transaction initialization.',
        gateway: 'flutterwave',
        reference: input.reference,
      };
    }

    return {
      ok: true,
      code: 'INITIALIZED',
      message: 'Flutterwave checkout session created.',
      gateway: 'flutterwave',
      reference: input.reference,
      authorizationUrl: data.data.link,
    };
  } catch {
    return {
      ok: false,
      code: 'FLUTTERWAVE_NETWORK_ERROR',
      message: 'Unable to reach Flutterwave payment initialization endpoint.',
      gateway: 'flutterwave',
      reference: input.reference,
    };
  }
}

export async function verifyGatewayPayment(
  reference: string,
  externalTransactionId?: string,
  expectedAmount?: number,
  expectedCurrency?: string
): Promise<VerifyPaymentResult> {
  if (!reference || reference.length > 128) {
    return {
      ok: false,
      verified: false,
      code: 'INVALID_REFERENCE',
      message: 'Invalid payment reference.',
      gateway: 'flutterwave',
      reference,
    };
  }

  const secret = (process.env.FLUTTERWAVE_SECRET_KEY || '').trim();
  if (!secret) {
    return {
      ok: false,
      verified: false,
      retryable: true,
      code: 'GATEWAY_NOT_CONFIGURED',
      message: 'FLUTTERWAVE_SECRET_KEY is not configured on the server.',
      gateway: 'flutterwave',
      reference,
    };
  }

  const cleanTxId = (externalTransactionId || '').trim();
  if (!cleanTxId || !/^[0-9]+$/.test(cleanTxId)) {
    return {
      ok: false,
      verified: false,
      code: 'MISSING_TRANSACTION_ID',
      message: 'Flutterwave numeric transaction_id is required for server verification.',
      gateway: 'flutterwave',
      reference,
    };
  }

  try {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(cleanTxId)}/verify`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );

    if (res.status >= 500) {
      return {
        ok: false,
        verified: false,
        retryable: true,
        code: 'FLUTTERWAVE_UPSTREAM_ERROR',
        message: `Flutterwave verify API returned HTTP ${res.status}.`,
        gateway: 'flutterwave',
        reference,
        transactionId: cleanTxId,
      };
    }

    const data = (await res.json()) as {
      status?: string;
      message?: string;
      data?: {
        id?: number;
        status?: string;
        tx_ref?: string;
        flw_ref?: string;
        amount?: number;
        charged_amount?: number;
        currency?: string;
        customer?: { email?: string };
        meta?: { userId?: string };
      };
    };

    const verifiedAmount = data.data?.amount;
    const chargedAmount = data.data?.charged_amount;
    const amountValid = typeof verifiedAmount === 'number' && Number.isFinite(verifiedAmount) && verifiedAmount > 0;
    const amountMatches =
      typeof expectedAmount !== 'number' ||
      !Number.isFinite(expectedAmount) ||
      (amountValid && verifiedAmount + 0.0001 >= expectedAmount);
    const currencyMatches =
      !expectedCurrency ||
      (typeof data.data?.currency === 'string' &&
        data.data.currency.toUpperCase() === expectedCurrency.toUpperCase());

    const isSuccess =
      res.ok &&
      data.status === 'success' &&
      data.data?.status === 'successful' &&
      data.data?.tx_ref === reference &&
      amountValid &&
      amountMatches &&
      currencyMatches;

    return {
      ok: res.ok,
      verified: isSuccess,
      retryable: false,
      code: isSuccess ? 'VERIFIED' : 'VERIFICATION_FAILED',
      message: isSuccess
        ? 'Flutterwave transaction verified.'
        : data.message || 'Flutterwave transaction verification failed.',
      gateway: 'flutterwave',
      reference,
      transactionId: cleanTxId,
      flwRef: data.data?.flw_ref,
      amount: verifiedAmount,
      chargedAmount,
      currency: data.data?.currency,
      customerEmail: data.data?.customer?.email,
      metaUserId: typeof data.data?.meta?.userId === 'string' ? data.data.meta.userId : undefined,
    };
  } catch {
    return {
      ok: false,
      verified: false,
      retryable: true,
      code: 'FLUTTERWAVE_NETWORK_ERROR',
      message: 'Unable to reach Flutterwave transaction verification endpoint.',
      gateway: 'flutterwave',
      reference,
      transactionId: cleanTxId,
    };
  }
}

export function safeCompareHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyFlutterwaveWebhookHash(headerHash: string | undefined): boolean {
  const secretHash = (process.env.FLUTTERWAVE_WEBHOOK_HASH || '').trim();
  if (!secretHash || !headerHash) return false;
  return safeCompareHex(secretHash, headerHash.trim());
}
