import type { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

const DEFAULT_BOOTSTRAP_ADMIN = 'jedidiahobongha139@gmail.com';

function loadFirebaseProjectId(): string {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: string };
      if (raw.projectId && raw.projectId !== 'remixed-project-id') {
        return raw.projectId;
      }
    } catch {
      // Ignore malformed config file and fall back to env
    }
  }
  return process.env.FIREBASE_PROJECT_ID || '';
}

function getFirebaseAdminAuth() {
  const projectId = loadFirebaseProjectId();
  if (!projectId) {
    throw new Error('Firebase projectId is not configured.');
  }
  const app = getApps().length ? getApp() : initializeApp({ projectId });
  return getAuth(app);
}

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

export function getAdminEmailAllowlist(): Set<string> {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set([DEFAULT_BOOTSTRAP_ADMIN.toLowerCase(), ...fromEnv]);
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Missing Bearer authentication token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Empty authentication token.' });
    return;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ ok: false, code: 'INVALID_TOKEN', message: 'Invalid or expired Firebase ID token.' });
  }
}

export async function requireVerifiedUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (!req.user?.email_verified) {
      res.status(403).json({
        ok: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before performing financial or order actions.',
      });
      return;
    }
    next();
  });
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireVerifiedUser(req, res, () => {
    const email = (req.user?.email || '').toLowerCase();
    const allowlist = getAdminEmailAllowlist();
    if (!email || !allowlist.has(email)) {
      res.status(403).json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Administrator privileges are required for this endpoint.',
      });
      return;
    }
    next();
  });
}
