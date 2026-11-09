"""
Stage 4: Silero Voice Activity Detection
Uses the silero-vad pip package (pip install silero-vad).
Model weights are downloaded automatically by the package.
Processing logic exactly as in the Colab notebook (cell 15 / 17 / bifeds_inference.py):
  - load_silero_vad() + get_speech_timestamps()
  - threshold=0.5, min_speech=100ms, min_silence=200ms, pad=100ms
  - Concatenate speech segments (not just span first-to-last)
  - Minimum speech: 0.5s (= TARGET_SR // 2)
"""
import os
import time
import logging
from typing import Dict, Any, Tuple, Optional

import numpy as np

from app.models.base import BaseVoiceModel

logger = logging.getLogger("BiFed-S-VoiceAuth")

TARGET_SR = 16000
MIN_SPEECH_SAMPLES = TARGET_SR // 2   # 0.5 s


class SileroVADModel(BaseVoiceModel):
    """
    Stage 4: Silero Voice Activity Detection.
    Auto-downloads weights via the silero-vad package.
    Returns trimmed speech-only audio written to the same path (in-place).
    """

    def __init__(self):
        super().__init__("Silero VAD", "silero_vad_package")
        self._vad_model = None

    # ----------------------------------------------------------
    # Load
    # ----------------------------------------------------------
    def load(self) -> bool:
        try:
            from silero_vad import load_silero_vad
            logger.info("Loading Silero VAD model (auto-downloads on first use)...")
            self._vad_model = load_silero_vad()
            self._vad_model.eval()
            self._is_loaded = True
            self._error_message = ""
            logger.info("Silero VAD model loaded successfully.")
            return True
        except ImportError as e:
            self._is_loaded = False
            self._error_message = f"silero-vad not installed ({e}). Run: pip install silero-vad"
            logger.warning(self._error_message)
            return False
        except Exception as e:
            self._is_loaded = False
            self._error_message = f"Silero VAD load failed: {e}"
            logger.error(self._error_message)
            return False

    # ----------------------------------------------------------
    # Process — exact logic from Colab (cell 17 / bifeds_inference.py)
    # ----------------------------------------------------------
    def process(self, audio_path: str) -> Tuple[bool, float, float, float, float]:
        """
        Apply VAD: detect and concatenate speech segments, overwrite audio_path.
        Returns:
            (has_sufficient_speech, original_duration_sec, speech_duration_sec,
             silence_removed_sec, processing_time_ms)
        """
        if not self.is_available or self._vad_model is None:
            raise RuntimeError(f"Silero VAD not loaded: {self._error_message}")

        import soundfile as sf
        import torch
        from silero_vad import get_speech_timestamps

        audio, sr = sf.read(audio_path)

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        if sr != TARGET_SR:
            raise ValueError(f"Expected {TARGET_SR} Hz, got {sr}")

        if not np.isfinite(audio).all():
            raise ValueError("Audio contains NaN or Inf values")

        audio = audio.astype(np.float32)
        original_duration = len(audio) / sr

        t0 = time.time()

        waveform = torch.from_numpy(audio.copy())

        timestamps = get_speech_timestamps(
            waveform,
            self._vad_model,
            sampling_rate=TARGET_SR,
            threshold=0.5,
            min_speech_duration_ms=100,
            min_silence_duration_ms=200,
            speech_pad_ms=100,
        )

        proc_ms = (time.time() - t0) * 1000

        if not timestamps:
            return False, original_duration, 0.0, original_duration, proc_ms

        # Concatenate all speech segments (as in bifeds_inference.py)
        segments = [audio[item["start"]: item["end"]] for item in timestamps]
        speech_audio = np.concatenate(segments).astype(np.float32)

        speech_duration = len(speech_audio) / sr
        silence_removed = original_duration - speech_duration

        has_sufficient = len(speech_audio) >= MIN_SPEECH_SAMPLES

        if has_sufficient:
            # Overwrite the file with speech-only audio
            sf.write(audio_path, speech_audio, sr, subtype="PCM_16")

        return has_sufficient, original_duration, speech_duration, silence_removed, proc_ms

    # ----------------------------------------------------------
    # Status
    # ----------------------------------------------------------
    def get_status(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "stage": 4,
            "is_functional": self.is_available,
            "status_message": "Functional (Loaded)" if self.is_available else self._error_message,
        }


silero_vad_model = SileroVADModel()
