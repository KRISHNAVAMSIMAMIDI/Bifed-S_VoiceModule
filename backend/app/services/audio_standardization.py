"""
Stage 1: Audio Standardization
Decodes audio formats (WAV from browser or uploads, WebM/Opus, MP3, FLAC, OGG),
validates signal quality and duration, converts to mono 16 kHz, removes DC offset
and sub-audible mic turn-on pops, and writes a clean 16-bit PCM WAV.
"""
import os
import uuid
import time
import logging
import wave
import subprocess
import shutil
from pathlib import Path
from typing import Optional, Tuple

import numpy as np

from app.config import settings
from app.schemas.pipeline import StandardizationResult

logger = logging.getLogger("BiFed-S-VoiceAuth")

TARGET_SR = 16000
TARGET_CHANNELS = 1
MIN_DURATION_SECONDS = 1.0
MAX_DURATION_SECONDS = 30.0
MIN_PEAK_THRESHOLD = 0.015
MIN_RMS_THRESHOLD = 0.003


def standardize_audio(raw_audio_path: str) -> StandardizationResult:
    """
    Main entry point: reads any audio file, validates signal quality and duration,
    converts to standardized 16 kHz mono WAV, and writes to the temp directory.
    """
    t0 = time.time()

    if not os.path.exists(raw_audio_path):
        raise FileNotFoundError(f"Audio file not found: {raw_audio_path}")

    file_size = os.path.getsize(raw_audio_path)
    if file_size == 0:
        raise ValueError("Audio file is 0 bytes (empty file). Please record or upload a valid audio sample.")

    # 1. Detect format
    audio_fmt = _detect_format(raw_audio_path)
    logger.info("Standardizing audio: %s | detected format: %s | size: %d bytes",
                os.path.basename(raw_audio_path), audio_fmt, file_size)

    # 2. Load audio into float32 numpy array
    audio, original_sr = _load_audio(raw_audio_path, audio_fmt)

    if audio is None or len(audio) == 0:
        raise ValueError("Decoded audio contains no samples. The audio data may be corrupt or unreadable.")

    original_channels = audio.ndim
    original_duration = len(audio) / original_sr if audio.ndim == 1 else audio.shape[0] / original_sr

    # 3. Convert to mono if multi-channel
    if audio.ndim == 2:
        audio = np.mean(audio, axis=1)

    audio = audio.astype(np.float32)

    # 4. Resample to TARGET_SR (16,000 Hz) if needed
    if original_sr != TARGET_SR:
        logger.info("Resampling audio from %d Hz to %d Hz", original_sr, TARGET_SR)
        audio = _resample(audio, original_sr, TARGET_SR)

    # 5. Duration validation
    duration_seconds = len(audio) / TARGET_SR
    if duration_seconds < MIN_DURATION_SECONDS:
        raise ValueError(
            f"Audio recording is too short ({duration_seconds:.2f}s). "
            f"Minimum required duration is {MIN_DURATION_SECONDS:.1f} second of clear speech."
        )
    if duration_seconds > MAX_DURATION_SECONDS:
        raise ValueError(
            f"Audio recording exceeds the {MAX_DURATION_SECONDS:.0f}-second maximum limit ({duration_seconds:.1f}s)."
        )

    # 6. Demean (remove hardware DC bias)
    audio = audio - np.mean(audio)

    # 7. Remove sub-audible mic turn-on pops and sub-rumble using a gentle 40Hz Butterworth highpass filter.
    # Human speech fundamental frequencies range from 85Hz to 255Hz, so 40Hz leaves all speech formants intact
    # while eliminating transient power-on DC steps that cause AASIST false-spoof triggers.
    try:
        import scipy.signal
        sos = scipy.signal.butter(2, 40, 'hp', fs=TARGET_SR, output='sos')
        audio = scipy.signal.sosfilt(sos, audio).astype(np.float32)
    except Exception as e:
        logger.debug("Sub-audible highpass filtering skipped: %s", e)

    # 8. Signal quality, silence, and clipping validation
    raw_peak = float(np.max(np.abs(audio)))
    raw_rms = float(np.sqrt(np.mean(audio ** 2)))

    if raw_peak < MIN_PEAK_THRESHOLD or raw_rms < MIN_RMS_THRESHOLD:
        raise ValueError(
            f"Audio recording contains no detectable voice signal or is near-silent "
            f"(Peak: {raw_peak:.4f}, RMS: {raw_rms:.4f}). Please speak clearly into your microphone."
        )

    clipping_ratio = float(np.mean(np.abs(audio) >= 0.99))
    if clipping_ratio > 0.20:
        logger.warning(
            "Audio recording exhibits severe clipping: %.1f%% of samples >= 0.99",
            clipping_ratio * 100
        )

    # 9. Peak normalize to 0.95
    if raw_peak > 0:
        audio = (audio / raw_peak * 0.95).astype(np.float32)

    # 10. Write standardized WAV
    out_path = _write_wav(audio, TARGET_SR)

    proc_time = (time.time() - t0) * 1000

    logger.info(
        "Standardization complete: %s | duration: %.2fs | peak: %.3f | rms: %.4f | time: %.1fms",
        os.path.basename(out_path), duration_seconds, np.max(np.abs(audio)), np.sqrt(np.mean(audio ** 2)), proc_time
    )

    return StandardizationResult(
        audio_path=out_path,
        original_sample_rate=original_sr,
        processed_sample_rate=TARGET_SR,
        original_channels=original_channels,
        duration_seconds=round(duration_seconds, 3),
        file_size_bytes=file_size,
        processing_time_ms=round(proc_time, 2),
        format_detected=audio_fmt,
    )


