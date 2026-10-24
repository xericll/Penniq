/* App lock: a 4-digit PIN on every device, plus fingerprint / Face ID where the browser offers a platform
   authenticator (WebAuthn). It hides the app from someone holding the phone; it does not encrypt the data
   (that stays readable to the device owner as before), so forgetting the PIN never costs any entry.

   Only salted PBKDF2 hashes of the PIN and of the recovery code are kept, on this device. */

import { KEYS, readJSON, removeKey, write } from './storage';

export type LockTimeout = 0 | 60 | 300;
export const LOCK_TIMEOUTS: LockTimeout[] = [0, 60, 300];

export interface LockConfig {
  enabled: boolean;
  salt: string;
  pinHash: string;
  recoveryHash: string;
  /** Raw id (base64url) of the passkey that unlocks with fingerprint / face; absent without one. */
  credentialId?: string;
  /** Seconds away (or idle) before the app locks again; 0 = as soon as it is left. */
  timeout: LockTimeout;
}

const enc = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function random(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
}

export async function hashSecret(secret: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: 120_000 }, key, 256);
  return b64(bits);
}

/** Compares in constant time, so the check does not leak how much of the PIN was right. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPin(config: LockConfig, pin: string): Promise<boolean> {
  return same(await hashSecret(pin, config.salt), config.pinHash);
}

/** Recovery codes are typed by hand: case, spaces and dashes do not matter. */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function checkRecovery(config: LockConfig, code: string): Promise<boolean> {
  return same(await hashSecret(normalizeCode(code), config.salt), config.recoveryHash);
}

/** Twelve characters without look-alikes (0/O, 1/I), shown as XXXX-XXXX-XXXX. */
export function newRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = [...random(12)].map((b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

export async function createLock(pin: string, recoveryCode: string, timeout: LockTimeout): Promise<LockConfig> {
  const salt = b64(random(16));
  return {
    enabled: true,
    salt,
    pinHash: await hashSecret(pin, salt),
    recoveryHash: await hashSecret(normalizeCode(recoveryCode), salt),
    timeout,
  };
}

export function loadLock(): LockConfig | null {
  const v = readJSON(KEYS.lock) as Partial<LockConfig> | null;
  if (!v || v.enabled !== true || typeof v.salt !== 'string' || typeof v.pinHash !== 'string' || typeof v.recoveryHash !== 'string') {
    return null;
  }
  return {
    enabled: true,
    salt: v.salt,
    pinHash: v.pinHash,
    recoveryHash: v.recoveryHash,
    credentialId: typeof v.credentialId === 'string' ? v.credentialId : undefined,
    timeout: LOCK_TIMEOUTS.includes(v.timeout as LockTimeout) ? (v.timeout as LockTimeout) : 60,
  };
}

export function saveLock(config: LockConfig | null): void {
  if (config) write(KEYS.lock, JSON.stringify(config));
  else removeKey(KEYS.lock);
}

/* ---------- Fingerprint / Face ID (WebAuthn platform authenticator) ---------- */

export async function biometricAvailable(): Promise<boolean> {
  try {
    if (!window.isSecureContext || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Creates a passkey on this device; resolves to its id, or null when the user cancelled. */
export async function registerBiometric(label: string): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: 'Penniq', id: window.location.hostname },
        user: { id: random(16), name: label, displayName: label },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    return cred ? b64(cred.rawId) : null;
  } catch {
    return null;
  }
}

/** Asks the device to confirm the user with fingerprint / face. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: unb64(credentialId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!cred;
  } catch {
    return false;
  }
}
