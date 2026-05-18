"""Pytest configuration: set required env vars before any module import."""
import os

# Set required fields for markets_worker.config.Settings before any import
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")  # gitleaks:allow
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-at-least-32-chars-long")  # gitleaks:allow
