from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional
import sys


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "vakilai"

    # JWT — 60 min access token; use /auth/refresh for silent renewal
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    @field_validator("jwt_secret")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        weak = {"change-me-in-production", "your-super-secret-jwt-key-change-in-production", "secret", ""}
        if v in weak or len(v) < 32:
            print("FATAL: JWT_SECRET is weak or placeholder. Set a random 32+ character secret.", file=sys.stderr)
            # Warn in dev, hard-fail in prod is enforced at startup check in main.py
        return v

    # AWS
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    s3_bucket_documents: str = "vakilai-documents"
    s3_bucket_invoices: str = "vakilai-invoices"

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # WhatsApp
    whatsapp_api_token: str = ""
    whatsapp_phone_id: str = ""

    # Service URLs
    ai_service_url: str = "http://localhost:8001"

    # Internal service-to-service auth key (backend → ai_service)
    # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
    internal_service_key: str = ""

    # Redis — required for distributed rate limiting in multi-worker deployments
    # Format: redis://[:password@]host[:port][/db]
    redis_url: str = ""

    # Metrics — protect /metrics endpoint from unauthenticated scraping
    # Generate: openssl rand -hex 32
    # Configure Prometheus with: bearer_token: <this value>
    metrics_token: str = ""

    # Sentry — error tracking (https://sentry.io)
    sentry_dsn: Optional[str] = None

    # Admin config store — master encryption key for DB-stored secrets
    # Generate: python -c "import secrets; print(secrets.token_hex(32))"
    # Must be stable across restarts. If not set, an ephemeral key is used
    # and DB-stored config values will be unreadable after restart.
    config_encryption_key: str = ""

    # App
    app_env: str = "development"
    debug: bool = False
    cors_origins: str = "http://localhost:3000"
    # Set to false when running over plain HTTP (no HTTPS/TLS)
    cookie_secure: bool = True

    def get_cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
