"""Google Sign-In (OAuth) — separate from calendar sync.

This handles "Continue with Google": we only request identity scopes
(openid/email/profile) so NO Google verification is required. The calendar
flow lives in calendar_service.py and uses its own redirect URI.
"""
import os
from typing import Dict, Any

import requests
from loguru import logger
from google_auth_oauthlib.flow import Flow

# Google expands/reorders the requested scopes (it always adds `openid`), which
# trips oauthlib's strict scope check and raises a false "Scope has changed"
# error during token exchange. Relaxing the check avoids that.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

LOGIN_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleLoginService:
    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        # Dedicated redirect for the LOGIN flow — the calendar flow uses
        # /auth-callback, this one uses /google-callback.
        self.redirect_uri = os.getenv(
            "GOOGLE_LOGIN_REDIRECT_URI",
            "https://www.feelivate.com/google-callback",
        )

    def _flow(self) -> Flow:
        return Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=LOGIN_SCOPES,
            redirect_uri=self.redirect_uri,
        )

    def get_login_url(self) -> str:
        """Build the Google consent URL. `select_account` lets the user pick
        which Google account to sign in with each time."""
        flow = self._flow()
        auth_url, _ = flow.authorization_url(
            prompt="select_account",
            access_type="online",
            include_granted_scopes="true",
        )
        return auth_url

    def exchange_code_for_userinfo(self, code: str) -> Dict[str, Any]:
        """Exchange the one-time code for tokens, then fetch the user's basic
        profile (email + name) from Google."""
        flow = self._flow()
        flow.fetch_token(code=code)
        creds = flow.credentials

        resp = requests.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "email": data.get("email"),
            "name": data.get("name") or data.get("given_name"),
            "picture": data.get("picture"),
            "email_verified": data.get("email_verified", False),
        }


google_login_service = GoogleLoginService()
