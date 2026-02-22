"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    fetchMarketStatus,
    fetchSpot,
    fetchPositions,
    type MarketStatus,
    type SpotPrice,
    type PositionsResponse,
    type Credentials,
} from "@/lib/api";

/**
 * Poll market status every 10 seconds (no Dhan API call — lightweight).
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
 * Poll spot prices for BOTH indices in a single hook with staggered requests.
 * Uses a 15-second interval to stay well within Dhan's rate limits.
 * Each index is fetched sequentially with a 2-second gap between them.
 */
export function useSpotPrices(creds: Credentials | null) {
    const [nifty, setNifty] = useState<SpotPrice | null>(null);
    const [sensex, setSensex] = useState<SpotPrice | null>(null);
    const credsRef = useRef(creds);
    credsRef.current = creds;

    useEffect(() => {
        if (!credsRef.current?.client_id) return;
        let active = true;

        const poll = async () => {
            if (!credsRef.current?.client_id) return;

            // Fetch NIFTY
            try {
                const res = await fetchSpot("NIFTY", credsRef.current);
                if (active) setNifty(res);
            } catch {
                /* ignore */
            }

            // Stagger: wait 2s before SENSEX to avoid rate limiting
            await new Promise((r) => setTimeout(r, 2000));

            if (!active) return;

            // Fetch SENSEX
            try {
                if (!credsRef.current?.client_id) return;
                const res = await fetchSpot("SENSEX", credsRef.current);
                if (active) setSensex(res);
            } catch {
                /* ignore */
            }
        };

        poll();
        const id = setInterval(poll, 15000); // Every 15 seconds
        return () => { active = false; clearInterval(id); };
    }, [creds?.client_id]);

    return { nifty, sensex };
}

/**
 * Poll open positions every 15 seconds.
 */
export function usePositions(creds: Credentials | null) {
    const [data, setData] = useState<PositionsResponse | null>(null);
    const credsRef = useRef(creds);
    credsRef.current = creds;

    const refresh = useCallback(async () => {
        if (!credsRef.current?.client_id) return;
        try {
            const res = await fetchPositions(credsRef.current);
            setData(res);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, 15000);
        return () => clearInterval(id);
    }, [refresh, creds?.client_id]);

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
