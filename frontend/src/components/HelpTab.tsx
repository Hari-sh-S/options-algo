"use client";

const setupSteps = [
    {
        num: 1,
        title: "Generate Dhan API Key",
        desc: (
            <>
                Go to{" "}
                <a href="https://web.dhan.co" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">
                    web.dhan.co
                </a>{" "}
                → <strong>My Profile</strong> → <strong>Access DhanHQ APIs</strong> → switch to the <strong>API Key</strong> tab.
            </>
        ),
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
        title: "Set Redirect URL",
        desc: (
            <>
                Enter Application Name (e.g. <em>Options Portal</em>) and Redirect URL:{" "}
                <code className="bg-white/10 px-1.5 py-0.5 rounded text-violet-300 text-[11px]">
                    https://optioni.web.app/auth/dhan/callback
                </code>
                {" "}→ click <strong>Generate API Key</strong>.
            </>
        ),
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
        ),
        color: "from-blue-500 to-cyan-600",
        ring: "ring-blue-500/30",
    },
    {
        num: 3,
        title: "Save Credentials Here",
        desc: "Copy your Client ID, App ID (API Key), and App Secret. Go to the API Credentials tab and save them.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
        ),
        color: "from-emerald-500 to-teal-600",
        ring: "ring-emerald-500/30",
    },
    {
        num: 4,
        title: "Login with Dhan",
        desc: "Click the 'Login with Dhan' button. You'll be redirected to Dhan's login page. After logging in, you'll be automatically redirected back with an active token (valid 24h).",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
        ),
        color: "from-amber-500 to-orange-600",
        ring: "ring-amber-500/30",
    },
    {
        num: 5,
        title: "Choose Paper or Live",
        desc: "Use the toggle in the Order Configuration panel. Start with Paper Trading to practice — no real money at risk.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
        ),
        color: "from-pink-500 to-rose-600",
        ring: "ring-pink-500/30",
    },
    {
        num: 6,
        title: "Execute & Monitor",
        desc: "Select a strategy, configure parameters, and click Execute. Monitor your positions and P&L in real-time on the Dashboard.",
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        color: "from-indigo-500 to-violet-600",
        ring: "ring-indigo-500/30",
    },
];

const tips = [
    { emoji: "🔑", text: "API Key & App Secret are permanent — save them once. Only the access token refreshes daily via 'Login with Dhan'." },
    { emoji: "💡", text: "Always start with Paper Trading to test your strategies risk-free." },
    { emoji: "⏰", text: "Use the Scheduler to auto-execute at market open (9:15 AM IST)." },
    { emoji: "🛡️", text: "Set SL% to 30-50% for short straddles to limit downside risk." },
];

export default function HelpTab() {
    return (
        <div className="mx-auto max-w-3xl space-y-8">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Getting Started</h2>
                <p className="text-sm text-slate-400">
                    Follow these steps to connect your Dhan account and start trading
                </p>
            </div>

            {/* Steps */}
            <div className="relative space-y-4">
                {/* Vertical line */}
                <div className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/50 via-blue-500/30 to-transparent" />

                {setupSteps.map((step) => (
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
