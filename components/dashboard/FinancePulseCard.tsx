"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import type { FinanceData } from "@/app/api/finance/route";

function fmt(n: number, currency: "USD" | "THB"): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
}

function Delta({ value, currency = "USD" }: { value: number; currency?: "USD" | "THB" }) {
  const color = value >= 0 ? "text-[var(--ok)]" : "text-[var(--danger)]";
  const sign = value >= 0 ? "+" : "";
  return <span className={`num text-[10px] ${color}`}>{sign}{fmt(Math.abs(value), currency)}</span>;
}

type View = "personal" | "business";
type Currency = "USD" | "THB";

export default function FinancePulseCard() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("personal");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, []);

  return (
    <Panel
      title="Finance Pulse"
      action={
        data && (
          <button
            onClick={() => setRevealed((v) => !v)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs"
            title={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? "🙈" : "👁"}
          </button>
        )
      }
    >
      <div className="px-4 pb-4 space-y-3">
        {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        {data && (
          <>
            {/* Top toggle: Personal | Two Commas */}
            <div className="flex gap-1 bg-[var(--ink-2)] rounded-lg p-0.5">
              {([["personal", "Personal"], ["business", "Two Commas"]] as [View, string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 text-[10px] font-mono py-1 rounded-md transition-colors ${
                    view === v ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={`transition-all duration-300 space-y-3 ${!revealed ? "blur-md select-none pointer-events-none" : ""}`}>

              {/* ── PERSONAL VIEW ── */}
              {view === "personal" && (() => {
                const d = currency === "USD" ? data.personal.usd : data.personal.thb;
                return (
                  <>
                    {/* Currency sub-toggle */}
                    <div className="flex gap-1 justify-end">
                      {(["USD", "THB"] as Currency[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => setCurrency(c)}
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                            currency === c ? "bg-[var(--ink-4)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>

                    {/* Net Worth */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Net Worth</p>
                      <p className={`num text-2xl font-semibold ${d.netWorth >= 0 ? "text-[var(--text-primary)]" : "text-[var(--danger)]"}`}>
                        {fmt(d.netWorth, currency)}
                      </p>
                    </div>

                    {/* Assets / Liabilities */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[var(--ok)]/10 rounded-lg px-3 py-2">
                        <p className="text-[9px] font-mono uppercase text-[var(--ok)] mb-1">Assets</p>
                        <p className="num text-sm font-semibold text-[var(--ok)]">{fmt(d.totalAssets, currency)}</p>
                      </div>
                      <div className="bg-[var(--danger)]/10 rounded-lg px-3 py-2">
                        <p className="text-[9px] font-mono uppercase text-[var(--danger)] mb-1">Liabilities</p>
                        <p className="num text-sm font-semibold text-[var(--danger)]">{fmt(d.totalLiabilities, currency)}</p>
                      </div>
                    </div>

                    {/* Monthly Cash Flow */}
                    <div className="border-t border-[var(--glass-border)] pt-2 space-y-1.5">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Monthly</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">Income</span>
                        <span className="num text-xs text-[var(--ok)]">{fmt(d.monthlyIncome, currency)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">Expenses</span>
                        <span className="num text-xs text-[var(--danger)]">{fmt(d.monthlyExpenses, currency)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-[var(--glass-border)] pt-1.5">
                        <span className="text-xs font-medium text-[var(--text-primary)]">Cash Flow</span>
                        <Delta value={d.netCashFlow} currency={currency} />
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* ── TWO COMMAS VIEW ── */}
              {view === "business" && (() => {
                const b = data.business;
                return (
                  <>
                    {/* Cash */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Cash</p>
                      <p className="num text-2xl font-semibold text-[var(--text-primary)]">{fmt(b.totalCash, "USD")}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">Chase</span>
                        <span className="num text-xs text-[var(--text-muted)]">{fmt(b.cashChase, "USD")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">Wise</span>
                        <span className="num text-xs text-[var(--text-muted)]">{fmt(b.cashWise, "USD")}</span>
                      </div>
                    </div>

                    {/* P&L */}
                    <div className="border-t border-[var(--glass-border)] pt-2 space-y-1.5">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Monthly P&L</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">Revenue</span>
                        <span className="num text-xs text-[var(--ok)]">{fmt(b.monthlyRevenue, "USD")}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">Expenses</span>
                        <span className="num text-xs text-[var(--danger)]">{fmt(b.monthlyExpenses, "USD")}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-[var(--glass-border)] pt-1.5">
                        <span className="text-xs font-medium text-[var(--text-primary)]">Net Profit</span>
                        <Delta value={b.netProfit} currency="USD" />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
