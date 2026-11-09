from pydantic import BaseModel
from typing import Optional, List
from app.schemas.pipeline import PipelineStageInfo, StandardizationResult


class SpeakerEnrollmentItem(BaseModel):
    speaker_id: str
    created_at: str
    sample_count: int
    notes: Optional[str] = None


class EnrollmentResponse(BaseModel):
    success: bool
    speaker_id: str
    message: str
    standardization: Optional[StandardizationResult] = None
    stages: List[PipelineStageInfo] = []
    is_model_connected: bool = False
    requires_overwrite_confirmation: bool = False
