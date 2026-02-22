"use client";

const steps = [
    {
        num: 1,
        title: "Connect Your API",
        desc: "Go to the API Credentials tab, enter your Dhan Client ID and Access Token, then click 'Update Data' to download the instrument master.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
        ),
        color: "from-violet-500 to-purple-600",
        ring: "ring-violet-500/30",
    },
    {
        num: 2,
        title: "Choose Paper or Live",
        desc: "Use the toggle in the Order Configuration panel. Start with Paper Trading to practice — no real money at risk.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
        ),
        color: "from-amber-500 to-orange-600",
        ring: "ring-amber-500/30",
    },
    {
        num: 3,
        title: "Select a Strategy",
        desc: "Pick from Short Straddle, Premium Based, or Spot Based Strangle. Each has different risk/reward characteristics.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        color: "from-blue-500 to-cyan-600",
        ring: "ring-blue-500/30",
    },
    {
        num: 4,
        title: "Configure Parameters",
        desc: "Choose the index (NIFTY/SENSEX), fetch expiry dates, set lot count and stop-loss percentage. For Premium Based, set a target premium.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
        ),
        color: "from-emerald-500 to-teal-600",
        ring: "ring-emerald-500/30",
    },
    {
        num: 5,
        title: "Execute & Monitor",
        desc: "Click Execute to place orders. The Entry Summary shows order status, and Live Positions tracks your P&L in real-time.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        color: "from-pink-500 to-rose-600",
        ring: "ring-pink-500/30",
    },
    {
        num: 6,
        title: "Square Off",
        desc: "When ready, use the Square Off button in Live Positions to close all open positions and cancel pending stop-loss orders.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        color: "from-indigo-500 to-violet-600",
        ring: "ring-indigo-500/30",
    },
];

const tips = [
    { emoji: "💡", text: "Always start with Paper Trading to test your strategies risk-free." },
    { emoji: "⏰", text: "Use the Scheduler to auto-execute at market open (9:15 AM IST)." },
    { emoji: "🛡️", text: "Set SL% to 30-50% for short straddles to limit downside risk." },
    { emoji: "📊", text: "Monitor Live Positions tab after execution for real-time P&L." },
];

export default function HelpTab() {
    return (
        <div className="mx-auto max-w-3xl space-y-8">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">How to Use</h2>
                <p className="text-sm text-slate-400">
                    Follow these steps to start trading options with the portal
                </p>
            </div>

            {/* Steps */}
            <div className="relative space-y-4">
                {/* Vertical line */}
                <div className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/50 via-blue-500/30 to-transparent" />

                {steps.map((step) => (
                    <div key={step.num} className="relative flex gap-4 group">
                        {/* Number circle */}
                        <div
                            className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} shadow-lg ring-1 ${step.ring} group-hover:scale-110 transition-transform duration-300`}
                        >
                            <span className="text-white font-bold text-lg">{step.num}</span>
                        </div>

                        {/* Content Card */}
                        <div className="flex-1 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/[0.08] transition-all duration-300">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-white/70">{step.icon}</span>
                                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tips */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">💎 Pro Tips</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tips.map((tip, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-2 rounded-lg bg-white/5 ring-1 ring-white/10 p-3"
                        >
                            <span className="text-lg">{tip.emoji}</span>
                            <p className="text-xs text-slate-300 leading-relaxed">{tip.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
