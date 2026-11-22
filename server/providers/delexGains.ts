import net from 'node:net';

export interface ProviderConfigStatus {
  provider: 'Delex Gains';
  apiUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  endpointSpecConfirmed: boolean;
  ready: boolean;
  missingRequirements: string[];
  requiredEnvVars: string[];
}

export interface ProviderServiceItem {
  providerServiceId: string;
  name: string;
  category: string;
  ratePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  supportsCancel: boolean;
  supportsRefill: boolean;
}

export interface ProviderOrderSubmission {
  internalOrderId: string;
  providerServiceId: string;
  targetLink: string;
  quantity: number;
}

export interface ProviderOrderResult {
  ok: boolean;
  code: string;
  message: string;
  providerOrderId?: string;
  providerStatus?: string;
  startCount?: number;
  remains?: number;
  refillStatus?: string;
  services?: ProviderServiceItem[];
  balance?: number;
  currency?: string;
}

export interface SmmProviderAdapter {
  getConfigurationStatus(): ProviderConfigStatus;
  testConnection(): Promise<ProviderOrderResult>;
  fetchServices(): Promise<ProviderOrderResult>;
  createOrder(payload: ProviderOrderSubmission): Promise<ProviderOrderResult>;
  getOrderStatus(providerOrderId: string): Promise<ProviderOrderResult>;
  cancelOrder(providerOrderId: string): Promise<ProviderOrderResult>;
  requestRefill(providerOrderId: string): Promise<ProviderOrderResult>;
  getRefillStatus(refillId: string): Promise<ProviderOrderResult>;
}

function isBlockedPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === 'metadata.google.internal' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = net.isIP(lower);
  if (ipVersion === 4) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  } else if (ipVersion === 6) {
    if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

export function validateProviderBaseUrl(rawUrl: string): { valid: boolean; reason?: string } {
  if (!rawUrl) {
    return { valid: false, reason: 'DELEX_GAINS_API_URL is not set.' };
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, reason: 'Provider URL must use https or http.' };
    }
    if (isBlockedPrivateHost(parsed.hostname)) {
      return { valid: false, reason: 'Private or loopback provider hostnames are blocked.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'DELEX_GAINS_API_URL is not a valid URL.' };
  }
}

/**
 * Delex Gains SMM Provider Adapter.
 *
 * Intentionally avoids inventing undocumented API paths or payloads.
 * Once official Delex Gains API documentation and credentials are supplied:
 * 1. Set DELEX_GAINS_API_URL and DELEX_GAINS_API_KEY in server environment secrets.
 * 2. Wire the documented request/response mapping inside the protected methods below
 *    and set DELEX_GAINS_ENDPOINT_SPEC_CONFIRMED="true" (or enable inside this adapter).
 */
export class DelexGainsProvider implements SmmProviderAdapter {
  private get apiUrl(): string {
    return (process.env.DELEX_GAINS_API_URL || '').trim();
  }

  private get apiKey(): string {
    return (process.env.DELEX_GAINS_API_KEY || '').trim();
  }

  private get endpointSpecConfirmed(): boolean {
    return process.env.DELEX_GAINS_ENDPOINT_SPEC_CONFIRMED === 'true';
  }

  getConfigurationStatus(): ProviderConfigStatus {
    const urlCheck = validateProviderBaseUrl(this.apiUrl);
    const apiUrlConfigured = Boolean(this.apiUrl) && urlCheck.valid;
    const apiKeyConfigured = Boolean(this.apiKey);
    const endpointSpecConfirmed = this.endpointSpecConfirmed;

    const missingRequirements: string[] = [];
    if (!this.apiUrl) {
      missingRequirements.push('DELEX_GAINS_API_URL environment variable is empty.');
    } else if (!urlCheck.valid) {
      missingRequirements.push(urlCheck.reason || 'DELEX_GAINS_API_URL is invalid.');
    }
    if (!apiKeyConfigured) {
      missingRequirements.push('DELEX_GAINS_API_KEY environment variable is empty.');
    }
    if (!endpointSpecConfirmed) {
      missingRequirements.push(
        'Official Delex Gains API endpoint paths and payload schema are awaiting documentation.'
      );
    }

    return {
      provider: 'Delex Gains',
      apiUrlConfigured,
      apiKeyConfigured,
      endpointSpecConfirmed,
      ready: apiUrlConfigured && apiKeyConfigured && endpointSpecConfirmed,
      missingRequirements,
      requiredEnvVars: ['DELEX_GAINS_API_URL', 'DELEX_GAINS_API_KEY'],
    };
  }

  private notReadyResult(operation: string): ProviderOrderResult {
    const status = this.getConfigurationStatus();
    return {
      ok: false,
      code: !status.apiUrlConfigured || !status.apiKeyConfigured
        ? 'PROVIDER_CREDENTIALS_REQUIRED'
        : 'PROVIDER_ENDPOINT_SPEC_REQUIRED',
      message: `Cannot run ${operation}: ${status.missingRequirements.join(' ')}`,
    };
  }

  async testConnection(): Promise<ProviderOrderResult> {
    const status = this.getConfigurationStatus();
    if (!status.ready) {
      return this.notReadyResult('provider connection test');
    }
    return {
      ok: false,
      code: 'PROVIDER_ENDPOINT_SPEC_REQUIRED',
      message:
        'Credentials detected, but exact Delex Gains endpoint paths must be mapped from your API documentation before live calls.',
    };
  }

  async fetchServices(): Promise<ProviderOrderResult> {
    const status = this.getConfigurationStatus();
    if (!status.ready) {
      return this.notReadyResult('service catalog sync');
    }
    return {
      ok: false,
      code: 'PROVIDER_ENDPOINT_SPEC_REQUIRED',
      message: 'Awaiting Delex Gains service list endpoint schema.',
    };
  }

  async createOrder(payload: ProviderOrderSubmission): Promise<ProviderOrderResult> {
    if (!payload.internalOrderId || !payload.providerServiceId || !payload.targetLink || payload.quantity < 1) {
      return {
        ok: false,
        code: 'INVALID_ORDER_PAYLOAD',
        message: 'Invalid order parameters supplied to provider adapter.',
      };
    }
    const status = this.getConfigurationStatus();
    if (!status.ready) {
      return this.notReadyResult('order dispatch');
    }
    return {
      ok: false,
      code: 'PROVIDER_ENDPOINT_SPEC_REQUIRED',
      message: 'Awaiting Delex Gains order creation endpoint schema.',
    };
  }

  async getOrderStatus(providerOrderId: string): Promise<ProviderOrderResult> {
    if (!providerOrderId) {
      return { ok: false, code: 'MISSING_PROVIDER_ORDER_ID', message: 'Provider order ID is required.' };
    }
    const status = this.getConfigurationStatus();
    if (!status.ready) {
      return this.notReadyResult('order status check');
    }
    return {
      ok: false,
      code: 'PROVIDER_ENDPOINT_SPEC_REQUIRED',
      message: 'Awaiting Delex Gains order status endpoint schema.',
    };
  }

  async cancelOrder(providerOrderId: string): Promise<ProviderOrderResult> {
    if (!providerOrderId) {
      return { ok: false, code: 'MISSING_PROVIDER_ORDER_ID', message: 'Provider order ID is required.' };
    }
    const status = this.getConfigurationStatus();
    if (!status.ready) {
      return this.notReadyResult('order cancellation');
    }
    return {
      ok: false,
      code: 'PROVIDER_ENDPOINT_SPEC_REQUIRED',
      message: 'Awaiting Delex Gains order cancel endpoint schema.',
    };
  }

  async requestRefill(providerOrderId: string): Promise<ProviderOrderResult> {
    if (!providerOrderId) {
      return { ok: false, code: 'MISSING_PROVIDER_ORDER_ID', message: 'Provider order ID is required.' };
    }
    const status = this.getConfigurationStatus();
    if (!status.ready) {
      return this.notReadyResult('refill request');
    }
    return {
      ok: false,
      code: 'PROVIDER_ENDPOINT_SPEC_REQUIRED',
      message: 'Awaiting Delex Gains refill request endpoint schema.',
    };
  }

  async getRefillStatus(refillId: string): Promise<ProviderOrderResult> {
    if (!refillId) {
      return { ok: false, code: 'MISSING_REFILL_ID', message: 'Refill ID is required.' };
    }
    const status = this.getConfigurationStatus();
    if (!status.ready) {
      return this.notReadyResult('refill status check');
    }
    return {
      ok: false,
      code: 'PROVIDER_ENDPOINT_SPEC_REQUIRED',
      message: 'Awaiting Delex Gains refill status endpoint schema.',
    };
  }
}

export const delexGainsProvider = new DelexGainsProvider();
