"use client";

import { useState } from "react";
import type { ExecuteResponse, OrderLeg } from "@/lib/api";

interface OrderHistoryProps {
    results: ExecuteResponse[];
}

export default function OrderHistory({ results }: OrderHistoryProps) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Order History
                {results.length > 0 && (
                    <span className="ml-auto rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-400 ring-1 ring-teal-500/20">
                        {results.length}
                    </span>
                )}
            </h3>

            {results.length === 0 ? (
                <div className="rounded-lg bg-slate-800/30 border border-dashed border-white/10 p-6 text-center">
                    <p className="text-sm text-slate-500">No trades executed yet</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {[...results].reverse().map((result, idx) => (
                        <OrderEntry key={idx} result={result} index={results.length - idx} />
                    ))}
                </div>
            )}
        </div>
    );
}

function OrderEntry({ result, index }: { result: ExecuteResponse; index: number }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-lg bg-slate-800/40 border border-white/5">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
            >
                <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-600/30 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                        #{index}
                    </span>
                    <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-300 ring-1 ring-violet-500/20">
                        {result.strategy.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-300 ring-1 ring-blue-500/20">
                        {result.index}
                    </span>
                    <span className="text-slate-500">{result.expiry}</span>
                </div>
                <svg
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="px-3 pb-3 space-y-2">
                    {/* Entry Legs */}
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Entry</p>
                    {result.legs.map((leg, i) => (
                        <LegRow key={`e-${i}`} leg={leg} />
                    ))}

                    {/* SL Legs */}
                    {result.sl_legs.length > 0 && (
                        <>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Stop-Loss</p>
                            {result.sl_legs.map((leg, i) => (
                                <LegRow key={`sl-${i}`} leg={leg} />
                            ))}
                        </>
                    )}

                    {/* Error */}
                    {result.error && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-400">
                            {result.error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function LegRow({ leg }: { leg: OrderLeg }) {
    const statusColor = {
        TRADED: "text-emerald-400",
        FILLED: "text-emerald-400",
        COMPLETE: "text-emerald-400",
        PENDING: "text-amber-400",
        TRANSIT: "text-amber-400",
        REJECTED: "text-red-400",
        FAILED: "text-red-400",
        SKIPPED: "text-slate-500",
    }[leg.status.toUpperCase()] || "text-slate-400";

    return (
        <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-1.5">
            <div className="flex items-center gap-3">
                <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${leg.leg === "CE"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300"
                        }`}
                >
                    {leg.leg}
                </span>
                <span className="text-sm font-mono text-white">{leg.strike}</span>
                {leg.premium != null && (
                    <span className="text-xs text-slate-400">₹{leg.premium.toFixed(2)}</span>
                )}
            </div>
            <span className={`text-xs font-medium ${statusColor}`}>{leg.status}</span>
        </div>
    );
}
