from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import unittest

import jwt

from app.auth import get_current_user
from app.config import Settings


class RequestStub:
    def __init__(self, token):
        self.headers = {"authorization": f"Bearer {token}"}


class AnalyticsAuthSecurityTest(unittest.TestCase):
    def setUp(self):
        self.user_id = "11111111-1111-4111-8111-111111111111"
        self.settings = Settings(
            environment="test",
            session_secret="test-only-session-secret-32-characters-minimum",
            auth_required=True,
            cors_origins=["http://localhost:8000"],
        )
        self.database = MagicMock()
        self.database.connect.return_value.__enter__.return_value = object()

    def token(self, user_id=None):
        bound_user = user_id or self.user_id
        now = datetime.now(timezone.utc)
        return jwt.encode(
            {
                "sid": "22222222-2222-4222-8222-222222222222",
                "userId": bound_user,
                "sub": bound_user,
                "iat": now,
                "exp": now + timedelta(minutes=10),
                "iss": self.settings.jwt_issuer,
                "aud": self.settings.jwt_audience,
            },
            self.settings.session_secret,
            algorithm="HS256",
        )

    def row(self, **changes):
        row = {
            "revoked": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            "session_user_id": self.user_id,
            "id": self.user_id,
            "email": "student@example.invalid",
            "name": "Test Student",
            "active": True,
            "must_change_password": False,
            "role": "Student",
        }
        row.update(changes)
        return row

    def resolve(self, token, row):
        with patch("app.auth.SessionRepository") as repository:
            repository.return_value.get_user_for_token_hash.return_value = row
            return get_current_user(RequestStub(token), self.settings, self.database)

    def test_inactive_user_is_rejected(self):
        with self.assertRaisesRegex(Exception, "Authentication required"):
            self.resolve(self.token(), self.row(active=False))

    def test_password_change_requirement_is_enforced(self):
        with self.assertRaisesRegex(Exception, "Password change required"):
            self.resolve(self.token(), self.row(must_change_password=True))

    def test_claim_user_must_match_persisted_session_user(self):
        other = "33333333-3333-4333-8333-333333333333"
        with self.assertRaisesRegex(Exception, "Invalid session token"):
            self.resolve(self.token(other), self.row())


if __name__ == "__main__":
    unittest.main()
