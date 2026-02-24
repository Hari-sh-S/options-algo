"""
Credential management routes — save / check / delete Dhan API keys in Firestore.

All routes require a valid Firebase ID token in the Authorization header.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from ..firebase_auth import verify_id_token, get_user_credentials, save_user_credentials, delete_user_credentials

router = APIRouter(prefix="/api/credentials", tags=["Credentials"])


class SaveCredentialsRequest(BaseModel):
    client_id: str
    app_id: str = ""
    app_secret: str = ""


class CredentialStatus(BaseModel):
    has_credentials: bool
    has_api_key: bool = False
    has_access_token: bool = False
    client_id_preview: str | None = None


def _get_uid(authorization: str) -> str:
    """Extract and verify the Bearer token, return UID."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[len("Bearer "):]
    try:
        decoded = verify_id_token(token)
        return decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/save")
async def save_credentials(req: SaveCredentialsRequest, authorization: str = Header(...)):
    """Save Dhan API credentials to Firestore for the authenticated user."""
    uid = _get_uid(authorization)
    save_user_credentials(
        uid,
        client_id=req.client_id,
        app_id=req.app_id,
        app_secret=req.app_secret,
    )
    return {"success": True, "message": "Credentials saved securely"}


@router.get("/status", response_model=CredentialStatus)
async def credential_status(authorization: str = Header(...)):
    """Check whether the user has stored credentials (without revealing them)."""
    uid = _get_uid(authorization)
    creds = get_user_credentials(uid)
    if creds and creds.get("client_id"):
        cid = creds["client_id"]
        preview = f"****{cid[-4:]}" if len(cid) >= 4 else "****"
        return CredentialStatus(
            has_credentials=True,
            has_api_key=bool(creds.get("app_id") and creds.get("app_secret")),
            has_access_token=bool(creds.get("access_token")),
            client_id_preview=preview,
        )
    return CredentialStatus(has_credentials=False)


@router.delete("/delete")
async def delete_credentials(authorization: str = Header(...)):
    """Delete stored credentials."""
    uid = _get_uid(authorization)
    delete_user_credentials(uid)
    return {"success": True, "message": "Credentials deleted"}
