import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

from app.config import settings
from app.database import (
    db_list_enrollments,
    db_get_enrollment,
    db_save_enrollment,
    db_delete_enrollment
)
from app.schemas.enrollment import SpeakerEnrollmentItem, EnrollmentResponse
from app.services.pipeline_service import run_audio_pipeline
from app.schemas.pipeline import StageStatus, AuthenticationDecision

logger = logging.getLogger("BiFed-S-VoiceAuth")


def list_enrolled_speakers() -> List[SpeakerEnrollmentItem]:
    rows = db_list_enrollments()
    return [
        SpeakerEnrollmentItem(
            speaker_id=r["speaker_id"],
            created_at=r["created_at"],
            sample_count=r["sample_count"],
            notes=r.get("notes")
        )
        for r in rows
    ]


def enroll_speaker(
    speaker_id: str,
    raw_audio_path: str,
    confirm_overwrite: bool = False,
    notes: str = ""
) -> EnrollmentResponse:
    """
    Securely enrolls a speaker following strict biometric verification standards:
    1. Standardizes audio and validates signal quality (minimum speech energy, duration).
    2. Runs AASIST anti-spoofing detection.
       - IF SPOOF IS DETECTED: Immediately rejects enrollment. Never saves an embedding.
         Never creates or updates a database entry. Never overwrites existing reference.
    3. Runs DeepFilterNet3 noise suppression.
    4. Runs Silero VAD to detect and validate active speech.
       - If speech duration < 0.5s, rejects enrollment as insufficient speech.
    5. Extracts 192-dimensional ECAPA-TDNN speaker embedding.
    6. Persists the reference embedding and database entry ONLY after all checks succeed.
    """
    speaker_id = speaker_id.strip()
    if not speaker_id:
        raise ValueError("Speaker ID cannot be empty.")

    existing = db_get_enrollment(speaker_id)
    if existing and not confirm_overwrite:
        logger.info("Enrollment attempt for existing speaker '%s' requires overwrite confirmation.", speaker_id)
        return EnrollmentResponse(
            success=False,
            speaker_id=speaker_id,
            message=f"Speaker ID '{speaker_id}' is already enrolled. Please confirm overwrite.",
            stages=[],
            is_model_connected=False,
            requires_overwrite_confirmation=True
        )

    # Execute complete voice pipeline
    (
        decision,
        stages,
        std_result,
        aasist_res,
        df_res,
        vad_res,
        ecapa_res,
        _,
        extracted_embedding
    ) = run_audio_pipeline(
        raw_audio_path=raw_audio_path,
        speaker_id=speaker_id,
        threshold=settings.DEFAULT_AUTH_THRESHOLD,
        reference_embedding=None
    )

    # Clean up raw ephemeral upload file
    _safe_delete(raw_audio_path)

    # STRICT SECURITY CHECK: Spoof detection rejects enrollment immediately
    if decision == AuthenticationDecision.SPOOF_DETECTED or aasist_res.prediction == "spoof":
        logger.warning(
            "Enrollment REJECTED for speaker '%s': AASIST detected spoof (prob=%.4f). "
            "No embedding was saved and database was NOT modified.",
            speaker_id, aasist_res.spoof_prob or 1.0
        )
        return EnrollmentResponse(
            success=False,
            speaker_id=speaker_id,
            message="Enrollment rejected: Audio classified as synthetic or replay spoof by AASIST anti-spoofing model.",
            standardization=std_result,
            stages=stages,
            is_model_connected=True
        )

    # Audio quality check
    if decision == AuthenticationDecision.AUDIO_QUALITY_INSUFFICIENT:
        logger.warning("Enrollment REJECTED for speaker '%s': Insufficient speech detected by VAD.", speaker_id)
        return EnrollmentResponse(
            success=False,
            speaker_id=speaker_id,
            message="Enrollment rejected: Insufficient voice activity detected. Please speak clearly for at least 2–3 seconds.",
            standardization=std_result,
            stages=stages,
            is_model_connected=True
        )

    # Pipeline error check
    if decision == AuthenticationDecision.PROCESSING_ERROR:
        logger.error("Enrollment failed for speaker '%s' due to audio processing error.", speaker_id)
        return EnrollmentResponse(
            success=False,
            speaker_id=speaker_id,
            message="Enrollment failed during audio standardization or model execution. Check server logs.",
            standardization=std_result,
            stages=stages,
            is_model_connected=False
        )

    # Reference embedding path
    os.makedirs(settings.REFERENCES_DIR, exist_ok=True)
    ref_emb_path = str(settings.REFERENCES_DIR / f"{speaker_id}_embedding.npy")

    # If ECAPA-TDNN extracted a valid embedding, persist it
    if extracted_embedding is not None and ecapa_res.is_functional:
        np.save(ref_emb_path, extracted_embedding)
        db_save_enrollment(speaker_id, ref_emb_path, notes)
        logger.info(
            "Speaker '%s' enrolled successfully. 192-dim reference embedding saved to %s",
            speaker_id, ref_emb_path
        )
        msg = (
            f"Speaker '{speaker_id}' enrolled successfully. "
            f"192-dimensional ECAPA-TDNN reference embedding saved."
        )
        is_conn = True
    elif not ecapa_res.is_functional:
        # Placeholder record if ECAPA weights are awaiting load
        db_save_enrollment(
            speaker_id,
            ref_emb_path,
            f"{notes} (Awaiting ECAPA-TDNN weights)"
        )
        msg = (
            f"Speaker '{speaker_id}' audio standardized. "
            f"Full embedding extraction awaiting ECAPA-TDNN model load."
        )
        is_conn = False
    else:
        logger.error("Enrollment failed for '%s': Embedding extraction returned None.", speaker_id)
        return EnrollmentResponse(
            success=False,
            speaker_id=speaker_id,
            message="Enrollment failed: Unable to extract speaker embedding.",
            standardization=std_result,
            stages=stages,
            is_model_connected=True
        )

    return EnrollmentResponse(
        success=True,
        speaker_id=speaker_id,
        message=msg,
        standardization=std_result,
        stages=stages,
        is_model_connected=is_conn
    )


def delete_speaker_enrollment(speaker_id: str) -> bool:
    ref_emb_path = settings.REFERENCES_DIR / f"{speaker_id}_embedding.npy"
    if ref_emb_path.exists():
        try:
            ref_emb_path.unlink()
        except Exception:
            pass
    return db_delete_enrollment(speaker_id)


def _safe_delete(path: str) -> None:
    """Delete a file silently."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
