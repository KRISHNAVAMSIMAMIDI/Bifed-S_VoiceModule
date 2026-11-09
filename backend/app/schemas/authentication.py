from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.schemas.pipeline import (
    AuthenticationDecision,
    PipelineStageInfo,
    StandardizationResult,
    AASISTResult,
    DeepFilterNetResult,
    SileroVADResult,
    ECAPAResult
)

class AuthenticationResponse(BaseModel):
    experiment_id: str
    speaker_id: str
    input_method: str
    timestamp: str
    decision: AuthenticationDecision
    threshold: float
    is_provisional_threshold: bool
    similarity_score: Optional[float] = None
    total_processing_time_ms: float
    stages: List[PipelineStageInfo]
    standardization: Optional[StandardizationResult] = None
    aasist: AASISTResult
    deepfilternet: DeepFilterNetResult
    silero_vad: SileroVADResult
    ecapa: ECAPAResult
    is_ml_fully_integrated: bool = False
    message: str
