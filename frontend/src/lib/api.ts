/**
 * API client — centralised fetch wrapper pointing at the FastAPI backend.
 *
 * In production (Firebase Hosting), API_BASE is empty because /api/* is
 * rewritten to Cloud Run on the same domain.  During local dev it falls
 * back to the local FastAPI server.
 */

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? ""
        : "http://127.0.0.1:8000");

export interface Credentials {
    client_id: string;
    access_token: string;
}

// ── Market ────────────────────────────────────────────────────────────────

export interface MarketStatus {
    is_open: boolean;
    current_time: string;
    status_label: string;
}

export interface SpotPrice {
    index: string;
    ltp: number;
    timestamp: string;
}

export interface ExpiriesResponse {
    index: string;
    expiries: string[];
}

export async function fetchMarketStatus(): Promise<MarketStatus> {
    const res = await fetch(`${API_BASE}/api/market/status`);
    if (!res.ok) throw new Error("Failed to fetch market status");
    return res.json();
}

export async function fetchSpot(
    index: string,
    creds: Credentials
): Promise<SpotPrice> {
    const params = new URLSearchParams({
        index,
        client_id: creds.client_id,
        access_token: creds.access_token,
    });
    const res = await fetch(`${API_BASE}/api/market/spot?${params}`);
    if (!res.ok) throw new Error("Failed to fetch spot price");
    return res.json();
}

export async function fetchExpiries(index: string): Promise<ExpiriesResponse> {
    const res = await fetch(`${API_BASE}/api/market/expiries?index=${index}`);
    if (!res.ok) throw new Error("Failed to fetch expiries");
    return res.json();
}

export async function updateData(creds: Credentials): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/market/update-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update data");
    }
    return res.json();
}

// ── Orders ────────────────────────────────────────────────────────────────

export interface OrderLeg {
    leg: string;
    strike: number;
    premium?: number | null;
    order_id?: string | null;
    status: string;
    message?: string | null;
}

export interface ExecuteResponse {
    success: boolean;
    strategy: string;
    index: string;
    expiry: string;
    legs: OrderLeg[];
    sl_legs: OrderLeg[];
    error?: string | null;
}

export interface ExecutePayload extends Credentials {
    strategy: string;
    index: string;
    expiry: string;
    lots: number;
    sl_percent: number;
    target_premium?: number | null;
    spot_percent?: number | null;
}

export async function executeOrder(payload: ExecutePayload): Promise<ExecuteResponse> {
    const res = await fetch(`${API_BASE}/api/orders/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Execution failed");
    }
    return res.json();
}

export interface PositionItem {
    security_id: string;
    symbol: string;
    option_type: string;
    strike_price: number;
    quantity: number;
    avg_price: number;
    ltp: number;
    pnl: number;
    product_type: string;
}

export interface PositionsResponse {
    success: boolean;
    positions: PositionItem[];
    total_pnl: number;
    error?: string | null;
}

export async function fetchPositions(creds: Credentials): Promise<PositionsResponse> {
    const params = new URLSearchParams({
        client_id: creds.client_id,
        access_token: creds.access_token,
    });
    const res = await fetch(`${API_BASE}/api/orders/positions?${params}`);
    if (!res.ok) throw new Error("Failed to fetch positions");
    return res.json();
}

export async function squareOffAll(creds: Credentials): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/orders/square-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Square-off failed");
    }
    return res.json();
}

// ── Scheduler ─────────────────────────────────────────────────────────────

export interface SchedulePayload extends ExecutePayload {
    execute_at: string;
}

export interface ScheduledJob {
    job_id: string;
    execute_at: string;
    strategy: string;
    index: string;
    expiry: string;
    lots: number;
}

export async function scheduleJob(payload: SchedulePayload): Promise<ScheduledJob> {
    const res = await fetch(`${API_BASE}/api/scheduler/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Scheduling failed");
    }
    return res.json();
}

export async function fetchJobs(): Promise<{ jobs: ScheduledJob[] }> {
    const res = await fetch(`${API_BASE}/api/scheduler/jobs`);
    if (!res.ok) throw new Error("Failed to fetch jobs");
    return res.json();
}

export async function cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/scheduler/cancel/${jobId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to cancel job");
    return res.json();
}
