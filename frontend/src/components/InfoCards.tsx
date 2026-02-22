"use client";

const features = [
    {
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        title: "One-Click Execution",
        desc: "Execute complex multi-leg option strategies with a single click.",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        ring: "ring-amber-500/20",
    },
    {
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        title: "3 Strategies",
        desc: "Short Straddle, Premium Based, and Spot Based Strangle.",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        ring: "ring-blue-500/20",
    },
    {
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
        title: "Auto Stop-Loss",
        desc: "SL orders placed only after confirmed entry fills.",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        ring: "ring-emerald-500/20",
    },
    {
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
        ),
        title: "Live Monitoring",
        desc: "Track positions and P&L in real-time post execution.",
        color: "text-violet-400",
        bg: "bg-violet-500/10",
        ring: "ring-violet-500/20",
    },
    {
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        title: "Scheduling",
        desc: "Schedule trades for a specific time — executes at live market conditions.",
        color: "text-pink-400",
        bg: "bg-pink-500/10",
        ring: "ring-pink-500/20",
    },
];

export default function InfoCards() {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Features</h3>
            <div className="grid grid-cols-1 gap-3">
                {features.map((f) => (
                    <div
                        key={f.title}
                        className={`flex items-start gap-3 rounded-lg ${f.bg} ring-1 ${f.ring} p-3 hover:scale-[1.02] transition-transform`}
                    >
                        <div className={f.color}>{f.icon}</div>
                        <div>
                            <p className="text-sm font-medium text-white">{f.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
