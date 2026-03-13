from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Smart Inventory API"
    DEBUG: bool = False
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production-use-openssl-rand")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/smart_inventory"
    )

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://your-app.vercel.app",
    ]

    # Email (SendGrid / SMTP)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.sendgrid.net")
    SMTP_PORT: int = 587
    SMTP_USER: str = os.getenv("SMTP_USER", "apikey")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@smartinventory.app")

    # Redis (for background tasks / caching)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # AI / ML
    FORECAST_HORIZON_DAYS: int = 30
    MIN_HISTORY_DAYS: int = 14
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Frontend URL (used in email links)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
