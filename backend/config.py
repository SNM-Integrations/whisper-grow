"""
Configuration management for Second Brain.

Supports two modes:
- LOCAL: Uses Ollama/Gemma, SQLite, no auth
- CLOUD: Uses Claude/OpenAI API, PostgreSQL, user auth

Set MODE via environment variable or .env file.
"""

import os
from pathlib import Path
from typing import Literal

# Try to load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, use environment variables directly


class Config:
    """Application configuration loaded from environment."""

    # Mode: "local" or "cloud"
    MODE: Literal["local", "cloud"] = os.getenv("BRAIN_MODE", "local").lower()

    # API Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Frontend URL (for CORS)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8080")

    # Additional CORS origins (comma-separated)
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]

    # === LOCAL MODE CONFIG ===
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma3:4b")

    # === CLOUD MODE CONFIG ===
    # LLM Provider: "anthropic" or "openai"
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "anthropic")

    # Anthropic (Claude)
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

    # OpenAI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")

    # === DATABASE CONFIG ===
    # Local: SQLite file path
    SQLITE_PATH: str = os.getenv("SQLITE_PATH", str(Path(__file__).parent / "brain.db"))

    # Cloud: PostgreSQL connection string
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # === SYSTEM PROMPT ===
    SYSTEM_PROMPT: str = os.getenv("SYSTEM_PROMPT", """You are the user's Second Brain - a personal AI assistant that helps them think, remember, and act.

Your core responsibilities:
1. UNDERSTAND - Help the user think through problems, plan, and reflect
2. REMEMBER - Keep track of their notes, decisions, and context over time
3. ACT - Execute tasks and help them get things done

Your personality:
- Direct and concise - respect the user's time
- Thoughtful - consider context before responding
- Proactive - suggest relevant actions when appropriate
- Personal - you know this user and adapt to their style

Always be helpful, but never be sycophantic. Give honest, useful answers.""")

    @classmethod
    def is_local(cls) -> bool:
        """Check if running in local mode."""
        return cls.MODE == "local"

    @classmethod
    def is_cloud(cls) -> bool:
        """Check if running in cloud mode."""
        return cls.MODE == "cloud"

    @classmethod
    def get_cors_origins(cls) -> list[str]:
        """Get all allowed CORS origins."""
        origins = [cls.FRONTEND_URL]
        origins.extend(cls.CORS_ORIGINS)
        if cls.is_local():
            # Allow any localhost in local mode
            origins.extend([
                "http://localhost:8080",
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:8080",
            ])
        return list(set(origins))  # Deduplicate

    @classmethod
    def validate(cls) -> list[str]:
        """Validate configuration, return list of errors."""
        errors = []

        if cls.is_cloud():
            if cls.LLM_PROVIDER == "anthropic" and not cls.ANTHROPIC_API_KEY:
                errors.append("ANTHROPIC_API_KEY required in cloud mode with anthropic provider")
            if cls.LLM_PROVIDER == "openai" and not cls.OPENAI_API_KEY:
                errors.append("OPENAI_API_KEY required in cloud mode with openai provider")
            if not cls.DATABASE_URL:
                errors.append("DATABASE_URL required in cloud mode")

        return errors


# Validate on import
_errors = Config.validate()
if _errors:
    print("Configuration errors:")
    for err in _errors:
        print(f"  - {err}")
