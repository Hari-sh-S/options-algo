"use client";

import { useMarketStatus, useClock, useSpotPrices } from "@/hooks/useMarketData";
import type { Credentials } from "@/lib/api";

interface HeaderProps {
    creds: Credentials | null;
}

export default function Header({ creds }: HeaderProps) {
    const status = useMarketStatus();
    const clock = useClock();
    const { nifty, sensex } = useSpotPrices(creds);

    return (
        <header className="w-full border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
                {/* Title */}
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-bold text-white tracking-tight">
                        Options Execution Portal
                    </h1>
                </div>

                {/* Live Tickers */}
                <div className="hidden md:flex items-center gap-6">
                    <Ticker label="NIFTY" value={nifty?.ltp} />
                    <Ticker label="SENSEX" value={sensex?.ltp} />
                </div>

                {/* Clock & Status */}
                <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-slate-300">{clock || "--:--:--"}</span>
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${status?.is_open
                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                            : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                            }`}
                    >
                        {status?.status_label || "CONNECTING..."}
                    </span>
                </div>
            </div>
        </header>
    );
}

function Ticker({ label, value }: { label: string; value?: number | null }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">{label}</span>
            <span className="font-mono text-sm font-semibold text-white">
                {value != null ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
            </span>
            {value != null && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
        </div>
    );
}
