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
  const [lastResult, setLastResult] = useState<ExecuteResponse | null>(null);
  const { data: positionsData, refresh: refreshPositions } = usePositions(
    creds.client_id ? creds : null
  );

  const handleExecuted = useCallback(
    (result: ExecuteResponse) => {
      setLastResult(result);
      // Refresh positions after a short delay to allow Dhan to process
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ── Left Column ── */}
            <div className="lg:col-span-5 space-y-6">
              <CredentialsPanel creds={creds} onChange={setCreds} />
              <StrategyConfig creds={creds} onExecuted={handleExecuted} />
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
