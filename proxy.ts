import { NextRequest, NextResponse } from "next/server";

const COOKIE = "pos_session";
const PUBLIC = ["/login", "/api/auth", "/api/telegram", "/api/cron"];

function isPublic(pathname: string): boolean {
  return PUBLIC.some((p) => pathname.startsWith(p));
}

async function hmacSign(secret: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySession(cookie: string | undefined, secret: string): Promise<boolean> {
  if (!cookie) return false;
  const idx = cookie.lastIndexOf(".");
  if (idx === -1) return false;
  const value = cookie.slice(0, idx);
  const sig = cookie.slice(idx + 1);
  const expected = await hmacSign(secret, value);
  // Constant-time compare via length check + every
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const secret = process.env.AUTH_SECRET ?? "";
  const apiSecret = process.env.API_SECRET ?? "";

  // Allow x-api-secret header for programmatic access
  const incomingApiSecret = req.headers.get("x-api-secret") ?? "";
  if (apiSecret && incomingApiSecret === apiSecret) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  if (await verifySession(cookie, secret)) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