# --------------------------------------------------------------------------
# Internal helpers
# --------------------------------------------------------------------------

def _detect_format(path: str) -> str:
    """Detect audio format from file header bytes."""
    try:
        with open(path, "rb") as f:
            header = f.read(16)
        if header[:4] == b"RIFF":
            return "wav"
        if header[:4] == b"fLaC":
            return "flac"
        if header[:3] == b"ID3" or (len(header) >= 2 and header[:2] == b"\xff\xfb"):
            return "mp3"
        # WebM / Matroska
        if header[:4] == b"\x1a\x45\xdf\xa3":
            return "webm"
        # OGG
        if header[:4] == b"OggS":
            return "ogg"
        # MP4/M4A
        if header[4:8] in (b"ftyp", b"moov", b"mdat"):
            return "mp4"
    except Exception:
        pass
    # Fall back on extension
    ext = Path(path).suffix.lower().lstrip(".")
    return ext if ext else "unknown"


def _load_audio(path: str, fmt: str) -> Tuple[np.ndarray, int]:
    """Load audio as float32 numpy array. Returns (audio, sample_rate)."""
    # Try soundfile first (handles WAV, FLAC, AIFF)
    if fmt in ("wav", "flac", "aiff"):
        try:
            import soundfile as sf
            audio, sr = sf.read(path, dtype="float32", always_2d=False)
            return audio, int(sr)
        except Exception as e:
            logger.warning(f"soundfile failed ({e}), trying ffmpeg fallback")

    # Try soundfile regardless for unknown formats
    try:
        import soundfile as sf
        audio, sr = sf.read(path, dtype="float32", always_2d=False)
        return audio, int(sr)
    except Exception:
        pass

    # FFmpeg fallback — handles WebM/Opus, MP3, OGG, MP4, etc.
    return _load_via_ffmpeg(path)


def _load_via_ffmpeg(path: str) -> Tuple[np.ndarray, int]:
    """Decode audio through ffmpeg to raw PCM and parse it."""
    ffmpeg_exe = _find_ffmpeg()

    if ffmpeg_exe is None:
        raise RuntimeError(
            "Cannot decode this audio format. ffmpeg not found. "
            "Please ensure imageio-ffmpeg is installed."
        )

    tmp_wav = str(settings.TEMP_DIR / f"decode_{uuid.uuid4().hex[:8]}.wav")

    try:
        result = subprocess.run(
            [
                ffmpeg_exe,
                "-y",
                "-i", path,
                "-ac", "1",
                "-ar", str(TARGET_SR),
                "-f", "wav",
                tmp_wav,
            ],
            capture_output=True,
            timeout=30,
        )

        if result.returncode != 0:
            err = result.stderr.decode("utf-8", errors="replace")[-500:]
            raise RuntimeError(f"ffmpeg decode failed: {err}")

        import soundfile as sf
        audio, sr = sf.read(tmp_wav, dtype="float32", always_2d=False)
        return audio, int(sr)

    finally:
        if os.path.exists(tmp_wav):
            try:
                os.remove(tmp_wav)
            except Exception:
                pass


def _find_ffmpeg() -> Optional[str]:
    """Return path to ffmpeg executable, or None if not found."""
    # 1. System ffmpeg
    sys_ffmpeg = shutil.which("ffmpeg")
    if sys_ffmpeg:
        return sys_ffmpeg

    # 2. imageio-ffmpeg
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            return exe
    except ImportError:
        pass

    return None


def _resample(audio: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    """Resample audio array from src_sr to dst_sr using scipy."""
    try:
        import scipy.signal
        gcd = int(np.gcd(src_sr, dst_sr))
        resampled = scipy.signal.resample_poly(audio, dst_sr // gcd, src_sr // gcd)
        return resampled.astype(np.float32)
    except ImportError:
        pass

    # Linear interpolation fallback
    n_samples_out = int(len(audio) * dst_sr / src_sr)
    indices = np.linspace(0, len(audio) - 1, n_samples_out)
    resampled = np.interp(indices, np.arange(len(audio)), audio)
    return resampled.astype(np.float32)


def _write_wav(audio: np.ndarray, sr: int) -> str:
    """Write float32 audio as 16-bit PCM WAV and return the file path."""
    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    out_path = str(settings.TEMP_DIR / f"std_{uuid.uuid4().hex[:8]}_16k.wav")

    try:
        import soundfile as sf
        sf.write(out_path, audio, sr, subtype="PCM_16")
        return out_path
    except ImportError:
        pass

    # stdlib wave fallback
    pcm = np.clip(audio, -1.0, 1.0)
    pcm_int16 = (pcm * 32767).astype(np.int16)
    with wave.open(out_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm_int16.tobytes())

    return out_path
