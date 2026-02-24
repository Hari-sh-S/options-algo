/**
 * API client — centralised fetch wrapper pointing at the FastAPI backend.
 *
 * In production (Firebase Hosting), API_BASE is empty because /api/* is
 * rewritten to Cloud Run on the same domain.  During local dev it falls
 * back to the local FastAPI server.
 *
 * SECURITY: All authenticated requests send the Firebase ID token in the
 * Authorization header. Dhan credentials are never sent from the browser
 * after initial save.
 */

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? ""
        : "http://127.0.0.1:8000");

/** Build headers with optional Firebase auth token. */
function authHeaders(idToken?: string | null): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
    }
    return headers;
}

/** Safely extract a human-readable error message from a FastAPI error response. */
function extractError(err: any, fallback: string): string {
    if (!err) return fallback;
    if (typeof err.detail === "string") return err.detail;
    if (Array.isArray(err.detail)) {
        return err.detail
            .map((d: any) => (typeof d === "string" ? d : d?.msg || JSON.stringify(d)))
            .join("; ");
    }
    if (typeof err.detail === "object") return JSON.stringify(err.detail);
    if (typeof err.message === "string") return err.message;
    return fallback;
}

// ── Credentials ──────────────────────────────────────────────────────────

export interface SaveCredentialsPayload {
    client_id: string;
    app_id: string;
    app_secret: string;
}

export interface CredentialStatus {
    has_credentials: boolean;
    has_api_key: boolean;
    has_access_token: boolean;
    client_id_preview: string | null;
}

export async function saveCredentials(
    payload: SaveCredentialsPayload,
    idToken: string
): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/credentials/save`, {
        method: "POST",
        headers: authHeaders(idToken),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, "Failed to save credentials"));
    }
    return res.json();
}

export async function fetchCredentialStatus(
    idToken: string
): Promise<CredentialStatus> {
    const res = await fetch(`${API_BASE}/api/credentials/status`, {
        headers: authHeaders(idToken),
    });
    if (!res.ok) throw new Error("Failed to check credential status");
    return res.json();
}

export async function deleteCredentials(
    idToken: string
): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/credentials/delete`, {
        method: "DELETE",
        headers: authHeaders(idToken),
    });
    if (!res.ok) throw new Error("Failed to delete credentials");
    return res.json();
}

// ── Dhan OAuth ───────────────────────────────────────────────────────────

export async function initiateDhanLogin(
    idToken: string
): Promise<{ login_url: string }> {
    const res = await fetch(`${API_BASE}/api/auth/dhan/initiate`, {
        method: "POST",
        headers: authHeaders(idToken),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, "Failed to initiate Dhan login"));
    }
    return res.json();
}

export async function completeDhanCallback(
    tokenId: string,
    idToken: string
): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/auth/dhan/callback`, {
        method: "POST",
        headers: authHeaders(idToken),
        body: JSON.stringify({ token_id: tokenId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, "Token exchange failed"));
    }
    return res.json();
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
    idToken?: string | null
): Promise<SpotPrice> {
    const res = await fetch(`${API_BASE}/api/market/spot?index=${index}`, {
        method: "POST",
        headers: authHeaders(idToken),
        body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("Failed to fetch spot price");
    return res.json();
}

export async function fetchExpiries(index: string): Promise<ExpiriesResponse> {
    const res = await fetch(`${API_BASE}/api/market/expiries?index=${index}`);
    if (!res.ok) throw new Error("Failed to fetch expiries");
    return res.json();
}

export async function updateData(
    idToken: string
): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/market/update-data`, {
        method: "POST",
        headers: authHeaders(idToken),
        body: JSON.stringify({}),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, "Failed to update data"));
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

export interface ExecutePayload {
    strategy: string;
    index: string;
    expiry: string;
    lots: number;
    sl_percent: number;
    mode: string;
    target_premium?: number | null;
    spot_percent?: number | null;
}

export async function executeOrder(
    payload: ExecutePayload,
    idToken: string
): Promise<ExecuteResponse> {
    const res = await fetch(`${API_BASE}/api/orders/execute`, {
        method: "POST",
        headers: authHeaders(idToken),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, "Execution failed"));
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

export async function fetchPositions(
    idToken: string
): Promise<PositionsResponse> {
    const res = await fetch(`${API_BASE}/api/orders/positions`, {
        method: "POST",
        headers: authHeaders(idToken),
        body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("Failed to fetch positions");
    return res.json();
}

export async function squareOffAll(
    idToken: string
): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/orders/square-off`, {
        method: "POST",
        headers: authHeaders(idToken),
        body: JSON.stringify({}),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, "Square-off failed"));
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

export async function scheduleJob(
    payload: SchedulePayload,
    idToken: string
): Promise<ScheduledJob> {
    const res = await fetch(`${API_BASE}/api/scheduler/add`, {
        method: "POST",
        headers: authHeaders(idToken),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractError(err, "Scheduling failed"));
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
