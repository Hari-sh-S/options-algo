"use client";

import { useEffect, useState } from "react";
import { fetchPnlHistory, type PnlHistoryResponse, type DaySummary } from "@/lib/api";

interface PnlDashboardProps {
    idToken: string | null;
}

export default function PnlDashboard({ idToken }: PnlDashboardProps) {
    const [data, setData] = useState<PnlHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!idToken) return;
        setLoading(true);
        fetchPnlHistory(idToken)
            .then(setData)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [idToken]);

    const stats = data?.stats;
    const days = data?.days || [];

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Paper P&L Dashboard
            </h3>

            {loading ? (
                <div className="text-center py-6 text-slate-500 text-sm">Loading history…</div>
            ) : !stats || days.length === 0 ? (
                <div className="rounded-lg bg-slate-800/30 border border-dashed border-white/10 p-6 text-center">
                    <p className="text-sm text-slate-500">No trading history yet</p>
                    <p className="text-xs text-slate-600 mt-1">P&L summaries are saved when positions are squared off</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Aggregate Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <StatCard
                            label="Total P&L"
                            value={`₹${stats.total_pnl.toFixed(0)}`}
                            color={stats.total_pnl >= 0 ? "emerald" : "red"}
                        />
                        <StatCard
                            label="Win Rate"
                            value={`${stats.win_rate}%`}
                            color={stats.win_rate >= 50 ? "emerald" : "red"}
                        />
                        <StatCard
                            label="Best Day"
                            value={`₹${stats.best_day.toFixed(0)}`}
                            color="emerald"
                        />
                        <StatCard
                            label="Worst Day"
                            value={`₹${stats.worst_day.toFixed(0)}`}
                            color="red"
                        />
                    </div>

                    {/* Mini stats row */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{stats.total_days} days</span>
                        <span className="text-emerald-500">{stats.winning_days}W</span>
                        <span className="text-red-400">{stats.losing_days}L</span>
                        <span>{stats.total_trades} trades</span>
                    </div>

                    {/* Daily History */}
                    <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1">
                        {days.map((day) => (
                            <DayRow key={day.date} day={day} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: string; color: "emerald" | "red" }) {
    return (
        <div className="rounded-lg bg-slate-800/40 p-2.5 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-semibold mt-0.5 ${color === "emerald" ? "text-emerald-400" : "text-red-400"}`}>
                {value}
            </p>
        </div>
    );
}

function DayRow({ day }: { day: DaySummary }) {
    const pnlColor = day.total_pnl >= 0 ? "text-emerald-400" : "text-red-400";
    const barWidth = Math.min(Math.abs(day.total_pnl) / 500 * 100, 100); // scale bar relative to ₹500

    return (
        <div className="flex items-center gap-3 rounded-lg bg-slate-800/30 px-3 py-2">
            <span className="text-xs text-slate-500 font-mono w-20 shrink-0">{day.date}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                <div
                    className={`h-full rounded-full ${day.total_pnl >= 0 ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                    style={{ width: `${barWidth}%` }}
                />
            </div>
            <span className={`text-xs font-semibold w-16 text-right ${pnlColor}`}>
                {day.total_pnl >= 0 ? "+" : ""}₹{day.total_pnl.toFixed(0)}
            </span>
            <span className="text-[10px] text-slate-600 w-8 text-right">{day.num_trades}t</span>
        </div>
    );
}
