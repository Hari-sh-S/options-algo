"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    fetchMarketStatus,
    fetchSpot,
    fetchPositions,
    type MarketStatus,
    type SpotPrice,
    type PositionsResponse,
} from "@/lib/api";

/**
 * Hook that pauses an interval when the page is hidden (iOS tab switch)
 * and resumes when the page becomes visible again.
 * This prevents stacked simultaneous API calls crashing iOS on resume.
 */
function useVisibilityInterval(callback: () => void, delay: number) {
    const savedCallback = useRef(callback);
    savedCallback.current = callback;

    useEffect(() => {
        let id: ReturnType<typeof setInterval> | null = null;

        const start = () => {
            if (id === null) {
                id = setInterval(() => savedCallback.current(), delay);
            }
        };

        const stop = () => {
            if (id !== null) {
                clearInterval(id);
                id = null;
            }
        };

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                // Immediately refresh on tab return, then restart interval
                savedCallback.current();
                start();
            } else {
                stop();
            }
        };

        start();
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            stop();
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [delay]);
}

/**
 * Poll market status every 10 seconds (no auth needed).
 */
export function useMarketStatus() {
    const [data, setData] = useState<MarketStatus | null>(null);
    const poll = useCallback(async () => {
        try {
            const res = await fetchMarketStatus();
            setData(res);
        } catch { /* ignore */ }
    }, []);

    useVisibilityInterval(poll, 10000);
    useEffect(() => { poll(); }, [poll]);
    return data;
}

/**
 * Poll spot prices for BOTH indices sequentially (2s gap between) to stay
 * within Dhan's 1-req/sec quote rate limit. Pauses when tab is hidden.
 */
export function useSpotPrices(idToken: string | null) {
    const [nifty, setNifty] = useState<SpotPrice | null>(null);
    const [sensex, setSensex] = useState<SpotPrice | null>(null);
    const tokenRef = useRef(idToken);
    tokenRef.current = idToken;

    const [token, setToken] = useState(idToken);
    useEffect(() => { setToken(idToken); }, [idToken]);

    const poll = useCallback(async () => {
        if (!tokenRef.current) return;
        try {
            const res = await fetchSpot("NIFTY", tokenRef.current);
            setNifty(res);
        } catch { /* ignore */ }

        // 2s gap so NIFTY and SENSEX calls don't burst together
        await new Promise((r) => setTimeout(r, 2000));
        if (!tokenRef.current) return;

        try {
            const res = await fetchSpot("SENSEX", tokenRef.current);
            setSensex(res);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (!token) return;
        poll();
    }, [token, poll]);

    useVisibilityInterval(poll, 15000);

    return { nifty, sensex };
}

/**
 * Poll open positions every 5 seconds. Pauses when tab is hidden.
 */
export function usePositions(idToken: string | null) {
    const [data, setData] = useState<PositionsResponse | null>(null);
    const tokenRef = useRef(idToken);
    tokenRef.current = idToken;

    const refresh = useCallback(async () => {
        if (!tokenRef.current) return;
        try {
            const res = await fetchPositions(tokenRef.current);
            setData(res);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (!idToken) return;
        refresh();
    }, [idToken, refresh]);

    useVisibilityInterval(refresh, 5000);

    return { data, refresh };
}

/**
 * Client-side clock that updates every second.
 */
export function useClock() {
    const [time, setTime] = useState("");
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setTime(
                now.toLocaleTimeString("en-IN", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZone: "Asia/Kolkata",
                })
            );
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);
    return time;
}
