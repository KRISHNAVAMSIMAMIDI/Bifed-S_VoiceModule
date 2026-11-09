from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ExperimentHistoryItem(BaseModel):
    experiment_id: str
    speaker_id: str
    timestamp: str
    input_method: str
    aasist_prediction: Optional[str] = None
    spoof_probability: Optional[float] = None
    vad_speech_duration: Optional[float] = None
    ecapa_similarity: Optional[float] = None
    threshold: Optional[float] = None
    final_decision: str
    total_duration_sec: Optional[float] = None
    stages_detail: Optional[Dict[str, Any]] = None

class ExperimentStats(BaseModel):
    total_attempts: int
    successful_authentications: int
    rejected_attempts: int
    spoof_detections: int
    average_processing_time_sec: float
    average_similarity: Optional[float] = None
    decision_counts: Dict[str, int]
