"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchJobs, cancelJob, type ScheduledJob } from "@/lib/api";

interface ScheduledJobsProps {
    idToken: string | null;
}

export default function ScheduledJobs({ idToken }: ScheduledJobsProps) {
    const [jobs, setJobs] = useState<ScheduledJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchJobs();
            setJobs(res.jobs || []);
        } catch {
            // silently fail — jobs endpoint may return empty
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        // Poll every 30s
        const interval = setInterval(refresh, 30000);
        return () => clearInterval(interval);
    }, [refresh]);

    const handleCancel = async (jobId: string) => {
        setCancelling(jobId);
        setError(null);
        try {
            await cancelJob(jobId);
            setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
        } catch (e: any) {
            const msg = typeof e?.message === "string" ? e.message : JSON.stringify(e);
            setError(msg);
        } finally {
            setCancelling(null);
        }
    };

    if (jobs.length === 0 && !loading) return null;

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Scheduled Orders
                    <span className="ml-1 rounded-full bg-amber-500/20 text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                        {jobs.length}
                    </span>
                </h3>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
                >
                    {loading ? "⟳" : "↻ Refresh"}
                </button>
            </div>

            <div className="space-y-2">
                {jobs.map((job) => (
                    <div
                        key={job.job_id}
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] p-3"
                    >
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-white">
                                    {job.strategy.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                </span>
                                <span className="text-[10px] text-slate-500">•</span>
                                <span className="text-xs text-slate-400">{job.index}</span>
                                <span className="text-[10px] text-slate-500">•</span>
                                <span className="text-xs text-slate-400">{job.lots} lot{job.lots > 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span>📅 {job.expiry}</span>
                                <span>⏰ {job.execute_at} IST</span>
                            </div>
                        </div>
                        <button
                            onClick={() => handleCancel(job.job_id)}
                            disabled={cancelling === job.job_id}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                            {cancelling === job.job_id ? "…" : "✕ Cancel"}
                        </button>
                    </div>
                ))}
            </div>

            {error && (
                <p className="text-xs text-red-400">{error}</p>
            )}
        </div>
    );
}
