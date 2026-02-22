"use client";

import { useState } from "react";
import { squareOffAll, type Credentials, type PositionsResponse } from "@/lib/api";

interface LivePositionsProps {
    creds: Credentials;
    data: PositionsResponse | null;
    onRefresh: () => void;
}

export default function LivePositions({ creds, data, onRefresh }: LivePositionsProps) {
    const [squaringOff, setSquaringOff] = useState(false);

    const handleSquareOff = async () => {
        if (!confirm("Square off ALL open positions? This action is irreversible.")) return;
        setSquaringOff(true);
        try {
            await squareOffAll(creds);
            onRefresh();
        } catch {
            /* ignore */
        } finally {
            setSquaringOff(false);
        }
    };

    const positions = data?.positions || [];
    const totalPnl = data?.total_pnl || 0;

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Live Positions
                </h3>
                {positions.length > 0 && (
                    <button
                        onClick={handleSquareOff}
                        disabled={squaringOff}
                        className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                        {squaringOff ? "Closing…" : "Square-Off All"}
                    </button>
                )}
            </div>

            {positions.length === 0 ? (
                <div className="rounded-lg bg-slate-800/30 border border-dashed border-white/10 p-6 text-center">
                    <p className="text-sm text-slate-500">No open positions</p>
                </div>
            ) : (
                <>
                    <div className="space-y-2 mb-4">
                        {positions.map((pos, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2.5"
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${pos.option_type === "CE"
                                                ? "bg-emerald-500/20 text-emerald-300"
                                                : "bg-red-500/20 text-red-300"
                                            }`}
                                    >
                                        {pos.option_type || "?"}
                                    </span>
                                    <div>
                                        <p className="text-sm font-mono text-white">{pos.symbol || pos.security_id}</p>
                                        <p className="text-[11px] text-slate-500">
                                            Qty: {pos.quantity} · Avg: ₹{pos.avg_price.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-mono text-slate-300">₹{pos.ltp.toFixed(2)}</p>
                                    <p
                                        className={`text-xs font-semibold ${pos.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                                            }`}
                                    >
                                        {pos.pnl >= 0 ? "+" : ""}₹{pos.pnl.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total P&L */}
                    <div
                        className={`rounded-lg p-3 text-center font-semibold ${totalPnl >= 0
                                ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                                : "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                            }`}
                    >
                        Total P&L: {totalPnl >= 0 ? "+" : ""}₹{totalPnl.toFixed(2)}
                    </div>
                </>
            )}
        </div>
    );
}
