"use client";

import { useState, useCallback } from "react";

import Header from "@/components/Header";
import CredentialsPanel from "@/components/CredentialsPanel";
import StrategyConfig from "@/components/StrategyConfig";
import InfoCards from "@/components/InfoCards";
import EntrySummary from "@/components/EntrySummary";
import LivePositions from "@/components/LivePositions";
import { usePositions } from "@/hooks/useMarketData";

import type { Credentials, ExecuteResponse } from "@/lib/api";

export default function Dashboard() {
  const [creds, setCreds] = useState<Credentials>({
    client_id: "",
    access_token: "",
  });
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [lastResult, setLastResult] = useState<ExecuteResponse | null>(null);
  const { data: positionsData, refresh: refreshPositions } = usePositions(
    creds.client_id ? creds : null
  );

  const handleExecuted = useCallback(
    (result: ExecuteResponse) => {
      setLastResult(result);
      // Refresh positions after a short delay to allow processing
      setTimeout(refreshPositions, 2000);
    },
    [refreshPositions]
  );

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Header creds={creds.client_id ? creds : null} />

        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          {/* Mode Toggle */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setMode("paper")}
              className={`relative px-5 py-2.5 rounded-l-xl text-sm font-semibold transition-all duration-300 ${mode === "paper"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
            >
              {mode === "paper" && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
              📄 Paper Trading
            </button>
            <button
              onClick={() => setMode("live")}
              className={`relative px-5 py-2.5 rounded-r-xl text-sm font-semibold transition-all duration-300 ${mode === "live"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
            >
              {mode === "live" && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-400 animate-pulse" />
              )}
              🔴 Live Trading
            </button>
          </div>

          {mode === "live" && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-300">
              ⚠️ <strong>LIVE MODE</strong> — Real orders will be placed on Dhan. Ensure credentials are correct.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ── Left Column ── */}
            <div className="lg:col-span-5 space-y-6">
              <CredentialsPanel creds={creds} onChange={setCreds} />
              <StrategyConfig creds={creds} mode={mode} onExecuted={handleExecuted} />
            </div>

            {/* ── Right Column ── */}
            <div className="lg:col-span-7 space-y-6">
              <InfoCards />
              <EntrySummary result={lastResult} />
              <LivePositions
                creds={creds}
                data={positionsData}
                onRefresh={refreshPositions}
              />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-600">
          Options Execution Portal · Powered by Dhan API · For educational purposes only
        </footer>
      </div>
    </div>
  );
}
