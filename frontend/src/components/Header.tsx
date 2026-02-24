"use client";

import React from "react";
import { useMarketStatus, useClock, useSpotPrices } from "@/hooks/useMarketData";

export type TabName = "dashboard" | "features" | "credentials" | "profile" | "help";

const TABS: { value: TabName; label: string; icon: React.ReactNode }[] = [
    {
        value: "dashboard",
        label: "Dashboard",
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
        ),
    },
    {
        value: "features",
        label: "Features",
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
    },
    {
        value: "credentials",
        label: "API Credentials",
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
        ),
    },
    {
        value: "profile",
        label: "Profile",
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
        ),
    },
    {
        value: "help",
        label: "Help",
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

interface HeaderProps {
    idToken: string | null;
    activeTab: TabName;
    onTabChange: (tab: TabName) => void;
}

export default function Header({ idToken, activeTab, onTabChange }: HeaderProps) {
    const status = useMarketStatus();
    const clock = useClock();
    const { nifty, sensex } = useSpotPrices(idToken);

    return (
        <header className="w-full border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl">
            {/* Top row — title + tickers + clock */}
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

            {/* Tab bar */}
            <div className="mx-auto max-w-7xl px-6">
                <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
                    {TABS.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => onTabChange(tab.value)}
                            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all duration-200 ${activeTab === tab.value
                                    ? "bg-white/10 text-white border-b-2 border-violet-500 shadow-[0_2px_10px_rgba(139,92,246,0.15)]"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                                }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </nav>
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
