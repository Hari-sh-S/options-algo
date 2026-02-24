"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    saveCredentials,
    fetchCredentialStatus,
    deleteCredentials,
    initiateDhanLogin,
    type CredentialStatus,
} from "@/lib/api";

export default function CredentialsPanel() {
    const { idToken, user } = useAuth();
    const [clientId, setClientId] = useState("");
    const [appId, setAppId] = useState("");
    const [appSecret, setAppSecret] = useState("");
    const [status, setStatus] = useState<CredentialStatus | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editing, setEditing] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    // Fetch credential status when signed in
    useEffect(() => {
        if (!idToken) return;
        fetchCredentialStatus(idToken)
            .then(setStatus)
            .catch(() => { });
    }, [idToken]);

    const handleSave = async () => {
        if (!idToken) {
            setMsg("Sign in first (go to Profile tab).");
            return;
        }
        if (!clientId.trim() || !appId.trim() || !appSecret.trim()) {
            setMsg("All three fields are required.");
            return;
        }
        setSaving(true);
        setMsg(null);
        try {
            await saveCredentials(
                {
                    client_id: clientId.trim(),
                    app_id: appId.trim(),
                    app_secret: appSecret.trim(),
                },
                idToken
            );
            setMsg("✓ Credentials saved securely!");
            setClientId("");
            setAppId("");
            setAppSecret("");
            setEditing(false);
            const s = await fetchCredentialStatus(idToken);
            setStatus(s);
        } catch (e: any) {
            const errMsg = typeof e?.message === "string" ? e.message : JSON.stringify(e);
            setMsg(`Error: ${errMsg}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!idToken) return;
        setDeleting(true);
        setMsg(null);
        try {
            await deleteCredentials(idToken);
            setStatus(null);
            setShowConfirmDelete(false);
            setEditing(false);
            setMsg("✓ All credentials deleted.");
        } catch (e: any) {
            const errMsg = typeof e?.message === "string" ? e.message : JSON.stringify(e);
            setMsg(`Error: ${errMsg}`);
        } finally {
            setDeleting(false);
        }
    };

    const handleDhanLogin = async () => {
        if (!idToken) {
            setMsg("Sign in first.");
            return;
        }
        setConnecting(true);
        setMsg(null);
        try {
            const { login_url } = await initiateDhanLogin(idToken);
            window.location.href = login_url;
        } catch (e: any) {
            const errMsg = typeof e?.message === "string" ? e.message : JSON.stringify(e);
            setMsg(`Error: ${errMsg}`);
            setConnecting(false);
        }
    };

    if (!user) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6 text-center">
                <svg className="mx-auto mb-3 w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="text-sm text-slate-400">
                    Sign in via the <strong className="text-slate-300">Profile</strong> tab first to manage your credentials.
                </p>
            </div>
        );
    }

    const showForm = !status?.has_api_key || editing;

    return (
        <div className="space-y-5">
            {/* Status cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">API Key</p>
                    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${status?.has_api_key
                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                            : "bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30"
                        }`}>
                        {status?.has_api_key ? "✓ Saved" : "Not Set"}
                    </span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Access Token</p>
                    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${status?.has_access_token
                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                        }`}>
                        {status?.has_access_token ? "✓ Active" : "Login Required"}
                    </span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Dhan Auth</p>
                    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${status?.has_api_key && status?.has_access_token
                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                            : status?.has_api_key
                                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                                : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                        }`}>
                        {status?.has_api_key && status?.has_access_token
                            ? "✓ Connected"
                            : status?.has_api_key
                                ? "⚠ Token Expired"
                                : "✗ Not Set"}
                    </span>
                </div>
            </div>

            {/* Client ID preview */}
            {status?.has_credentials && status?.client_id_preview && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-xs text-slate-400">Client ID: <strong className="text-slate-300">{status.client_id_preview}</strong></span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditing(!editing)}
                            className="rounded-md bg-white/5 border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 transition-all"
                        >
                            ✏️ Edit
                        </button>
                        <button
                            onClick={() => setShowConfirmDelete(true)}
                            className="rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-all"
                        >
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {showConfirmDelete && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
                    <p className="text-sm text-red-300 font-medium">⚠️ Delete all stored credentials?</p>
                    <p className="text-xs text-red-400/70">This will remove your Client ID, API Key, App Secret, and access token from the server.</p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-all disabled:opacity-50"
                        >
                            {deleting ? "Deleting…" : "Yes, Delete Everything"}
                        </button>
                        <button
                            onClick={() => setShowConfirmDelete(false)}
                            className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/15 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Login with Dhan button */}
            {status?.has_api_key && !editing && (
                <button
                    onClick={handleDhanLogin}
                    disabled={connecting}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                    {connecting ? (
                        <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Connecting…
                        </>
                    ) : (
                        <>
                            🔗 {status.has_access_token ? "Refresh Dhan Token" : "Login with Dhan"}
                        </>
                    )}
                </button>
            )}

            {/* Save/Edit credentials form */}
            {showForm && (
                <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        {editing ? "Update Dhan API Key" : "Save Dhan API Key"}
                    </h3>
                    <p className="text-xs text-slate-400">
                        Enter your Client ID, API Key (App ID), and App Secret from Dhan. See the <strong className="text-slate-300">Help</strong> tab for setup instructions.
                    </p>

                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Client ID"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                        <input
                            type="text"
                            placeholder="App ID (API Key)"
                            value={appId}
                            onChange={(e) => setAppId(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                        <input
                            type="password"
                            placeholder="App Secret"
                            value={appSecret}
                            onChange={(e) => setAppSecret(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {saving ? "Saving…" : editing ? "Update Credentials" : "Save Credentials Securely"}
                        </button>
                        {editing && (
                            <button
                                onClick={() => { setEditing(false); setClientId(""); setAppId(""); setAppSecret(""); setMsg(null); }}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Message */}
            {msg && (
                <p className={`text-xs text-center font-medium ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                    {msg}
                </p>
            )}

            {/* Info */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                    🔒 Your credentials are stored encrypted in Firestore and never leave the server.
                    Access tokens auto-refresh when you click "Login with Dhan".
                </p>
            </div>
        </div>
    );
}
