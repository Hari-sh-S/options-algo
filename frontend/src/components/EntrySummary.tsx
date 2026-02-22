"use client";

import type { ExecuteResponse, OrderLeg } from "@/lib/api";

interface EntrySummaryProps {
    result: ExecuteResponse | null;
}

export default function EntrySummary({ result }: EntrySummaryProps) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Entry Summary
            </h3>

            {!result ? (
                <div className="rounded-lg bg-slate-800/30 border border-dashed border-white/10 p-6 text-center">
                    <p className="text-sm text-slate-500">No trades executed yet</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Meta */}
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-violet-300 ring-1 ring-violet-500/20">
                            {result.strategy.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-blue-300 ring-1 ring-blue-500/20">
                            {result.index}
                        </span>
                        <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-slate-300 ring-1 ring-slate-500/20">
                            Exp: {result.expiry}
                        </span>
                    </div>

                    {/* Entry Legs */}
                    <div>
                        <p className="text-xs text-slate-400 mb-2">Entry Legs</p>
                        <div className="space-y-2">
                            {result.legs.map((leg, i) => (
                                <LegRow key={i} leg={leg} type="entry" />
                            ))}
                        </div>
                    </div>

                    {/* SL Legs */}
                    {result.sl_legs.length > 0 && (
                        <div>
                            <p className="text-xs text-slate-400 mb-2">Stop-Loss Legs</p>
                            <div className="space-y-2">
                                {result.sl_legs.map((leg, i) => (
                                    <LegRow key={i} leg={leg} type="sl" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {result.error && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                            {result.error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function LegRow({ leg, type }: { leg: OrderLeg; type: "entry" | "sl" }) {
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
        <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2">
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
