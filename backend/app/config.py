import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseModel):
    PROJECT_NAME: str = "BiFed-S Voice Biometric Authentication Demonstration"
    API_V1_STR: str = "/api"
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

    # Storage Paths
    DATABASE_PATH: Path = BASE_DIR / "storage" / "bifed_experiments.db"
    REFERENCES_DIR: Path = BASE_DIR / "storage" / "references"
    TEMP_DIR: Path = BASE_DIR / "storage" / "temp"
    MODELS_DIR: Path = BASE_DIR / "models_weights"

    # Audio Standardization Parameters
    TARGET_SAMPLE_RATE: int = 16000
    TARGET_CHANNELS: int = 1  # Mono
    MIN_AUDIO_DURATION_SEC: float = 0.5
    MAX_AUDIO_DURATION_SEC: float = 30.0
    MAX_UPLOAD_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB

    # Authentication Parameters
    DEFAULT_AUTH_THRESHOLD: float = 0.65
    IS_PROVISIONAL_THRESHOLD: bool = True

    # ECAPA Embedding Dimension
    EMBEDDING_DIM: int = 192

settings = Settings()

# Ensure directories exist
settings.REFERENCES_DIR.mkdir(parents=True, exist_ok=True)
settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
