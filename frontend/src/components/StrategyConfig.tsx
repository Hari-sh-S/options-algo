"use client";

import { useState, useEffect } from "react";
import {
    fetchExpiries,
    executeOrder,
    scheduleJob,
    type Credentials,
    type ExecuteResponse,
} from "@/lib/api";

const STRATEGIES = [
    { value: "short_straddle", label: "Short Straddle", desc: "Sell ATM Call & Put at same strike" },
    { value: "premium_based", label: "Premium Based", desc: "Select strikes based on target premium" },
    { value: "spot_strangle", label: "Spot Based Strangle", desc: "Select OTM strikes at % from spot" },
] as const;

type StrategyValue = (typeof STRATEGIES)[number]["value"];

const INDICES = [
    { value: "NIFTY", label: "NIFTY", lot: 25 },
    { value: "SENSEX", label: "SENSEX", lot: 20 },
] as const;

interface StrategyConfigProps {
    creds: Credentials;
    onExecuted: (result: ExecuteResponse) => void;
}

export default function StrategyConfig({ creds, onExecuted }: StrategyConfigProps) {
    const [strategy, setStrategy] = useState<StrategyValue>(STRATEGIES[0].value);
    const [index, setIndex] = useState<"NIFTY" | "SENSEX">("NIFTY");
    const [expiries, setExpiries] = useState<string[]>([]);
    const [expiry, setExpiry] = useState("");
    const [lots, setLots] = useState(1);
    const [slPercent, setSlPercent] = useState(30);
    const [targetPremium, setTargetPremium] = useState(100);
    const [spotPercent, setSpotPercent] = useState(1);
    const [loading, setLoading] = useState(false);
    const [fetchingExpiries, setFetchingExpiries] = useState(false);
    const [showScheduler, setShowScheduler] = useState(false);
    const [scheduleTime, setScheduleTime] = useState("09:30:00");
    const [error, setError] = useState<string | null>(null);

    const currentLot = INDICES.find((i) => i.value === index)?.lot || 75;
    const totalQty = lots * currentLot;

    const handleFetchExpiries = async () => {
        setFetchingExpiries(true);
        setError(null);
        try {
            const res = await fetchExpiries(index);
            setExpiries(res.expiries);
            if (res.expiries.length > 0) setExpiry(res.expiries[0]);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setFetchingExpiries(false);
        }
    };

    const handleExecute = async () => {
        if (!creds.client_id || !creds.access_token) {
            setError("Enter Dhan credentials first.");
            return;
        }
        if (!expiry) {
            setError("Fetch & select an expiry date first.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const payload = {
                ...creds,
                strategy,
                index,
                expiry,
                lots,
                sl_percent: slPercent,
                target_premium: strategy === "premium_based" ? targetPremium : null,
                spot_percent: strategy === "spot_strangle" ? spotPercent : null,
            };
            const res = await executeOrder(payload);
            onExecuted(res);
            if (res.error) setError(res.error);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSchedule = async () => {
        if (!creds.client_id || !creds.access_token) {
            setError("Enter Dhan credentials first.");
            return;
        }
        if (!expiry) {
            setError("Fetch & select an expiry date first.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await scheduleJob({
                ...creds,
                strategy,
                index,
                expiry,
                lots,
                sl_percent: slPercent,
                target_premium: strategy === "premium_based" ? targetPremium : null,
                spot_percent: strategy === "spot_strangle" ? spotPercent : null,
                execute_at: scheduleTime,
            });
            setShowScheduler(false);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-5">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Order Configuration
            </h3>

            {/* Strategy Selector */}
            <div>
                <label className="block text-xs text-slate-400 mb-2">Strategy</label>
                <div className="space-y-2">
                    {STRATEGIES.map((s) => (
                        <label
                            key={s.value}
                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${strategy === s.value
                                ? "border-violet-500/50 bg-violet-500/10"
                                : "border-white/5 bg-white/[0.02] hover:border-white/10"
                                }`}
                        >
                            <input
                                type="radio"
                                name="strategy"
                                value={s.value}
                                checked={strategy === s.value}
                                onChange={() => setStrategy(s.value)}
                                className="mt-0.5 accent-violet-500"
                            />
                            <div>
                                <span className="text-sm font-medium text-white">{s.label}</span>
                                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* Index */}
            <div>
                <label className="block text-xs text-slate-400 mb-1">Underlying Index</label>
                <select
                    value={index}
                    onChange={(e) => { setIndex(e.target.value as "NIFTY" | "SENSEX"); setExpiries([]); setExpiry(""); }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                    {INDICES.map((i) => (
                        <option key={i.value} value={i.value} className="bg-slate-900">
                            {i.label} (Lot: {i.lot})
                        </option>
                    ))}
                </select>
            </div>

            {/* Expiry */}
            <div>
                <label className="block text-xs text-slate-400 mb-1">Expiry Date</label>
                <div className="flex gap-2">
                    <select
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        disabled={expiries.length === 0}
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-40"
                    >
                        {expiries.length === 0 ? (
                            <option className="bg-slate-900">Fetch expiries first</option>
                        ) : (
                            expiries.map((e) => (
                                <option key={e} value={e} className="bg-slate-900">{e}</option>
                            ))
                        )}
                    </select>
                    <button
                        onClick={handleFetchExpiries}
                        disabled={fetchingExpiries}
                        className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition-all disabled:opacity-50"
                    >
                        {fetchingExpiries ? "…" : "Fetch"}
                    </button>
                </div>
            </div>

            {/* Lots */}
            <div>
                <label className="block text-xs text-slate-400 mb-1">Number of Lots</label>
                <input
                    type="number"
                    min={1}
                    value={lots}
                    onChange={(e) => setLots(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <p className="text-xs text-slate-500 mt-1">
                    Total quantity: <span className="text-violet-300 font-semibold">{totalQty}</span>
                </p>
            </div>

            {/* SL % */}
            <div>
                <label className="block text-xs text-slate-400 mb-1">Stop Loss %</label>
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={slPercent}
                    onChange={(e) => setSlPercent(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <p className="text-xs text-slate-500 mt-1">
                    Stop loss will trigger at entry price + {slPercent}%
                </p>
            </div>

            {/* Strategy-specific fields */}
            {strategy === "premium_based" && (
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Target Premium (₹)</label>
                    <input
                        type="number"
                        min={1}
                        step={0.5}
                        value={targetPremium}
                        onChange={(e) => setTargetPremium(Number(e.target.value))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                </div>
            )}

            {strategy === "spot_strangle" && (
                <div>
                    <label className="block text-xs text-slate-400 mb-1">OTM Distance (%)</label>
                    <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={spotPercent}
                        onChange={(e) => setSpotPercent(Number(e.target.value))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        CE at +{spotPercent}% from spot, PE at -{spotPercent}%
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                    {error}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
                <button
                    onClick={handleExecute}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                    {loading ? "Executing…" : "⚡ Execute Now"}
                </button>
                <button
                    onClick={() => setShowScheduler(!showScheduler)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 transition-all"
                >
                    🕐 Later
                </button>
            </div>

            {/* Scheduler */}
            {showScheduler && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                    <label className="block text-xs text-slate-400">Schedule execution at (IST):</label>
                    <input
                        type="time"
                        step="1"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                    <button
                        onClick={handleSchedule}
                        disabled={loading}
                        className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50"
                    >
                        {loading ? "Scheduling…" : "Schedule Job"}
                    </button>
                </div>
            )}
        </div>
    );
}
