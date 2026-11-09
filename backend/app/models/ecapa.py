"""
Stage 5: ECAPA-TDNN Speaker Embedding Extraction
Uses SpeechBrain's EncoderClassifier with the pretrained
speechbrain/spkrec-ecapa-voxceleb model (auto-downloads from HuggingFace).
Exactly as used in the Colab notebook (cells 170 / 173 / bifeds_inference.py):
  - encode_batch on float32 waveform tensor [1, T]
  - L2-normalize the resulting 192-dimensional embedding
  - Cosine similarity = dot product of L2-normalized embeddings
"""
import os
import time
import logging
from typing import Dict, Any, Tuple, Optional

import numpy as np

from app.models.base import BaseVoiceModel
from app.config import settings

logger = logging.getLogger("BiFed-S-VoiceAuth")

ECAPA_REPO = "speechbrain/spkrec-ecapa-voxceleb"
EMBEDDING_DIM = 192


class ECAPATDNNModel(BaseVoiceModel):
    """
    Stage 5: ECAPA-TDNN Speaker Embedding Extraction.
    Auto-downloads from HuggingFace via SpeechBrain on first use.
    """

    def __init__(self):
        model_dir = str(settings.MODELS_DIR / "ecapa_tdnn")
        super().__init__("ECAPA-TDNN Speaker Embedding", model_dir)
        self._encoder = None

    # ----------------------------------------------------------
    # Load
    # ----------------------------------------------------------
    def load(self) -> bool:
        try:
            import torch
            from speechbrain.inference.speaker import EncoderClassifier
            from speechbrain.utils.fetching import LocalStrategy

            savedir = self.expected_weight_path
            os.makedirs(savedir, exist_ok=True)

            logger.info(f"Loading ECAPA-TDNN from HuggingFace ({ECAPA_REPO})...")
            self._encoder = EncoderClassifier.from_hparams(
                source=ECAPA_REPO,
                savedir=savedir,
                run_opts={"device": "cpu"},
                local_strategy=LocalStrategy.COPY,
            )
            self._is_loaded = True
            self._error_message = ""
            logger.info("ECAPA-TDNN model loaded successfully.")
            return True
        except ImportError as e:
            self._is_loaded = False
            self._error_message = f"speechbrain not installed ({e}). Run: pip install speechbrain"
            logger.warning(self._error_message)
            return False
        except Exception as e:
            self._is_loaded = False
            self._error_message = f"ECAPA-TDNN load failed: {e}"
            logger.error(self._error_message)
            return False

    # ----------------------------------------------------------
    # Extract embedding — exact logic from Colab (cell 170)
    # ----------------------------------------------------------
    def extract_embedding(self, audio_path: str) -> Tuple[np.ndarray, float]:
        """
        Extract a 192-dimensional L2-normalized speaker embedding.
        Returns (embedding_array, processing_time_ms).
        """
        if not self.is_available or self._encoder is None:
            raise RuntimeError(f"ECAPA-TDNN not loaded: {self._error_message}")

        import soundfile as sf
        import torch

        audio, sr = sf.read(audio_path)

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        if sr != 16000:
            raise ValueError(f"Expected 16000 Hz, got {sr}")

        audio = audio.astype(np.float32)

        waveform = torch.tensor(audio, dtype=torch.float32).unsqueeze(0)

        t0 = time.time()
        with torch.no_grad():
            embedding = self._encoder.encode_batch(waveform)
        proc_ms = (time.time() - t0) * 1000

        emb = embedding.squeeze().cpu().numpy().astype(np.float32)

        # L2 normalize (same as notebook)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm

        return emb, proc_ms

    # ----------------------------------------------------------
    # Cosine similarity (dot product of L2-normalized vectors)
    # ----------------------------------------------------------
    @staticmethod
    def compute_similarity(emb_a: np.ndarray, emb_b: np.ndarray) -> float:
        """Cosine similarity between two L2-normalized embeddings."""
        return float(np.dot(emb_a, emb_b))

    # ----------------------------------------------------------
    # Status
    # ----------------------------------------------------------
    def get_status(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "stage": 5,
            "is_functional": self.is_available,
            "embedding_dimension": EMBEDDING_DIM,
            "hf_repo": ECAPA_REPO,
            "savedir": self.expected_weight_path,
            "status_message": "Functional (Loaded)" if self.is_available else self._error_message,
        }


ecapa_model = ECAPATDNNModel()
