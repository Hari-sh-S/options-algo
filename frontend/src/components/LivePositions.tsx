"use client";

import { useState, useEffect } from "react";
import {
    squareOffAll,
    setAutoSquareoff,
    getAutoSquareoff,
    cancelAutoSquareoff,
    type PositionsResponse,
} from "@/lib/api";

interface LivePositionsProps {
    idToken: string | null;
    data: PositionsResponse | null;
    onRefresh: () => void;
}

export default function LivePositions({ idToken, data, onRefresh }: LivePositionsProps) {
    const [squaringOff, setSquaringOff] = useState(false);
    const [autoTime, setAutoTime] = useState("15:15");
    const [autoActive, setAutoActive] = useState(false);
    const [autoAt, setAutoAt] = useState<string | null>(null);
    const [settingAuto, setSettingAuto] = useState(false);

    // Load auto square-off status on mount
    useEffect(() => {
        if (!idToken) return;
        getAutoSquareoff(idToken)
            .then((status) => {
                setAutoActive(status.active);
                if (status.squareoff_at) setAutoAt(status.squareoff_at);
            })
            .catch(() => { });
    }, [idToken]);

    const handleSquareOff = async () => {
        if (!idToken) return;
        if (!confirm("Square off ALL open positions? This action is irreversible.")) return;
        setSquaringOff(true);
        try {
            await squareOffAll(idToken);
            onRefresh();
        } catch {
            /* ignore */
        } finally {
            setSquaringOff(false);
        }
    };

    const handleSetAuto = async () => {
        if (!idToken) return;
        setSettingAuto(true);
        try {
            const result = await setAutoSquareoff(autoTime + ":00", idToken);
            setAutoActive(true);
            setAutoAt(result.squareoff_at);
        } catch {
            /* ignore */
        } finally {
            setSettingAuto(false);
        }
    };

    const handleCancelAuto = async () => {
        if (!idToken) return;
        try {
            await cancelAutoSquareoff(idToken);
            setAutoActive(false);
            setAutoAt(null);
        } catch {
            /* ignore */
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

            {/* Auto Square-Off */}
            <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-slate-400">Auto Square-Off</span>
                    </div>

                    {autoActive ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-400">
                                ⏰ {autoAt ? new Date(autoAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : autoTime}
                            </span>
                            <button
                                onClick={handleCancelAuto}
                                className="text-[10px] text-red-400 hover:text-red-300 underline"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                value={autoTime}
                                onChange={(e) => setAutoTime(e.target.value)}
                                className="rounded bg-slate-800/60 border border-white/10 px-2 py-1 text-xs text-white w-24 [color-scheme:dark]"
                            />
                            <button
                                onClick={handleSetAuto}
                                disabled={settingAuto}
                                className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                            >
                                {settingAuto ? "…" : "Set"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
