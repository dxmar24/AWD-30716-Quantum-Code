import unittest

from app.config import Settings, TEST_SESSION_SECRET


class SettingsSecurityTest(unittest.TestCase):
    def test_authentication_bypass_is_test_only(self):
        with self.assertRaisesRegex(RuntimeError, "test-only"):
            Settings(
                environment="development",
                session_secret="development-secret-with-at-least-32-characters",
                auth_required=False,
                cors_origins=["http://localhost:8000"],
            )

        settings = Settings(
            environment="test",
            session_secret="",
            auth_required=False,
            cors_origins=["http://localhost:8000"],
        )
        self.assertEqual(settings.session_secret, TEST_SESSION_SECRET)

    def test_deployed_origins_must_be_exact_https_origins(self):
        with self.assertRaisesRegex(RuntimeError, "HTTPS"):
            Settings(
                environment="production",
                database_url="postgresql://app:placeholder@db.internal/academy",
                session_secret="production-secret-with-at-least-32-characters",
                auth_required=True,
                cors_origins=["http://academy.example.invalid"],
            )

    def test_non_test_secret_must_be_explicit_and_long(self):
        with self.assertRaisesRegex(RuntimeError, "32 characters"):
            Settings(
                environment="development",
                session_secret="short",
                auth_required=True,
                cors_origins=["http://localhost:8000"],
            )


if __name__ == "__main__":
    unittest.main()
