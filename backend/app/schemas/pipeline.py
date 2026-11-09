from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from enum import Enum


class StageStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    AWAITING_MODEL = "awaiting_model"


class PipelineStageInfo(BaseModel):
    name: str
    stage_number: int
    status: StageStatus
    is_model_connected: bool = False
    execution_time_ms: Optional[float] = None
    summary: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class StandardizationResult(BaseModel):
    audio_path: str
    original_sample_rate: Optional[int] = None
    processed_sample_rate: int = 16000
    original_channels: Optional[int] = None
    duration_seconds: float
    file_size_bytes: int
    processing_time_ms: Optional[float] = None
    format_detected: Optional[str] = None


class AASISTResult(BaseModel):
    is_functional: bool = False
    prediction: Optional[str] = None       # "bona_fide" or "spoof"
    bona_fide_prob: Optional[float] = None
    spoof_prob: Optional[float] = None
    inference_time_ms: Optional[float] = None
    status_note: str = "Awaiting AASIST ONNX model"


class DeepFilterNetResult(BaseModel):
    is_functional: bool = False
    input_sample_rate: int = 16000
    internal_sample_rate: int = 48000
    output_sample_rate: int = 16000
    processing_time_ms: Optional[float] = None
    status_note: str = "Awaiting DeepFilterNet3"


class SileroVADResult(BaseModel):
    is_functional: bool = False
    original_duration_sec: Optional[float] = None
    speech_duration_sec: Optional[float] = None
    silence_removed_sec: Optional[float] = None
    speech_ratio: Optional[float] = None
    status_note: str = "Awaiting Silero VAD"


class ECAPAResult(BaseModel):
    is_functional: bool = False
    embedding_dimension: int = 192
    similarity_score: Optional[float] = None
    threshold: float = 0.65
    is_matched: Optional[bool] = None
    status_note: str = "Awaiting ECAPA-TDNN model"


class AuthenticationDecision(str, Enum):
    AUTHENTICATED = "AUTHENTICATED"
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    SPOOF_DETECTED = "SPOOF_DETECTED"
    AUDIO_QUALITY_INSUFFICIENT = "AUDIO_QUALITY_INSUFFICIENT"
    SPEAKER_NOT_ENROLLED = "SPEAKER_NOT_ENROLLED"
    PROCESSING_ERROR = "PROCESSING_ERROR"
    AWAITING_MODEL_INTEGRATION = "AWAITING_MODEL_INTEGRATION"
