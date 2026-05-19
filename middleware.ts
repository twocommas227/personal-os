import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "pos_session";
const PUBLIC = ["/login", "/api/auth", "/api/telegram"];

function isPublic(pathname: string): boolean {
  return PUBLIC.some((p) => pathname.startsWith(p));
}

function verifySession(cookie: string | undefined): boolean {
  if (!cookie) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const idx = cookie.lastIndexOf(".");
  if (idx === -1) return false;
  const value = cookie.slice(0, idx);
  const sig = cookie.slice(idx + 1);
  const expected = createHmac("sha256", secret).update(value).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Allow x-api-secret header for programmatic access
  const apiSecret = req.headers.get("x-api-secret");
  const envSecret = process.env.API_SECRET;
  if (apiSecret && envSecret) {
    try {
      if (timingSafeEqual(Buffer.from(apiSecret), Buffer.from(envSecret))) {
        return NextResponse.next();
      }
    } catch {}
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  if (verifySession(cookie)) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
