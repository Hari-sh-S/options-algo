"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function ProfileTab() {
    const { user, loading, signInWithGoogle, signOut } = useAuth();

    if (loading) {
        return (
            <div className="mx-auto max-w-lg text-center py-12">
                <p className="text-sm text-slate-400">Loading…</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-lg space-y-6">
            {/* Profile Card */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6 text-center">
                {/* Avatar */}
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/25 overflow-hidden">
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : user ? (
                        <span className="text-3xl font-bold text-white">
                            {(user.displayName || "U").charAt(0).toUpperCase()}
                        </span>
                    ) : (
                        <svg className="w-10 h-10 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                    )}
                </div>

                {user ? (
                    <>
                        <h2 className="text-lg font-bold text-white mb-0.5">{user.displayName || "Trader"}</h2>
                        <p className="text-xs text-slate-400 mb-4">{user.email}</p>
                        <button
                            onClick={signOut}
                            className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 transition-all"
                        >
                            Sign Out
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-lg font-bold text-white mb-1">Welcome</h2>
                        <p className="text-xs text-slate-400 mb-5">
                            Sign in to save your API credentials securely
                        </p>
                        <button
                            onClick={signInWithGoogle}
                            className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 hover:scale-[1.02] transition-all shadow-lg"
                        >
                            {/* Google icon */}
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Sign in with Google
                        </button>
                    </>
                )}
            </div>

            {/* Account Details */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Account Info
                </h3>

                <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-white/5 ring-1 ring-white/10 p-3">
                        <span className="text-xs text-slate-400">Status</span>
                        <span
                            className={`rounded-full px-3 py-0.5 text-xs font-semibold ${user
                                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                                    : "bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30"
                                }`}
                        >
                            {user ? "Signed In" : "Not Connected"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/5 ring-1 ring-white/10 p-3">
                        <span className="text-xs text-slate-400">Plan</span>
                        <span className="rounded-full bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30 px-3 py-0.5 text-xs font-semibold">
                            Free
                        </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/5 ring-1 ring-white/10 p-3">
                        <span className="text-xs text-slate-400">Version</span>
                        <span className="text-xs text-slate-300 font-mono">v1.0.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
