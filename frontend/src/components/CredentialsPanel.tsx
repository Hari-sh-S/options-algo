"use client";

import { useState } from "react";
import { updateData, type Credentials } from "@/lib/api";

interface CredentialsPanelProps {
    creds: Credentials;
    onChange: (c: Credentials) => void;
}

export default function CredentialsPanel({ creds, onChange }: CredentialsPanelProps) {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const handleUpdate = async () => {
        if (!creds.client_id || !creds.access_token) {
            setMsg("Enter both Client ID and Access Token first.");
            return;
        }
        setLoading(true);
        setMsg(null);
        try {
            const res = await updateData(creds);
            setMsg(res.message);
        } catch (e: any) {
            setMsg(e.message || "Update failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Dhan API Credentials
            </h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Client ID</label>
                    <input
                        type="text"
                        value={creds.client_id}
                        onChange={(e) => onChange({ ...creds, client_id: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        placeholder="e.g. 1234567890"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Access Token</label>
                    <input
                        type="password"
                        value={creds.access_token}
                        onChange={(e) => onChange({ ...creds, access_token: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        placeholder="Paste your access token"
                    />
                </div>
                <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Downloading…
                        </span>
                    ) : (
                        "Update Data"
                    )}
                </button>
                {msg && (
                    <p className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-2 mt-1">{msg}</p>
                )}
            </div>
        </div>
    );
}
