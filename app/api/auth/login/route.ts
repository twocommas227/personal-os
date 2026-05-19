import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { buildSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected || !password) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let match = false;
  try {
    match = timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    // length mismatch = wrong password
  }

  if (!match) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Set-Cookie": buildSessionCookie() },
  });
}
