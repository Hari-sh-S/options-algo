"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchMargin, type MarginResponse } from "@/lib/api";

interface MarginCardProps {
    idToken: string | null;
}

export default function MarginCard({ idToken }: MarginCardProps) {
    const [data, setData] = useState<MarginResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!idToken) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchMargin(idToken);
            setData(res);
        } catch (e: any) {
            setError(e.message || "Failed");
        } finally {
            setLoading(false);
        }
    }, [idToken]);

    useEffect(() => {
        load();
        // Refresh every 60 seconds
        const interval = setInterval(load, 60_000);
        return () => clearInterval(interval);
    }, [load]);

    const available = data?.available ?? 0;
    const used = data?.used ?? 0;
    const collateral = data?.collateral ?? 0;
    const total = available + used;
    const usedPct = total > 0 ? (used / total) * 100 : 0;

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Account Margin
                </h3>
                <button
                    onClick={load}
                    disabled={loading}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
                    title="Refresh"
                >
                    {loading ? "⟳" : "↻"} Refresh
                </button>
            </div>

            {!idToken ? (
                <p className="text-xs text-slate-500 text-center py-2">Login to view margin</p>
            ) : error ? (
                <p className="text-xs text-red-400 text-center py-2">{error}</p>
            ) : !data ? (
                <p className="text-xs text-slate-500 text-center py-2">Loading…</p>
            ) : (
                <div className="space-y-3">
                    {/* Progress bar */}
                    <div className="relative h-2 rounded-full bg-slate-800/60 overflow-hidden">
                        <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.min(usedPct, 100)}%`,
                                background: usedPct > 80
                                    ? "linear-gradient(90deg, #f97316, #ef4444)"
                                    : usedPct > 50
                                        ? "linear-gradient(90deg, #3b82f6, #f97316)"
                                        : "linear-gradient(90deg, #22c55e, #3b82f6)",
                            }}
                        />
                    </div>

                    {/* Values */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/15 p-3">
                            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-1">Available</p>
                            <p className="text-lg font-mono font-semibold text-emerald-400">
                                ₹{available.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="rounded-lg bg-orange-500/10 border border-orange-500/15 p-3">
                            <p className="text-[10px] text-orange-400/70 uppercase tracking-wider mb-1">Used</p>
                            <p className="text-lg font-mono font-semibold text-orange-400">
                                ₹{used.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>

                    {/* Collateral & utilization */}
                    <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Collateral: ₹{collateral.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                        <span>{usedPct.toFixed(1)}% utilized</span>
                    </div>
                </div>
            )}
        </div>
    );
}
