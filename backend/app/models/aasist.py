"""
Stage 2: AASIST Anti-Spoofing Detection
Uses the AASIST ONNX model from HuggingFace: SpeechAntiSpoofingBenchmarks/AASIST
Pretrained on the ASVspoof 2019 benchmark dataset.
Preprocessing exactly as developed in the original Colab reference (cell 64 / 182 / 185 / 188):
  - Fixed length: 64,600 samples at 16,000 Hz (4.0375 seconds)
  - Short audio (< 64,600 samples): periodic repeated padding (np.tile)
  - Long audio (> 64,600 samples): highest vocal energy window selection to evaluate active speech
  - Raw float32 waveform input tensor shape: [1, 64600]
  - Softmax over 2-class logits: [spoof_prob, bona_fide_prob]
  - Classification: bona_fide if bona_fide_prob > spoof_prob, else spoof
"""
import os
import time
import logging
from typing import Dict, Any, Tuple, Optional

import numpy as np

from app.models.base import BaseVoiceModel
from app.config import settings

logger = logging.getLogger("BiFed-S-VoiceAuth")

AASIST_REPO_ID = "SpeechAntiSpoofingBenchmarks/AASIST"
AASIST_FILENAME = "aasist.onnx"
AASIST_REQUIRED_SAMPLES = 64600   # 4.0375 s @ 16 kHz


class AASISTAntiSpoofModel(BaseVoiceModel):
    """
    Stage 2: AASIST Anti-Spoofing Detection.
    Loads the ONNX model from local models_weights or downloads from HuggingFace.
    """

    def __init__(self):
        local_path = str(settings.MODELS_DIR / "aasist" / AASIST_FILENAME)
        super().__init__("AASIST Anti-Spoofing", local_path)
        self.session = None
        self._input_name: Optional[str] = None

    # ----------------------------------------------------------
    # Load
    # ----------------------------------------------------------
    def load(self) -> bool:
        # 1. Try local file first
        if os.path.exists(self.expected_weight_path):
            return self._init_session(self.expected_weight_path)

        # 2. Try HuggingFace auto-download
        try:
            from huggingface_hub import hf_hub_download
            logger.info("Downloading AASIST ONNX from HuggingFace...")
            os.makedirs(os.path.dirname(self.expected_weight_path), exist_ok=True)
            downloaded = hf_hub_download(
                repo_id=AASIST_REPO_ID,
                filename=AASIST_FILENAME,
                local_dir=os.path.dirname(self.expected_weight_path),
            )
            logger.info(f"AASIST downloaded to: {downloaded}")
            return self._init_session(downloaded)
        except ImportError:
            self._is_loaded = False
            self._error_message = "huggingface_hub not installed. Run: pip install huggingface_hub"
            return False
        except Exception as e:
            self._is_loaded = False
            self._error_message = f"HuggingFace download failed: {e}"
            logger.warning(self._error_message)
            return False

    def _init_session(self, model_path: str) -> bool:
        try:
            import onnxruntime as ort
            self.session = ort.InferenceSession(
                model_path,
                providers=["CPUExecutionProvider"],
            )
            self._input_name = self.session.get_inputs()[0].name
            self._is_loaded = True
            self._error_message = ""
            logger.info("AASIST ONNX session initialized successfully.")
            return True
        except ImportError:
            self._is_loaded = False
            self._error_message = "onnxruntime not installed. Run: pip install onnxruntime"
            return False
        except Exception as e:
            self._is_loaded = False
            self._error_message = f"Failed to load AASIST: {e}"
            logger.error(self._error_message)
            return False

    # ----------------------------------------------------------
    # Inference — exact logic from notebook cell 64 / 182 / 185
    # ----------------------------------------------------------
    def predict(self, audio_path: str) -> Tuple[bool, str, float, float, float]:
        """
        Runs AASIST anti-spoofing detection on the standardized audio file.
        Returns:
            (is_bonafide, predicted_class, bona_fide_prob, spoof_prob, inference_time_ms)
        """
        if not self.is_available or self.session is None:
            raise RuntimeError(f"AASIST not loaded: {self._error_message}")

        import soundfile as sf

        audio, sr = sf.read(audio_path)

        if audio.ndim == 2:
            audio = audio.mean(axis=1)

        if sr != 16000:
            raise ValueError(f"Expected 16000 Hz standardized audio, got {sr}")

        audio = audio.astype(np.float32)
        total_samples = len(audio)

        # Pad or select 64600 samples
        if total_samples < AASIST_REQUIRED_SAMPLES:
            # Short audio: repeat padding as in Colab notebook cell 64/182
            repeats = int(np.ceil(AASIST_REQUIRED_SAMPLES / total_samples))
            audio_input = np.tile(audio, repeats)[:AASIST_REQUIRED_SAMPLES]
        elif total_samples == AASIST_REQUIRED_SAMPLES:
            audio_input = audio
        else:
            # Audio is longer than 64600 samples (4.04s):
            # In live microphone recordings, users typically have leading/trailing pauses.
            # Select the 64,600-sample window with the maximum signal energy to evaluate
            # the active speech segment rather than silent margins.
            hop = int(sr * 0.1)  # 100ms hop
            best_energy = -1.0
            best_start = 0
            for start in range(0, total_samples - AASIST_REQUIRED_SAMPLES + 1, hop):
                energy = float(np.sum(audio[start : start + AASIST_REQUIRED_SAMPLES] ** 2))
                if energy > best_energy:
                    best_energy = energy
                    best_start = start
            audio_input = audio[best_start : best_start + AASIST_REQUIRED_SAMPLES]

        input_rms = float(np.sqrt(np.mean(audio_input ** 2)))
        input_peak = float(np.max(np.abs(audio_input)))
        logger.info(
            "AASIST evaluation on %s: duration=%.2fs (total=%.2fs), input_shape=%s, rms=%.4f, peak=%.4f",
            os.path.basename(audio_path),
            len(audio_input) / sr,
            total_samples / sr,
            audio_input.shape,
            input_rms,
            input_peak,
        )

        t0 = time.time()
        logits = self.session.run(
            None,
            {self._input_name: audio_input[np.newaxis, :]}
        )[0][0]
        inf_ms = (time.time() - t0) * 1000

        # Numerically stable softmax: logits[0] = spoof, logits[1] = bona_fide
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / exp_logits.sum()

        spoof_prob = float(probs[0])
        bona_fide_prob = float(probs[1])

        is_bonafide = bona_fide_prob > spoof_prob
        predicted_class = "bona_fide" if is_bonafide else "spoof"

        logger.info(
            "AASIST result: spoof_logit=%.3f, bona_logit=%.3f | spoof_prob=%.4f, bona_prob=%.4f | prediction=%s | time=%.1fms",
            float(logits[0]),
            float(logits[1]),
            spoof_prob,
            bona_fide_prob,
            predicted_class,
            inf_ms,
        )

        return is_bonafide, predicted_class, bona_fide_prob, spoof_prob, inf_ms

    # ----------------------------------------------------------
    # Status
    # ----------------------------------------------------------
    def get_status(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "stage": 2,
            "is_functional": self.is_available,
            "weight_file_found": os.path.exists(self.expected_weight_path),
            "expected_weight_path": self.expected_weight_path,
            "hf_repo": AASIST_REPO_ID,
            "status_message": "Functional (Loaded)" if self.is_available else self._error_message,
        }


aasist_model = AASISTAntiSpoofModel()
