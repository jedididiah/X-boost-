import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { requireAdmin, requireVerifiedUser, type AuthenticatedRequest } from './server/auth.ts';
import {
  getPaymentGatewayServerStatus,
  initializeGatewayPayment,
  isFlutterwaveWebhookHashConfigured,
  verifyFlutterwaveWebhookHash,
  verifyGatewayPayment,
  type PaymentGatewayId,
} from './server/payments/gateways.ts';
import {
  findVerifiedDuplicate,
  getWebhookTransactionByRef,
  listWebhookTransactions,
  markWebhookCredited,
  recordWebhookTransaction,
} from './server/payments/webhookLedger.ts';
import { delexGainsProvider } from './server/providers/delexGains.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveTrustedAppUrl(req: Request): string {
  const envUrl = (process.env.APP_URL || '').trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      // Fall through to safe host validation
    }
  }
  const host = req.get('host') || 'localhost:3000';
  if (/^[a-zA-Z0-9.-]+(:\d+)?$/.test(host)) {
    return `${req.protocol === 'https' ? 'https' : 'http'}://${host}`;
  }
  return 'http://localhost:3000';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);

  // Security headers (iframe-compatible)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Preserve raw body for cryptographic webhook verification
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'x-boost-api', timestamp: new Date().toISOString() });
  });

  // Payment gateway configuration status (returns booleans only, never secrets)
  app.get('/api/payments/status', requireVerifiedUser, (_req, res) => {
    res.json({ ok: true, status: getPaymentGatewayServerStatus() });
  });

  // Initialize server-side Flutterwave payment session
  app.post('/api/payments/initialize', requireVerifiedUser, async (req: AuthenticatedRequest, res: Response) => {
    const { gateway, amount, currency, reference } = req.body as {
      gateway?: PaymentGatewayId;
      amount?: number;
      currency?: 'USD' | 'NGN' | 'EUR' | 'GBP';
      reference?: string;
    };

    const resolvedGateway = gateway || 'flutterwave';
    if (resolvedGateway !== 'flutterwave') {
      res.status(400).json({
        ok: false,
        code: 'INVALID_GATEWAY',
        message: 'Only Flutterwave is enabled for customer payments.',
      });
      return;
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1) {
      res.status(400).json({ ok: false, code: 'INVALID_AMOUNT', message: 'Valid deposit amount is required.' });
      return;
    }
    if (currency && !['USD', 'NGN', 'EUR', 'GBP'].includes(currency)) {
      res.status(400).json({ ok: false, code: 'INVALID_CURRENCY', message: 'Unsupported payment currency.' });
      return;
    }
    if (!reference || typeof reference !== 'string' || !/^[a-zA-Z0-9_-]{3,128}$/.test(reference)) {
      res.status(400).json({ ok: false, code: 'INVALID_REFERENCE', message: 'Valid payment reference is required.' });
      return;
    }

    const appUrl = resolveTrustedAppUrl(req);
    const result = await initializeGatewayPayment({
      gateway: 'flutterwave',
      amount,
      currency: currency || 'USD',
      email: req.user?.email || '',
      userId: req.user?.uid || '',
      reference,
      callbackUrl: `${appUrl}/wallet`,
    });

    res.status(result.ok ? 200 : 422).json(result);
  });

  // Server-side Flutterwave payment verification
  app.post('/api/payments/verify', requireVerifiedUser, async (req: AuthenticatedRequest, res: Response) => {
    const { gateway, reference, transactionId, expectedAmount, expectedCurrency } = req.body as {
      gateway?: PaymentGatewayId;
      reference?: string;
      transactionId?: string;
      expectedAmount?: number;
      expectedCurrency?: string;
    };

    const resolvedGateway = gateway || 'flutterwave';
    if (resolvedGateway !== 'flutterwave' || !reference || typeof reference !== 'string') {
      res.status(400).json({
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'Flutterwave gateway and payment reference are required.',
      });
      return;
    }

    const webhookRecord = getWebhookTransactionByRef(reference.trim());
    const effectiveTransactionId = (transactionId || '').trim() || webhookRecord?.transactionId;

    const result = await verifyGatewayPayment(
      reference.trim(),
      effectiveTransactionId,
      expectedAmount,
      expectedCurrency
    );

    if (result.verified && result.transactionId) {
      recordWebhookTransaction({
        txRef: result.reference,
        transactionId: result.transactionId,
        flwRef: result.flwRef,
        event: 'manual.verify',
        amount: result.amount || 0,
        chargedAmount: result.chargedAmount,
        currency: result.currency || 'USD',
        customerEmail: result.customerEmail || req.user?.email,
        metaUserId: result.metaUserId || req.user?.uid,
        status: 'verified',
        verified: true,
        credited: webhookRecord?.credited ?? false,
        message: result.message,
        receivedAt: webhookRecord?.receivedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    res.status(result.verified ? 200 : 422).json(result);
  });

  // Admin: inspect stored Flutterwave webhook transaction references and statuses
  app.get('/api/payments/webhook-events', requireAdmin, (_req, res) => {
    res.json({ ok: true, events: listWebhookTransactions() });
  });

  // Admin: mark a verified webhook transaction as credited in the Firestore ledger
  app.post('/api/payments/webhook-events/mark-credited', requireAdmin, (req: Request, res: Response) => {
    const { reference } = req.body as { reference?: string };
    if (!reference || typeof reference !== 'string') {
      res.status(400).json({ ok: false, code: 'INVALID_REFERENCE', message: 'Payment reference is required.' });
      return;
    }
    const updated = markWebhookCredited(reference.trim());
    res.json({ ok: true, updated });
  });

  // Dedicated Flutterwave V3 Webhook Endpoint
  app.post('/api/webhooks/flutterwave', async (req: Request, res: Response) => {
    if (!isFlutterwaveWebhookHashConfigured()) {
      res.status(503).json({
        ok: false,
        code: 'WEBHOOK_NOT_CONFIGURED',
        message: 'FLUTTERWAVE_WEBHOOK_HASH is not configured on the server.',
      });
      return;
    }

    const hash = req.header('verif-hash');
    if (!verifyFlutterwaveWebhookHash(hash)) {
      res.status(401).json({
        ok: false,
        code: 'INVALID_SIGNATURE',
        message: 'Invalid or missing Flutterwave verif-hash header.',
      });
      return;
    }

    const payload = req.body as {
      event?: unknown;
      data?: {
        id?: unknown;
        tx_ref?: unknown;
        flw_ref?: unknown;
        status?: unknown;
        amount?: unknown;
        charged_amount?: unknown;
        currency?: unknown;
        customer?: { email?: unknown };
      };
    } | null;

    if (!payload || typeof payload !== 'object' || typeof payload.event !== 'string' || !payload.data || typeof payload.data !== 'object') {
      res.status(400).json({
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: 'Malformed Flutterwave V3 webhook payload.',
      });
      return;
    }

    const event = payload.event.trim();
    const txRef = typeof payload.data.tx_ref === 'string' ? payload.data.tx_ref.trim() : '';
    const rawId = payload.data.id;
    const txId =
      typeof rawId === 'number' && Number.isInteger(rawId)
        ? String(rawId)
        : typeof rawId === 'string'
          ? rawId.trim()
          : '';
    const webhookStatus =
      typeof payload.data.status === 'string' ? payload.data.status.trim().toLowerCase() : '';
    const webhookAmount =
      typeof payload.data.amount === 'number' && Number.isFinite(payload.data.amount)
        ? payload.data.amount
        : undefined;
    const webhookCurrency =
      typeof payload.data.currency === 'string' && payload.data.currency.trim()
        ? payload.data.currency.trim().toUpperCase()
        : undefined;
    const customerEmail =
      typeof payload.data.customer?.email === 'string' ? payload.data.customer.email.trim() : undefined;
    const flwRef =
      typeof payload.data.flw_ref === 'string' ? payload.data.flw_ref.trim() : undefined;

    if (event !== 'charge.completed') {
      if (txRef && /^[a-zA-Z0-9_-]{3,128}$/.test(txRef)) {
        recordWebhookTransaction({
          txRef,
          transactionId: txId,
          flwRef,
          event,
          amount: webhookAmount || 0,
          currency: webhookCurrency || 'USD',
          customerEmail,
          status: 'ignored',
          verified: false,
          credited: false,
          message: `Ignored non-charge webhook event (${event}).`,
          receivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      res.status(200).json({
        ok: true,
        received: true,
        processed: false,
        event,
        message: 'Event acknowledged.',
      });
      return;
    }

    if (!txRef || !/^[a-zA-Z0-9_-]{3,128}$/.test(txRef) || !txId || !/^[0-9]+$/.test(txId)) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_TRANSACTION_DATA',
        message: 'Valid Flutterwave tx_ref and numeric transaction id are required.',
      });
      return;
    }

    // Prevent duplicate payment processing
    const duplicate = findVerifiedDuplicate(txRef, txId);
    if (duplicate) {
      res.status(200).json({
        ok: true,
        received: true,
        duplicate: true,
        verified: true,
        reference: duplicate.txRef,
        transactionId: duplicate.transactionId,
        amount: duplicate.amount,
        currency: duplicate.currency,
        credited: duplicate.credited,
        message: 'Duplicate notification ignored; transaction was already verified.',
      });
      return;
    }

    if (webhookStatus !== 'successful') {
      recordWebhookTransaction({
        txRef,
        transactionId: txId,
        flwRef,
        event,
        amount: webhookAmount || 0,
        currency: webhookCurrency || 'USD',
        customerEmail,
        status: 'failed',
        verified: false,
        credited: false,
        message: `Webhook reported non-successful status: ${webhookStatus || 'unknown'}.`,
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      res.status(200).json({
        ok: true,
        received: true,
        duplicate: false,
        verified: false,
        reference: txRef,
        transactionId: txId,
        status: webhookStatus || 'failed',
      });
      return;
    }

    if (!getPaymentGatewayServerStatus().flutterwaveConfigured) {
      res.status(503).json({
        ok: false,
        code: 'GATEWAY_NOT_CONFIGURED',
        message: 'FLUTTERWAVE_SECRET_KEY is not configured on the server to verify transactions.',
      });
      return;
    }

    // Verify status, tx_ref, amount, and currency directly with Flutterwave V3 API
    const verification = await verifyGatewayPayment(
      txRef,
      txId,
      webhookAmount,
      webhookCurrency
    );

    if (verification.retryable) {
      res.status(502).json({
        ok: false,
        code: verification.code,
        message: verification.message,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const stored = recordWebhookTransaction({
      txRef,
      transactionId: txId,
      flwRef: verification.flwRef || flwRef,
      event,
      amount: verification.amount ?? webhookAmount ?? 0,
      chargedAmount: verification.chargedAmount,
      currency: (verification.currency || webhookCurrency || 'USD').toUpperCase(),
      customerEmail: verification.customerEmail || customerEmail,
      metaUserId: verification.metaUserId,
      status: verification.verified ? 'verified' : 'failed',
      verified: verification.verified,
      credited: false,
      message: verification.message,
      receivedAt: nowIso,
      updatedAt: nowIso,
    });

    if (!verification.verified) {
      res.status(422).json({
        ok: false,
        received: true,
        verified: false,
        code: verification.code,
        reference: txRef,
        transactionId: txId,
        message: verification.message,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      received: true,
      duplicate: false,
      verified: true,
      reference: stored.txRef,
      transactionId: stored.transactionId,
      amount: stored.amount,
      currency: stored.currency,
      walletCreditStatus: 'verified_pending_ledger_settlement',
      message: 'Flutterwave V3 payment verified and stored.',
    });
  });

  // Delex Gains provider integration endpoints (Admin & Verified User routes)
  app.get('/api/provider/status', requireAdmin, (_req, res) => {
    res.json({ ok: true, status: delexGainsProvider.getConfigurationStatus() });
  });

  app.post('/api/provider/test', requireAdmin, async (_req, res) => {
    const result = await delexGainsProvider.testConnection();
    res.status(result.ok ? 200 : 422).json(result);
  });

  app.get('/api/provider/services', requireAdmin, async (_req, res) => {
    const result = await delexGainsProvider.fetchServices();
    res.status(result.ok ? 200 : 422).json(result);
  });

  app.post('/api/provider/orders/submit', requireVerifiedUser, async (req, res) => {
    const { internalOrderId, providerServiceId, targetLink, quantity } = req.body as {
      internalOrderId?: string;
      providerServiceId?: string;
      targetLink?: string;
      quantity?: number;
    };
    const result = await delexGainsProvider.createOrder({
      internalOrderId: internalOrderId || '',
      providerServiceId: providerServiceId || '',
      targetLink: targetLink || '',
      quantity: Number(quantity) || 0,
    });
    res.status(result.ok ? 200 : 422).json(result);
  });

  app.post('/api/provider/orders/status', requireVerifiedUser, async (req, res) => {
    const { providerOrderId } = req.body as { providerOrderId?: string };
    const result = await delexGainsProvider.getOrderStatus(providerOrderId || '');
    res.status(result.ok ? 200 : 422).json(result);
  });

  app.post('/api/provider/orders/cancel', requireVerifiedUser, async (req, res) => {
    const { providerOrderId } = req.body as { providerOrderId?: string };
    const result = await delexGainsProvider.cancelOrder(providerOrderId || '');
    res.status(result.ok ? 200 : 422).json(result);
  });

  app.post('/api/provider/orders/refill', requireVerifiedUser, async (req, res) => {
    const { providerOrderId } = req.body as { providerOrderId?: string };
    const result = await delexGainsProvider.requestRefill(providerOrderId || '');
    res.status(result.ok ? 200 : 422).json(result);
  });

  app.post('/api/provider/refill/status', requireVerifiedUser, async (req, res) => {
    const { refillId } = req.body as { refillId?: string };
    const result = await delexGainsProvider.getRefillStatus(refillId || '');
    res.status(result.ok ? 200 : 422).json(result);
  });

  // Vite middleware in dev / static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`𝕏 Boost server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start 𝕏 Boost server:', err);
  process.exit(1);
});
