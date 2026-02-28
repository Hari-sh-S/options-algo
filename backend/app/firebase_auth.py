"""
Firebase Admin SDK — token verification + Firestore credential vault.

Initialisation priority:
  1. GOOGLE_APPLICATION_CREDENTIALS env-var (local dev with JSON key file)
  2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
     env-vars (Oracle Cloud, Render, or any non-Google host)
  3. Application Default Credentials (Google Cloud Run)
"""

from __future__ import annotations

import os

import firebase_admin
from firebase_admin import auth, credentials as fb_credentials, firestore

# Initialise once
if not firebase_admin._apps:
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")

    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        # Local dev — JSON key file
        firebase_admin.initialize_app()
    elif project_id and client_email and private_key:
        # Oracle / Render / any non-Google host — explicit env vars
        cred = fb_credentials.Certificate({
            "type": "service_account",
            "project_id": project_id,
            "private_key": private_key.replace("\\n", "\n"),
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        firebase_admin.initialize_app(cred)
    else:
        # Google Cloud Run — ADC auto-detected
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
