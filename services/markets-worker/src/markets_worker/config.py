from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase_url:              str
    supabase_service_role_key: str
    # Optional: only needed if we ever decode JWTs locally. Today auth.py
    # validates via supabase.auth.get_user(token), which doesn't need this.
    supabase_jwt_secret:       str = ""

    # ── Redis (Upstash — shared with Edge Function rate limiter) ─────────
    upstash_redis_rest_url:   str = ""
    upstash_redis_rest_token: str = ""
    # Local Redis URL used when Upstash is not configured (dev only)
    redis_url:                str = "redis://localhost:6379/0"

    # ── LLM providers ────────────────────────────────────────────────────
    anthropic_api_key: str = ""
    openai_api_key:    str = ""

    # ── Worker settings ───────────────────────────────────────────────────
    worker_concurrency: int = 4
    job_timeout:        int = 300   # seconds — backtests killed after 5 min
    job_ttl:            int = 86400  # seconds — results kept for 24 h

    # ── Service identity ──────────────────────────────────────────────────
    service_name:    str = "markets-worker"
    environment:     str = "production"
    log_level:       str = "INFO"

    # ── MCP server ────────────────────────────────────────────────────────
    # Broker credential encryption key (Fernet).
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    broker_encryption_key: str = ""

    mcp_server_name:    str = "markets-data"
    mcp_server_version: str = "0.1.0"

    @property
    def effective_redis_url(self) -> str:
        """Return Redis URL for RQ: Upstash if configured, otherwise local."""
        if self.upstash_redis_rest_url and self.upstash_redis_rest_token:
            # Upstash supports rediss:// (TLS) for RQ
            host = self.upstash_redis_rest_url.removeprefix("https://")
            return f"rediss://default:{self.upstash_redis_rest_token}@{host}:6380"
        return self.redis_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
