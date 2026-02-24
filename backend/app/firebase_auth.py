"""
Firebase Admin SDK — token verification + Firestore credential vault.

On Cloud Run, Application Default Credentials are auto-detected.
Locally, set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON.
"""

from __future__ import annotations

import firebase_admin
from firebase_admin import auth, credentials, firestore

# Initialise once — uses ADC on Cloud Run, env-var locally
if not firebase_admin._apps:
    firebase_admin.initialize_app()

_db = firestore.client()

USERS_COLLECTION = "users"


def verify_id_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims (contains 'uid')."""
    return auth.verify_id_token(id_token)


def get_user_credentials(uid: str) -> dict | None:
    """Read Dhan API credentials from Firestore for a given user."""
    doc = _db.collection(USERS_COLLECTION).document(uid).get()
    if doc.exists:
        data = doc.to_dict()
        return {
            "client_id": data.get("dhan_client_id", ""),
            "access_token": data.get("dhan_access_token", ""),
            "app_id": data.get("dhan_app_id", ""),
            "app_secret": data.get("dhan_app_secret", ""),
        }
    return None


def save_user_credentials(
    uid: str,
    client_id: str = "",
    access_token: str = "",
    app_id: str = "",
    app_secret: str = "",
) -> None:
    """Save (or overwrite) Dhan API credentials in Firestore."""
    doc: dict = {}
    if client_id:
        doc["dhan_client_id"] = client_id
    if access_token:
        doc["dhan_access_token"] = access_token
    if app_id:
        doc["dhan_app_id"] = app_id
    if app_secret:
        doc["dhan_app_secret"] = app_secret

    if doc:
        _db.collection(USERS_COLLECTION).document(uid).set(doc, merge=True)


def delete_user_credentials(uid: str) -> None:
    """Delete stored credentials."""
    _db.collection(USERS_COLLECTION).document(uid).delete()
