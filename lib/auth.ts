import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// This file runs in Node.js API routes (not edge) — Node crypto is fine here.

const COOKIE = "pos_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(value: string): string {
  const secret = process.env.AUTH_SECRET!;
  const sig = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${sig}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const expected = sign(value);
  try {
    if (timingSafeEqual(Buffer.from(signed), Buffer.from(expected))) return value;
  } catch {
    // length mismatch
  }
  return null;
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  return verify(raw) === "authenticated";
}

export function buildSessionCookie(): string {
  const signed = sign("authenticated");
  return `${COOKIE}=${signed}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function isValidApiSecret(header: string | null): boolean {
  const secret = process.env.API_SECRET;
  if (!secret || !header) return false;
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(secret));
  } catch {
    return false;
  }
}
