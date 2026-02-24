"""
Dhan OAuth auth routes — initiate login and handle callback.

All routes require a valid Firebase ID token (user must be signed in).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from ..firebase_auth import verify_id_token, get_user_credentials, save_user_credentials
from ..dhan_oauth import get_login_url, exchange_token

router = APIRouter(prefix="/api/auth/dhan", tags=["DhanAuth"])

IST = timezone(timedelta(hours=5, minutes=30))


def _get_uid(authorization: str) -> str:
    """Extract and verify the Bearer token, return UID."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[len("Bearer "):]
    try:
        decoded = verify_id_token(token)
        return decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token")


class InitiateResponse(BaseModel):
    login_url: str


@router.post("/initiate", response_model=InitiateResponse)
async def initiate_dhan_login(authorization: str = Header(...)):
    """Start Dhan OAuth — returns the URL to redirect the user to."""
    uid = _get_uid(authorization)
    creds = get_user_credentials(uid)

    if not creds or not creds.get("app_id") or not creds.get("app_secret") or not creds.get("client_id"):
        raise HTTPException(
            status_code=400,
            detail="Save your Client ID, App ID, and App Secret first.",
        )

    try:
        result = get_login_url(creds["client_id"], creds["app_id"], creds["app_secret"])
        return InitiateResponse(login_url=result["login_url"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to initiate Dhan login: {exc}")


class CallbackRequest(BaseModel):
    token_id: str


@router.post("/callback")
async def dhan_callback(req: CallbackRequest, authorization: str = Header(...)):
    """Handle the Dhan OAuth callback — exchange tokenId for access token."""
    uid = _get_uid(authorization)
    creds = get_user_credentials(uid)

    if not creds or not creds.get("app_id") or not creds.get("app_secret"):
        raise HTTPException(status_code=400, detail="No App ID/Secret found")

    try:
        result = exchange_token(req.token_id, creds["app_id"], creds["app_secret"])
        access_token = result["access_token"]

        # Save the access token to Firestore
        save_user_credentials(
            uid,
            client_id=creds.get("client_id", ""),
            access_token=access_token,
            app_id=creds["app_id"],
            app_secret=creds["app_secret"],
        )

        return {
            "success": True,
            "message": "Dhan connected successfully! Token valid for 24 hours.",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {exc}")
