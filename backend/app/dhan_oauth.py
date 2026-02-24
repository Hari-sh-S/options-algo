"""
Dhan OAuth — initiate login and exchange tokenId for access token.

Individual user flow:
1. POST /app/generate-consent?client_id={dhanClientId}
   Headers: app_id, app_secret
   → returns consentAppId
2. Redirect user to Dhan login:
   https://auth.dhan.co/login/consentApp-login?consentAppId={consentAppId}
3. User logs in → redirected to callback with tokenId
4. POST /app/consumeApp-consent?tokenId={tokenId}
   Headers: app_id, app_secret
   → returns accessToken (valid 24h)
"""

from __future__ import annotations

import logging

import httpx

log = logging.getLogger(__name__)

DHAN_AUTH_BASE = "https://auth.dhan.co"

GENERATE_CONSENT_URL = f"{DHAN_AUTH_BASE}/app/generate-consent"
CONSUME_CONSENT_URL = f"{DHAN_AUTH_BASE}/app/consumeApp-consent"
LOGIN_PAGE_URL = f"{DHAN_AUTH_BASE}/login/consentApp-login"


def get_login_url(client_id: str, app_id: str, app_secret: str) -> dict:
    """
    Step 1: Generate consent and return the Dhan login URL.

    Returns {"login_url": "https://auth.dhan.co/login/...", "consent_id": "..."}
    """
    headers = {
        "app_id": app_id,
        "app_secret": app_secret,
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=15) as client:
        resp = client.post(
            f"{GENERATE_CONSENT_URL}?client_id={client_id}",
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    consent_id = (
        data.get("consentAppId")
        or data.get("consentId")
        or data.get("consent_id")
        or data.get("id", "")
    )

    if not consent_id:
        log.error("Dhan consent response: %s", data)
        raise ValueError(f"Failed to generate consent: {data}")

    login_url = f"{LOGIN_PAGE_URL}?consentAppId={consent_id}"

    log.info("Generated Dhan consent: %s", consent_id)
    return {"login_url": login_url, "consent_id": consent_id}


def exchange_token(token_id: str, app_id: str, app_secret: str) -> dict:
    """
    Step 3: Exchange the tokenId (from redirect callback) for an access token.

    Returns {"access_token": "..."}
    """
    headers = {
        "app_id": app_id,
        "app_secret": app_secret,
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=15) as client:
        resp = client.post(
            f"{CONSUME_CONSENT_URL}?tokenId={token_id}",
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    access_token = data.get("accessToken") or data.get("access_token", "")

    if not access_token:
        log.error("Dhan token exchange response: %s", data)
        raise ValueError(f"Token exchange failed: {data}")

    log.info("Dhan token exchanged successfully")
    return {
        "access_token": access_token,
    }
