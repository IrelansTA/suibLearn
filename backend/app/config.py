"""Application configuration - loads from environment variables / .env file."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


class Settings:
    """Application settings loaded from environment."""

    # --- LLM API (OpenAI-compatible) ---
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen3-omni-flash")

    # --- Database ---
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", str(Path(__file__).resolve().parent.parent / "data" / "sublearn.db"))

    # --- Media Storage ---
    MEDIA_DIR: str = os.getenv("MEDIA_DIR", str(Path(__file__).resolve().parent.parent / "data" / "media"))
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "0"))  # 0 = no limit
    MAX_TOTAL_STORAGE: int = int(os.getenv("MAX_TOTAL_STORAGE", str(30 * 1024 * 1024 * 1024)))  # 30GB default

    # --- Server ---
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    def __init__(self):
        # Ensure directories exist
        os.makedirs(os.path.dirname(self.DATABASE_PATH), exist_ok=True)
        os.makedirs(self.MEDIA_DIR, exist_ok=True)


settings = Settings()