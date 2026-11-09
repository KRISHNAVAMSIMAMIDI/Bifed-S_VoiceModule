import os
import uuid
from datetime import datetime
from typing import Optional
import numpy as np
from app.config import settings
from app.database import db_get_enrollment, db_save_experiment
from app.schemas.authentication import AuthenticationResponse
from app.schemas.pipeline import AuthenticationDecision, AASISTResult, DeepFilterNetResult, SileroVADResult, ECAPAResult
from app.services.pipeline_service import run_audio_pipeline
from app.models.aasist import aasist_model
from app.models.deepfilternet import deepfilternet_model
from app.models.silero_vad import silero_vad_model
from app.models.ecapa import ecapa_model


def authenticate_speaker(
    speaker_id: str,
    raw_audio_path: str,
    input_method: str = "upload",
    custom_threshold: Optional[float] = None
) -> AuthenticationResponse:
    experiment_id = f"exp_{uuid.uuid4().hex[:10]}"
    timestamp = datetime.utcnow().isoformat()
    threshold = custom_threshold if custom_threshold is not None else settings.DEFAULT_AUTH_THRESHOLD

    # Verify speaker enrollment
    enrollment = db_get_enrollment(speaker_id)
    ref_embedding = None
    if enrollment and enrollment.get("embedding_path"):
        emb_file = enrollment["embedding_path"]
        if os.path.exists(emb_file):
            try:
                ref_embedding = np.load(emb_file)
            except Exception:
                ref_embedding = None

    # Run the 6-stage pipeline
    (
        decision,
        stages,
        std_result,
        aasist_res,
        df_res,
        vad_res,
        ecapa_res,
        similarity_score,
        _
    ) = run_audio_pipeline(
        raw_audio_path=raw_audio_path,
        speaker_id=speaker_id,
        threshold=threshold,
        reference_embedding=ref_embedding
    )

    # Override decision if speaker not enrolled
    if not enrollment:
        decision = AuthenticationDecision.SPEAKER_NOT_ENROLLED

    # Handle missing reference embedding even when enrolled
    # (enrollment record exists but ECAPA was not functional during enrollment)
    if (
        enrollment
        and ref_embedding is None
        and ecapa_model.is_available
        and decision not in (
            AuthenticationDecision.SPOOF_DETECTED,
            AuthenticationDecision.AUDIO_QUALITY_INSUFFICIENT,
            AuthenticationDecision.PROCESSING_ERROR,
        )
    ):
        decision = AuthenticationDecision.NOT_AUTHENTICATED
        similarity_score = None

    # Build result message
    if decision == AuthenticationDecision.AUTHENTICATED:
        message = (
            f"AUTHENTICATED: Speaker verified with cosine similarity "
            f"{similarity_score:.4f} >= threshold {threshold:.2f}."
        )
    elif decision == AuthenticationDecision.NOT_AUTHENTICATED:
        if similarity_score is not None:
            message = (
                f"NOT AUTHENTICATED: Similarity {similarity_score:.4f} "
                f"is below threshold {threshold:.2f}."
            )
        else:
            message = (
                "NOT AUTHENTICATED: No reference embedding found for this speaker. "
                "Please re-enroll when ECAPA-TDNN is loaded."
            )
    elif decision == AuthenticationDecision.SPOOF_DETECTED:
        message = "ACCESS DENIED: AASIST model classified audio as a synthetic/replay spoof."
    elif decision == AuthenticationDecision.AUDIO_QUALITY_INSUFFICIENT:
        message = "AUTHENTICATION ABORTED: Insufficient voice activity detected by Silero VAD."
    elif decision == AuthenticationDecision.SPEAKER_NOT_ENROLLED:
        message = f"Speaker ID '{speaker_id}' is not enrolled in the database."
    elif decision == AuthenticationDecision.AWAITING_MODEL_INTEGRATION:
        message = (
            "Audio standardized successfully. Full pipeline awaiting ML model weights "
            "(onnxruntime, deepfilternet, speechbrain)."
        )
    else:
        message = f"Authentication status: {decision.value}"

    total_proc_time = sum(s.execution_time_ms or 0.0 for s in stages)

    all_ml_loaded = (
        aasist_model.is_available
        and deepfilternet_model.is_available
        and silero_vad_model.is_available
        and ecapa_model.is_available
    )

    # Save experiment record to SQLite
    db_save_experiment(
        experiment_id=experiment_id,
        speaker_id=speaker_id,
        input_method=input_method,
        aasist_prediction=aasist_res.prediction,
        spoof_probability=aasist_res.spoof_prob,
        vad_speech_duration=vad_res.speech_duration_sec,
        ecapa_similarity=similarity_score,
        threshold=threshold,
        final_decision=decision.value,
        total_duration_sec=round(total_proc_time / 1000.0, 3),
        stages_detail={
            "stages": [s.dict() for s in stages],
            "standardization": std_result.dict() if std_result else None
        }
    )

    # Clean up temporary audio file
    _safe_delete(raw_audio_path)

    return AuthenticationResponse(
        experiment_id=experiment_id,
        speaker_id=speaker_id,
        input_method=input_method,
        timestamp=timestamp,
        decision=decision,
        threshold=threshold,
        is_provisional_threshold=settings.IS_PROVISIONAL_THRESHOLD,
        similarity_score=similarity_score,
        total_processing_time_ms=round(total_proc_time, 2),
        stages=stages,
        standardization=std_result,
        aasist=aasist_res,
        deepfilternet=df_res,
        silero_vad=vad_res,
        ecapa=ecapa_res,
        is_ml_fully_integrated=all_ml_loaded,
        message=message
    )


def _safe_delete(path: str) -> None:
    """Delete a file silently."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
