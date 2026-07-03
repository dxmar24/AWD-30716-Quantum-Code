from dataclasses import dataclass
import os

from dotenv import load_dotenv

load_dotenv()


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "")
    session_secret: str = os.getenv("SESSION_SECRET", "development_secret_change_me")
    auth_required: bool = os.getenv("ANALYTICS_AUTH_REQUIRED", "true").lower() == "true"
    cors_origins: list[str] = None
    service_name: str = os.getenv("ANALYTICS_SERVICE_NAME", "American Latin Class Analytics API")

    def __post_init__(self):
        if self.cors_origins is None:
            object.__setattr__(
                self,
                "cors_origins",
                _csv(os.getenv("ANALYTICS_CORS_ORIGINS", "http://localhost:8000")),
            )


def get_settings() -> Settings:
    return Settings()
