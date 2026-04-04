import { SignJWT, jwtVerify } from 'jose';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  PASSWORD_PEPPER?: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

const encoder = new TextEncoder();

function getJwtKey(secret: string): Uint8Array {
  return encoder.encode(secret);
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesFromBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    + '==='.slice((input.length + 3) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function normalizeUserEmail(email: string): string {
  return normalizeEmail(email);
}

export function isStrongEnoughPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8;
}

export async function hashPassword(password: string, env: Env): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pepper = env.PASSWORD_PEPPER || '';
  const passwordMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password + pepper),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const iterations = 100000;
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    passwordMaterial,
    256
  );

  const hashBytes = new Uint8Array(derived);

  return [
    'pbkdf2_sha256',
    String(iterations),
    base64UrlFromBytes(salt),
    base64UrlFromBytes(hashBytes)
  ].join('$');
}

export async function verifyPassword(password: string, stored: string, env: Env): Promise<boolean> {
  try {
    const [algo, iterationsStr, saltB64, hashB64] = String(stored).split('$');
    if (algo !== 'pbkdf2_sha256') return false;

    const iterations = Number(iterationsStr);
    if (!iterations || iterations < 100000) return false;

    const salt = bytesFromBase64Url(saltB64);
    const expectedHash = bytesFromBase64Url(hashB64);

    const pepper = env.PASSWORD_PEPPER || '';
    const passwordMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password + pepper),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      passwordMaterial,
      256
    );

    const actualHash = new Uint8Array(derived);

    if (actualHash.length !== expectedHash.length) return false;

    let diff = 0;
    for (let i = 0; i < actualHash.length; i++) {
      diff |= actualHash[i] ^ expectedHash[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export async function createAuthToken(user: AuthUser, env: Env): Promise<string> {
  return await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer('cloudtrips')
    .setAudience('cloudtrips')
    .setExpirationTime('7d')
    .sign(getJwtKey(env.JWT_SECRET));
}

export async function verifyAuthToken(token: string, env: Env): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtKey(env.JWT_SECRET), {
      issuer: 'cloudtrips',
      audience: 'cloudtrips'
    });

    const id = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';

    if (!id || !email) return null;
    return { id, email };
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function requireUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const jwtUser = await verifyAuthToken(token, env);
  if (!jwtUser) return null;

  const row = await env.DB
    .prepare(`SELECT id, email FROM users WHERE id = ? LIMIT 1`)
    .bind(jwtUser.id)
    .first<{ id: string; email: string }>();

  if (!row) return null;

  return {
    id: row.id,
    email: row.email
  };
}
