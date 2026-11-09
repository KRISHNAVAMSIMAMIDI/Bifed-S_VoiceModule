import time
import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

from app.schemas.pipeline import (
    StageStatus,
    PipelineStageInfo,
    StandardizationResult,
    AASISTResult,
    DeepFilterNetResult,
    SileroVADResult,
    ECAPAResult,
    AuthenticationDecision
)
from app.models.aasist import aasist_model
from app.models.deepfilternet import deepfilternet_model
from app.models.silero_vad import silero_vad_model
from app.models.ecapa import ecapa_model
from app.services.audio_standardization import standardize_audio

logger = logging.getLogger("BiFed-S-VoiceAuth")


def get_pipeline_model_statuses() -> Dict[str, Any]:
    return {
        "aasist": aasist_model.get_status(),
        "deepfilternet": deepfilternet_model.get_status(),
        "silero_vad": silero_vad_model.get_status(),
        "ecapa": ecapa_model.get_status(),
        "all_functional": (
            aasist_model.is_available and
            deepfilternet_model.is_available and
            silero_vad_model.is_available and
            ecapa_model.is_available
        )
    }


def run_audio_pipeline(
    raw_audio_path: str,
    speaker_id: str,
    threshold: float,
    reference_embedding: Optional[Any] = None
) -> Tuple[
    AuthenticationDecision,
    List[PipelineStageInfo],
    Optional[StandardizationResult],
    AASISTResult,
    DeepFilterNetResult,
    SileroVADResult,
    ECAPAResult,
    Optional[float],
    Optional[np.ndarray]
]:
    """
    Executes the 6-stage voice authentication pipeline in exact order:
    1. Audio Standardization & Signal Validation
    2. AASIST Anti-Spoofing Detection
    3. DeepFilterNet3 Audio Enhancement
    4. Silero Voice Activity Detection
    5. ECAPA-TDNN Speaker Embedding Extraction
    6. Final Authentication Decision

    Returns:
        (decision, stages, std_result, aasist_res, df_res, vad_res, ecapa_res, similarity_score, extracted_embedding)
    """
    stages: List[PipelineStageInfo] = []
    extracted_embedding: Optional[np.ndarray] = None

    # ==========================================
    # STAGE 1: Audio Standardization & Validation
    # ==========================================
    t0 = time.time()
    try:
        std_result = standardize_audio(raw_audio_path)
        std_time = (time.time() - t0) * 1000
        stages.append(PipelineStageInfo(
            name="Audio Standardization",
            stage_number=1,
            status=StageStatus.COMPLETED,
            is_model_connected=True,
            execution_time_ms=round(std_time, 2),
            summary=f"16 kHz Mono WAV | Duration: {std_result.duration_seconds}s | Size: {std_result.file_size_bytes}B",
            details=std_result.dict()
        ))
        active_audio_path = std_result.audio_path
    except Exception as e:
        logger.error("Stage 1 Audio Standardization failed for %s: %s", raw_audio_path, e)
        stages.append(PipelineStageInfo(
            name="Audio Standardization",
            stage_number=1,
            status=StageStatus.FAILED,
            is_model_connected=True,
            execution_time_ms=round((time.time() - t0) * 1000, 2),
            summary="Standardization failed",
            error_message=str(e)
        ))
        return (
            AuthenticationDecision.PROCESSING_ERROR,
            stages,
            None,
            AASISTResult(),
            DeepFilterNetResult(),
            SileroVADResult(),
            ECAPAResult(threshold=threshold),
            None,
            None
        )

    # ==========================================
    # STAGE 2: AASIST Anti-Spoofing Detection
    # ==========================================
    t0 = time.time()
    if aasist_model.is_available:
        try:
            is_bonafide, pred_class, bona_prob, spoof_prob, inf_time = aasist_model.predict(active_audio_path)
            aasist_res = AASISTResult(
                is_functional=True,
                prediction=pred_class,
                bona_fide_prob=bona_prob,
                spoof_prob=spoof_prob,
                inference_time_ms=inf_time,
                status_note="Executed real AASIST model"
            )
            if not is_bonafide or pred_class == "spoof":
                # Spoof detected: reject immediately and skip subsequent stages
                logger.warning(
                    "AASIST Anti-Spoofing triggered SPOOF detection: spoof_prob=%.4f >= bona_prob=%.4f",
                    spoof_prob, bona_prob
                )
                stages.append(PipelineStageInfo(
                    name="AASIST Anti-Spoofing",
                    stage_number=2,
                    status=StageStatus.COMPLETED,
                    is_model_connected=True,
                    execution_time_ms=round(inf_time, 2),
                    summary=f"Spoof detected (Probability: {spoof_prob:.3f})",
                    details=aasist_res.dict()
                ))
                # Skip subsequent stages
                for s_num, s_name in [
                    (3, "DeepFilterNet3 Enhancement"),
                    (4, "Silero VAD"),
                    (5, "ECAPA-TDNN Embedding"),
                    (6, "Final Authentication Decision")
                ]:
                    stages.append(PipelineStageInfo(
                        name=s_name,
                        stage_number=s_num,
                        status=StageStatus.SKIPPED,
                        is_model_connected=False,
                        summary="Skipped due to spoof detection in Stage 2"
                    ))
                return (
                    AuthenticationDecision.SPOOF_DETECTED,
                    stages,
                    std_result,
                    aasist_res,
                    DeepFilterNetResult(),
                    SileroVADResult(),
                    ECAPAResult(threshold=threshold),
                    None,
                    None
                )
            else:
                stages.append(PipelineStageInfo(
                    name="AASIST Anti-Spoofing",
                    stage_number=2,
                    status=StageStatus.COMPLETED,
                    is_model_connected=True,
                    execution_time_ms=round(inf_time, 2),
                    summary=f"Bona fide verified (Bona fide prob: {bona_prob:.3f})",
                    details=aasist_res.dict()
                ))
        except Exception as e:
            logger.error("AASIST Anti-Spoofing execution failed: %s", e)
            stages.append(PipelineStageInfo(
                name="AASIST Anti-Spoofing",
                stage_number=2,
                status=StageStatus.FAILED,
                is_model_connected=True,
                execution_time_ms=round((time.time() - t0) * 1000, 2),
                error_message=str(e)
            ))
            return (
                AuthenticationDecision.PROCESSING_ERROR,
                stages,
                std_result,
                AASISTResult(status_note=str(e)),
                DeepFilterNetResult(),
                SileroVADResult(),
                ECAPAResult(threshold=threshold),
                None,
                None
            )
    else:
        aasist_res = AASISTResult(
            is_functional=False,
            status_note=aasist_model.get_status()["status_message"]
        )
        stages.append(PipelineStageInfo(
            name="AASIST Anti-Spoofing",
            stage_number=2,
            status=StageStatus.AWAITING_MODEL,
            is_model_connected=False,
            summary="Awaiting AASIST ONNX model integration"
        ))

    # ==========================================
    # STAGE 3: DeepFilterNet3 Audio Enhancement
    # ==========================================
    t0 = time.time()
    if deepfilternet_model.is_available:
        try:
            enhanced_path = active_audio_path.replace(".wav", "_enhanced.wav")
            success, proc_time = deepfilternet_model.enhance(active_audio_path, enhanced_path)
            active_audio_path = enhanced_path
            df_res = DeepFilterNetResult(
                is_functional=True,
                processing_time_ms=proc_time,
                status_note="Enhanced at 48kHz and resampled to 16kHz"
            )
            stages.append(PipelineStageInfo(
                name="DeepFilterNet3 Enhancement",
                stage_number=3,
                status=StageStatus.COMPLETED,
                is_model_connected=True,
                execution_time_ms=round(proc_time, 2),
                summary="Audio noise suppressed (48 kHz internal)",
                details=df_res.dict()
            ))
        except Exception as e:
            logger.error("DeepFilterNet3 Enhancement failed: %s", e)
            stages.append(PipelineStageInfo(
                name="DeepFilterNet3 Enhancement",
                stage_number=3,
                status=StageStatus.FAILED,
                is_model_connected=True,
                execution_time_ms=round((time.time() - t0) * 1000, 2),
                error_message=str(e)
            ))
            df_res = DeepFilterNetResult(status_note=str(e))
    else:
        df_res = DeepFilterNetResult(
            is_functional=False,
            status_note=deepfilternet_model.get_status()["status_message"]
        )
        stages.append(PipelineStageInfo(
            name="DeepFilterNet3 Enhancement",
            stage_number=3,
            status=StageStatus.AWAITING_MODEL,
            is_model_connected=False,
            summary="Awaiting DeepFilterNet3 model integration"
        ))

    # ==========================================
    # STAGE 4: Silero Voice Activity Detection
    # ==========================================
    t0 = time.time()
    if silero_vad_model.is_available:
        try:
            has_speech, orig_dur, speech_dur, sil_removed, vad_time = silero_vad_model.process(active_audio_path)
            vad_res = SileroVADResult(
                is_functional=True,
                original_duration_sec=orig_dur,
                speech_duration_sec=speech_dur,
                silence_removed_sec=sil_removed,
                speech_ratio=round(speech_dur / orig_dur, 3) if orig_dur > 0 else 0,
                status_note="VAD speech detection completed"
            )
            if not has_speech or speech_dur < 0.5:
                stages.append(PipelineStageInfo(
                    name="Silero VAD",
                    stage_number=4,
                    status=StageStatus.COMPLETED,
                    is_model_connected=True,
                    execution_time_ms=round(vad_time, 2),
                    summary=f"Insufficient speech detected ({speech_dur:.2f}s speech remaining)",
                    details=vad_res.dict()
                ))
                # Skip stages 5 and 6
                for s_num, s_name in [
                    (5, "ECAPA-TDNN Embedding"),
                    (6, "Final Authentication Decision")
                ]:
                    stages.append(PipelineStageInfo(
                        name=s_name,
                        stage_number=s_num,
                        status=StageStatus.SKIPPED,
                        is_model_connected=False,
                        summary="Skipped due to insufficient speech detected in VAD"
                    ))
                return (
                    AuthenticationDecision.AUDIO_QUALITY_INSUFFICIENT,
                    stages,
                    std_result,
                    aasist_res,
                    df_res,
                    vad_res,
                    ECAPAResult(threshold=threshold),
                    None,
                    None
                )
            else:
                stages.append(PipelineStageInfo(
                    name="Silero VAD",
                    stage_number=4,
                    status=StageStatus.COMPLETED,
                    is_model_connected=True,
                    execution_time_ms=round(vad_time, 2),
                    summary=f"Speech validated: {speech_dur:.2f}s speech ({sil_removed:.2f}s silence trimmed)",
                    details=vad_res.dict()
                ))
        except Exception as e:
            logger.error("Silero VAD failed: %s", e)
            stages.append(PipelineStageInfo(
                name="Silero VAD",
                stage_number=4,
                status=StageStatus.FAILED,
                is_model_connected=True,
                execution_time_ms=round((time.time() - t0) * 1000, 2),
                error_message=str(e)
            ))
            vad_res = SileroVADResult(status_note=str(e))
    else:
        vad_res = SileroVADResult(
            is_functional=False,
            status_note=silero_vad_model.get_status()["status_message"]
        )
        stages.append(PipelineStageInfo(
            name="Silero VAD",
            stage_number=4,
            status=StageStatus.AWAITING_MODEL,
            is_model_connected=False,
            summary="Awaiting Silero VAD model integration"
        ))

    # ==========================================
    # STAGE 5: ECAPA-TDNN Speaker Embedding Extraction
    # ==========================================
    t0 = time.time()
    similarity_score = None
    if ecapa_model.is_available:
        try:
            emb, ecapa_time = ecapa_model.extract_embedding(active_audio_path)
            extracted_embedding = emb
            if reference_embedding is not None:
                similarity_score = ecapa_model.compute_similarity(emb, reference_embedding)
                is_matched = similarity_score >= threshold
            else:
                is_matched = None

            ecapa_res = ECAPAResult(
                is_functional=True,
                embedding_dimension=192,
                similarity_score=similarity_score,
                threshold=threshold,
                is_matched=is_matched,
                status_note="Extracted 192-dim ECAPA-TDNN embedding"
            )
            stages.append(PipelineStageInfo(
                name="ECAPA-TDNN Embedding Extraction",
                stage_number=5,
                status=StageStatus.COMPLETED,
                is_model_connected=True,
                execution_time_ms=round(ecapa_time, 2),
                summary=f"192-dim embedding extracted | Similarity: {similarity_score:.4f}" if similarity_score is not None else "192-dim embedding extracted",
                details=ecapa_res.dict()
            ))
        except Exception as e:
            logger.error("ECAPA-TDNN extraction failed: %s", e)
            stages.append(PipelineStageInfo(
                name="ECAPA-TDNN Embedding Extraction",
                stage_number=5,
                status=StageStatus.FAILED,
                is_model_connected=True,
                execution_time_ms=round((time.time() - t0) * 1000, 2),
                error_message=str(e)
            ))
            ecapa_res = ECAPAResult(threshold=threshold, status_note=str(e))
    else:
        ecapa_res = ECAPAResult(
            is_functional=False,
            threshold=threshold,
            status_note=ecapa_model.get_status()["status_message"]
        )
        stages.append(PipelineStageInfo(
            name="ECAPA-TDNN Embedding Extraction",
            stage_number=5,
            status=StageStatus.AWAITING_MODEL,
            is_model_connected=False,
            summary="Awaiting ECAPA-TDNN model integration"
        ))

    # ==========================================
    # STAGE 6: Final Decision
    # ==========================================
    if ecapa_model.is_available and similarity_score is not None:
        if similarity_score >= threshold:
            decision = AuthenticationDecision.AUTHENTICATED
            summary = f"AUTHENTICATED (Similarity {similarity_score:.4f} >= Threshold {threshold:.2f})"
        else:
            decision = AuthenticationDecision.NOT_AUTHENTICATED
            summary = f"NOT AUTHENTICATED (Similarity {similarity_score:.4f} < Threshold {threshold:.2f})"
        stage_status = StageStatus.COMPLETED
    elif not ecapa_model.is_available:
        decision = AuthenticationDecision.AWAITING_MODEL_INTEGRATION
        summary = "Audio standardized successfully. Full pipeline awaiting ML model weights."
        stage_status = StageStatus.AWAITING_MODEL
    else:
        decision = AuthenticationDecision.SPEAKER_NOT_ENROLLED
        summary = "No reference embedding available for comparison."
        stage_status = StageStatus.FAILED

    stages.append(PipelineStageInfo(
        name="Final Authentication Decision",
        stage_number=6,
        status=stage_status,
        is_model_connected=ecapa_model.is_available,
        summary=summary,
        details={"decision": decision.value, "threshold": threshold, "similarity": similarity_score}
    ))

    return (
        decision,
        stages,
        std_result,
        aasist_res,
        df_res,
        vad_res,
        ecapa_res,
        similarity_score,
        extracted_embedding
    )
