"""
Stage 3: DeepFilterNet3 Audio Enhancement
Uses the deepfilternet pip package (pip install deepfilternet).
Model weights are downloaded automatically on first use.
Processing pipeline exactly as in the Colab notebook (cell 164 / bifeds_inference.py):
  1. Read standardized 16 kHz mono float32 audio
  2. Resample 16 kHz → 48 kHz (DeepFilterNet3 internal SR)
  3. Run enhancement with no_grad
  4. Resample enhanced 48 kHz → 16 kHz
  5. Write result to output path
"""
import os
import time
import logging
from typing import Dict, Any, Tuple

import numpy as np

from app.models.base import BaseVoiceModel
from app.config import settings

logger = logging.getLogger("BiFed-S-VoiceAuth")


class DeepFilterNet3Model(BaseVoiceModel):
    """
    Stage 3: DeepFilterNet3 Audio Enhancement.
    Loaded from the deepfilternet package (auto-downloads model on first call).
    """

    def __init__(self):
        local_path = str(settings.MODELS_DIR / "deepfilternet3")
        super().__init__("DeepFilterNet3 Enhancement", local_path)
        self._df_model = None
        self._df_state = None
        self._df_sr: int = 48000

    # ----------------------------------------------------------
    # Load
    # ----------------------------------------------------------
    def load(self) -> bool:
        try:
            import torch
            from df.enhance import init_df
            logger.info("Initializing DeepFilterNet3...")
            if os.path.isdir(self.expected_weight_path):
                self._df_model, self._df_state, _ = init_df(model_base_dir=self.expected_weight_path)
            else:
                self._df_model, self._df_state, _ = init_df()
            self._df_sr = int(self._df_state.sr())
            self._is_loaded = True
            self._error_message = ""
            logger.info(f"DeepFilterNet3 initialized. Internal SR: {self._df_sr} Hz")
            return True
        except ImportError as e:
            self._is_loaded = False
            self._error_message = f"deepfilternet not installed ({e}). Run: pip install deepfilternet"
            logger.warning(self._error_message)
            return False
        except Exception as e:
            self._is_loaded = False
            self._error_message = f"DeepFilterNet3 init failed: {e}"
            logger.error(self._error_message)
            return False

    # ----------------------------------------------------------
    # Enhance — exact logic from Colab notebook (cell 164)
    # ----------------------------------------------------------
    def enhance(self, input_path: str, output_path: str) -> Tuple[bool, float]:
        """
        Enhance audio at input_path and write to output_path.
        Returns (success, processing_time_ms).
        """
        if not self.is_available:
            raise RuntimeError(f"DeepFilterNet3 not loaded: {self._error_message}")

        import soundfile as sf
        import scipy.signal
        import torch
        from df.enhance import enhance as df_enhance

        audio, sr = sf.read(input_path)

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        if sr != 16000:
            raise ValueError(f"Expected 16000 Hz input, got {sr}")

        audio = audio.astype(np.float32)

        t0 = time.time()

        # 16 kHz → 48 kHz
        gcd_up = int(np.gcd(self._df_sr, 16000))
        audio_48k = scipy.signal.resample_poly(
            audio,
            self._df_sr // gcd_up,
            16000 // gcd_up,
        ).astype(np.float32)

        audio_tensor = torch.from_numpy(audio_48k).unsqueeze(0)

        with torch.no_grad():
            enhanced_tensor = df_enhance(
                self._df_model,
                self._df_state,
                audio_tensor,
            )

        enhanced_48k = enhanced_tensor.squeeze().cpu().numpy().astype(np.float32)

        # 48 kHz → 16 kHz
        gcd_down = int(np.gcd(self._df_sr, 16000))
        enhanced_16k = scipy.signal.resample_poly(
            enhanced_48k,
            16000 // gcd_down,
            self._df_sr // gcd_down,
        ).astype(np.float32)

        proc_ms = (time.time() - t0) * 1000

        sf.write(output_path, enhanced_16k, 16000)

        return True, proc_ms

    # ----------------------------------------------------------
    # Status
    # ----------------------------------------------------------
    def get_status(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "stage": 3,
            "is_functional": self.is_available,
            "internal_sr": self._df_sr if self.is_available else 48000,
            "status_message": "Functional (Loaded)" if self.is_available else self._error_message,
        }


deepfilternet_model = DeepFilterNet3Model()
