"use client";

import { useState, useCallback } from "react";

import Header, { type TabName } from "@/components/Header";
import CredentialsPanel from "@/components/CredentialsPanel";
import StrategyConfig from "@/components/StrategyConfig";
import InfoCards from "@/components/InfoCards";
import OrderHistory from "@/components/EntrySummary";
import LivePositions from "@/components/LivePositions";
import HelpTab from "@/components/HelpTab";
import ProfileTab from "@/components/ProfileTab";
import ScheduledJobs from "@/components/ScheduledJobs";
import { usePositions } from "@/hooks/useMarketData";
import { useAuth } from "@/contexts/AuthContext";

import type { ExecuteResponse } from "@/lib/api";

export default function Dashboard() {
  const { idToken } = useAuth();
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [activeTab, setActiveTab] = useState<TabName>("dashboard");
  const [orderHistory, setOrderHistory] = useState<ExecuteResponse[]>([]);
  const { data: positionsData, refresh: refreshPositions } = usePositions(idToken);

  const handleExecuted = useCallback(
    (result: ExecuteResponse) => {
      setOrderHistory((prev) => [...prev, result]);
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
        <Header
          idToken={idToken}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">

          {/* Live-mode warning — shown on Dashboard tab */}
          {activeTab === "dashboard" && mode === "live" && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-300">
              ⚠️ <strong>LIVE MODE</strong> — Real orders will be placed on Dhan. Ensure credentials are correct.
            </div>
          )}

          {/* ─── Dashboard Tab ─── */}
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-7 space-y-6">
                <StrategyConfig
                  idToken={idToken}
                  mode={mode}
                  onModeChange={setMode}
                  onExecuted={handleExecuted}
                />
                <ScheduledJobs idToken={idToken} />
              </div>
              {/* Right Column — Live Positions first, Order History below */}
              <div className="lg:col-span-5 space-y-6">
                <LivePositions
                  idToken={idToken}
                  data={positionsData}
                  onRefresh={refreshPositions}
                />
                <OrderHistory results={orderHistory} />
              </div>
            </div>
          )}

          {/* ─── Features Tab ─── */}
          {activeTab === "features" && (
            <div className="mx-auto max-w-2xl">
              <InfoCards />
            </div>
          )}

          {/* ─── API Credentials Tab ─── */}
          {activeTab === "credentials" && (
            <div className="mx-auto max-w-lg">
              <CredentialsPanel />
            </div>
          )}

          {/* ─── Profile Tab ─── */}
          {activeTab === "profile" && <ProfileTab />}

          {/* ─── Help Tab ─── */}
          {activeTab === "help" && <HelpTab />}

        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-600">
          OptionI · Powered by Dhan API · For educational purposes only
        </footer>
      </div>
    </div>
  );
}
