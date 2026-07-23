import os
import unittest

os.environ.setdefault("NODE_ENV", "test")
os.environ.setdefault("SESSION_SECRET", "test-only-session-secret-32-characters-minimum")
os.environ.setdefault("ANALYTICS_AUTH_REQUIRED", "true")

from fastapi.testclient import TestClient

from app.main import app


class ApiTest(unittest.TestCase):
    def test_health_endpoint(self):
        response = TestClient(app).get("/api/analytics/v1/health")

        self.assertEqual(response.status_code, 200)
        self.assertIn("max-age=60", response.headers["cache-control"])
        self.assertEqual(response.headers["x-cache-policy"], "public-health-short")
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"]["status"], "healthy")

    def test_protected_endpoint_requires_bearer_token(self):
        response = TestClient(app).get("/api/analytics/v1/students/student-1/attendance-risk")

        self.assertEqual(response.status_code, 401)
        self.assertIn("no-store", response.headers["cache-control"])
        self.assertEqual(response.headers["x-cache-policy"], "sensitive-no-store")
        payload = response.json()
        self.assertFalse(payload["success"])
        self.assertEqual(payload["message"], "Authentication required")
        self.assertIsNone(payload["data"])


if __name__ == "__main__":
    unittest.main()
