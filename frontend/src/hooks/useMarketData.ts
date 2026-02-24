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
 * Poll market status every 10 seconds (no auth needed).
 */
export function useMarketStatus() {
    const [data, setData] = useState<MarketStatus | null>(null);
    useEffect(() => {
        let active = true;
        const poll = async () => {
            try {
                const res = await fetchMarketStatus();
                if (active) setData(res);
            } catch {
                /* ignore */
            }
        };
        poll();
        const id = setInterval(poll, 10000);
        return () => { active = false; clearInterval(id); };
    }, []);
    return data;
}

/**
 * Poll spot prices for BOTH indices. Uses Firebase ID token for auth.
 */
export function useSpotPrices(idToken: string | null) {
    const [nifty, setNifty] = useState<SpotPrice | null>(null);
    const [sensex, setSensex] = useState<SpotPrice | null>(null);
    const tokenRef = useRef(idToken);
    tokenRef.current = idToken;

    useEffect(() => {
        if (!tokenRef.current) return;
        let active = true;

        const poll = async () => {
            if (!tokenRef.current) return;

            try {
                const res = await fetchSpot("NIFTY", tokenRef.current);
                if (active) setNifty(res);
            } catch {
                /* ignore */
            }

            await new Promise((r) => setTimeout(r, 2000));
            if (!active) return;

            try {
                if (!tokenRef.current) return;
                const res = await fetchSpot("SENSEX", tokenRef.current);
                if (active) setSensex(res);
            } catch {
                /* ignore */
            }
        };

        poll();
        const id = setInterval(poll, 15000);
        return () => { active = false; clearInterval(id); };
    }, [idToken]);

    return { nifty, sensex };
}

/**
 * Poll open positions every 15 seconds. Uses Firebase ID token for auth.
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
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, 5000);
        return () => clearInterval(id);
    }, [refresh, idToken]);

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
