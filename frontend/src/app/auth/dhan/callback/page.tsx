"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { completeDhanCallback } from "@/lib/api";

function CallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { idToken, loading } = useAuth();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [message, setMessage] = useState("Connecting to Dhan…");

    useEffect(() => {
        const tokenId = searchParams.get("tokenId");

        if (loading) return;

        if (!tokenId) {
            setStatus("error");
            setMessage("No tokenId found in URL. Please try logging in again.");
            return;
        }

        if (!idToken) {
            setStatus("error");
            setMessage("You are not signed in. Please sign in first and try again.");
            return;
        }

        completeDhanCallback(tokenId, idToken)
            .then((res) => {
                setStatus("success");
                setMessage(res.message || "Dhan connected successfully!");
                setTimeout(() => router.push("/"), 2000);
            })
            .catch((err) => {
                setStatus("error");
                setMessage(err.message || "Failed to connect Dhan. Please try again.");
            });
    }, [searchParams, idToken, loading, router]);

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center max-w-md mx-4">
            {status === "processing" && (
                <>
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <svg className="animate-spin h-6 w-6 text-blue-400" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">Connecting to Dhan</h2>
                </>
            )}

            {status === "success" && (
                <>
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">Connected!</h2>
                </>
            )}

            {status === "error" && (
                <>
                    <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">Connection Failed</h2>
                </>
            )}

            <p className="text-sm text-slate-400 mb-4">{message}</p>

            {status !== "processing" && (
                <button
                    onClick={() => router.push("/")}
                    className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white hover:bg-white/15 transition-all"
                >
                    Go to Dashboard
                </button>
            )}
        </div>
    );
}

export default function DhanCallbackPage() {
    return (
        <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
            <Suspense
                fallback={
                    <div className="text-center text-slate-400">
                        <svg className="animate-spin mx-auto h-8 w-8 mb-2 text-blue-400" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading…
                    </div>
                }
            >
                <CallbackContent />
            </Suspense>
        </div>
    );
}
