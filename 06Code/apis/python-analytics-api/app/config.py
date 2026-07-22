from dataclasses import dataclass, field
import os
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

VALID_ENVIRONMENTS = {"development", "test", "staging", "production"}
DEPLOYED_ENVIRONMENTS = {"staging", "production"}
TEST_SESSION_SECRET = "test-only-session-secret-32-characters-minimum"


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _bool(name: str, default: str = "false") -> bool:
    value = os.getenv(name, default).strip().lower()
    if value not in {"true", "false"}:
        raise RuntimeError(f"{name} must be exactly true or false.")
    return value == "true"


def _exact_origin(origin: str, deployed: bool) -> None:
    parsed = urlparse(origin)
    if origin == "*" or not parsed.scheme or not parsed.netloc:
        raise RuntimeError(f"Invalid exact analytics CORS origin: {origin}")
    if parsed.username or parsed.password or parsed.path or parsed.params or parsed.query or parsed.fragment:
        raise RuntimeError(f"Analytics CORS origins cannot contain credentials, paths, query strings, or fragments: {origin}")
    if deployed and parsed.scheme != "https":
        raise RuntimeError(f"Analytics CORS origins must use HTTPS in deployed environments: {origin}")


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", ""))
    session_secret: str = field(default_factory=lambda: os.getenv("SESSION_SECRET", ""))
    auth_required: bool = field(default_factory=lambda: _bool("ANALYTICS_AUTH_REQUIRED", "true"))
    cors_origins: list[str] | None = None
    service_name: str = field(default_factory=lambda: os.getenv("ANALYTICS_SERVICE_NAME", "American Latin Class Analytics API"))
    environment: str = field(default_factory=lambda: os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development")).strip().lower())
    jwt_issuer: str = field(default_factory=lambda: os.getenv("JWT_ISSUER", "american-latin-class-auth"))
    jwt_audience: str = field(default_factory=lambda: os.getenv("JWT_AUDIENCE", "american-latin-class-services"))

    def __post_init__(self):
        if self.environment not in VALID_ENVIRONMENTS:
            raise RuntimeError(f"Unsupported environment: {self.environment}")
        if not self.session_secret and self.environment == "test":
            object.__setattr__(self, "session_secret", TEST_SESSION_SECRET)
        if self.cors_origins is None:
            default_origins = "http://localhost:3000,http://localhost:5173" if self.environment in {"development", "test"} else ""
            object.__setattr__(self, "cors_origins", _csv(os.getenv("ANALYTICS_CORS_ORIGINS", default_origins)))

        if self.environment != "test" and len(self.session_secret) < 32:
            raise RuntimeError("SESSION_SECRET must be explicitly configured with at least 32 characters outside tests.")
        if not self.auth_required and self.environment != "test":
            raise RuntimeError("ANALYTICS_AUTH_REQUIRED=false is test-only.")
        if not self.jwt_issuer or not self.jwt_audience:
            raise RuntimeError("JWT_ISSUER and JWT_AUDIENCE are required.")
        if not self.cors_origins:
            raise RuntimeError("At least one exact ANALYTICS_CORS_ORIGINS value is required.")
        for origin in self.cors_origins:
            _exact_origin(origin, self.environment in DEPLOYED_ENVIRONMENTS)
        if self.environment in DEPLOYED_ENVIRONMENTS and not self.database_url:
            raise RuntimeError("DATABASE_URL is required in production/staging.")


def get_settings() -> Settings:
    return Settings()
