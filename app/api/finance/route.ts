import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

// Module-level cache — 10 minute TTL
let cache: { data: FinanceData; at: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

export interface FinanceData {
  personal: {
    usd: { netWorth: number; totalAssets: number; totalLiabilities: number; monthlyIncome: number; monthlyExpenses: number; netCashFlow: number };
    thb: { netWorth: number; totalAssets: number; totalLiabilities: number; monthlyIncome: number; monthlyExpenses: number; netCashFlow: number };
  };
  business: {
    cashChase: number;
    cashWise: number;
    totalCash: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    netProfit: number;
  };
}

async function getAccessToken(sa: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const enc = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const signingInput = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  })}`;

  const pemContents = sa.private_key.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\n/g, "");
  const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function fetchRange(token: string, sheetId: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets API error: ${await res.text()}`);
  const json = await res.json();
  return json.values ?? [];
}

async function fetchSheetData(): Promise<FinanceData> {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!b64 || !sheetId) throw new Error("Missing Google credentials");

  const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  const token = await getAccessToken(sa);

  // Fetch personal summary (rows 2-7) and Two Commas tab (rows 2-8)
  const [summaryRows, bizRows] = await Promise.all([
    fetchRange(token, sheetId, "Summary!A2:C7"),
    fetchRange(token, sheetId, "Two Commas!A2:B8"),
  ]);

  const sg = (r: number, c: number) => parseNum(summaryRows[r]?.[c]);
  const bg = (r: number) => parseNum(bizRows[r]?.[1]);

  return {
    personal: {
      usd: {
        netWorth: sg(0, 1),
        totalAssets: sg(1, 1),
        totalLiabilities: sg(2, 1),
        monthlyIncome: sg(3, 1),
        monthlyExpenses: sg(4, 1),
        netCashFlow: sg(5, 1),
      },
      thb: {
        netWorth: sg(0, 2),
        totalAssets: sg(1, 2),
        totalLiabilities: sg(2, 2),
        monthlyIncome: sg(3, 2),
        monthlyExpenses: sg(4, 2),
        netCashFlow: sg(5, 2),
      },
    },
    business: {
      cashChase: bg(0),   // row 2: Cash (Chase)
      cashWise: bg(1),    // row 3: Cash (Wise)
      totalCash: bg(2),   // row 4: Total Cash
      monthlyRevenue: bg(4), // row 6: Monthly Revenue
      monthlyExpenses: bg(5), // row 7: Monthly Expenses
      netProfit: bg(6),   // row 8: Net Profit
    },
  };
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const data = await fetchSheetData();
    cache = { data, at: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[finance] fetch failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
