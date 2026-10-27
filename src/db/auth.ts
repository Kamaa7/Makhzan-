import type { AuthSession, AuthUser } from "../lib/types";
import { hashPassword, randomToken, verifyPassword } from "./crypto";
import { newId, nowIso, oneRow, persistDb, runSql } from "./engine";

const SESSION_KEY = "makhzan.session";

function mapUser(row: Record<string, unknown>): AuthUser {
  return { id: String(row.id), email: String(row.email) };
}

export function readStoredSession(): { token: string; userId: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; userId?: string };
    if (!parsed.token || !parsed.userId) return null;
    return { token: parsed.token, userId: parsed.userId };
  } catch {
    return null;
  }
}

function writeStoredSession(token: string, userId: string): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, userId }));
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function requireUserId(): string {
  const stored = readStoredSession();
  if (!stored) throw new Error("Not signed in");
  const row = oneRow("SELECT user_id FROM sessions WHERE token = ? AND user_id = ?", [stored.token, stored.userId]);
  if (!row) {
    clearStoredSession();
    throw new Error("Not signed in");
  }
  return stored.userId;
}

async function createSession(user: AuthUser): Promise<AuthSession> {
  const token = randomToken();
  runSql("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", [token, user.id, nowIso()]);
  await persistDb();
  writeStoredSession(token, user.id);
  return { token, user };
}

export async function restoreSession(): Promise<AuthSession | null> {
  const stored = readStoredSession();
  if (!stored) return null;
  const row = oneRow(
    `SELECT u.id, u.email
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.user_id = ?`,
    [stored.token, stored.userId],
  );
  if (!row) {
    clearStoredSession();
    return null;
  }
  return { token: stored.token, user: mapUser(row) };
}

export async function signUp(email: string, password: string): Promise<AuthSession> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || password.length < 6) throw new Error("Enter an email and a password of at least 6 characters");
  const existing = oneRow("SELECT id FROM users WHERE lower(email) = ?", [normalized]);
  if (existing) throw new Error("An account with this email already exists");
  const { hash, salt } = await hashPassword(password);
  const user: AuthUser = { id: newId(), email: normalized };
  runSql("INSERT INTO users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)", [
    user.id,
    user.email,
    hash,
    salt,
    nowIso(),
  ]);
  await persistDb();
  return createSession(user);
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const normalized = email.trim().toLowerCase();
  const row = oneRow("SELECT id, email, password_hash, password_salt FROM users WHERE lower(email) = ?", [normalized]);
  if (!row) throw new Error("Invalid email or password");
  const ok = await verifyPassword(password, String(row.password_hash), String(row.password_salt));
  if (!ok) throw new Error("Invalid email or password");
  return createSession(mapUser(row));
}

export async function signOut(): Promise<void> {
  const stored = readStoredSession();
  if (stored) {
    runSql("DELETE FROM sessions WHERE token = ?", [stored.token]);
    await persistDb();
  }
  clearStoredSession();
}

