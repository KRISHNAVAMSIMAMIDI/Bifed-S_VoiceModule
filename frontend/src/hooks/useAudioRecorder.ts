import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  audioLevel: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  discardRecording: () => void;
  hasAudio: boolean;
}

/**
 * Encodes a Float32Array of audio samples into a standard 16-bit PCM WAV Blob.
 */
function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  // fmt subchunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // data subchunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert float samples [-1.0, 1.0] to 16-bit PCM [-32768, 32767]
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1.0, Math.min(1.0, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * High-quality linear resampling from inRate to outRate.
 */
function resampleLinear(samples: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate || samples.length === 0) {
    return samples;
  }
  const ratio = inRate / outRate;
  const outLength = Math.round(samples.length / ratio);
  const result = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const origIndex = i * ratio;
    const i1 = Math.floor(origIndex);
    const i2 = Math.min(i1 + 1, samples.length - 1);
    const fraction = origIndex - i1;
    result[i] = samples[i1] * (1 - fraction) + samples[i2] * fraction;
  }
  return result;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Fallback MediaRecorder for environments where Web Audio is restricted
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mrChunksRef = useRef<Blob[]>([]);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecordingRef.current || isPausedRef.current) {
      setAudioLevel(0);
      return;
    }
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const cleanupAudioStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    pcmChunksRef.current = [];
    mrChunksRef.current = [];
    setRecordingDuration(0);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioBlob(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      // For biometric anti-spoofing and speaker verification, we request raw linear audio.
      // echoCancellation and autoGainControl are explicitly set to false to prevent
      // WebRTC telephony high-pass filtering (80Hz cutoff) and non-linear spectral distortion,
      // which AASIST detects as synthetic speech or replay attack artifacts.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch {
        // Fallback with standard constraints if browser refuses strict false constraints
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
          },
        });
      }
      streamRef.current = stream;

      // Initialize Web Audio Context
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Try 16 kHz sample rate if supported; otherwise use default hardware rate and resample
      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioCtx({ sampleRate: 16000 });
      } catch {
        audioCtx = new AudioCtx();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // ScriptProcessorNode collects raw 32-bit float PCM samples directly from microphone
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!isRecordingRef.current || isPausedRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      // Connect to destination to keep processing alive (silent dummy destination)
      processor.connect(audioCtx.destination);

      // Also initialize MediaRecorder as backup
      try {
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
        let selectedMime = '';
        for (const m of mimeTypes) {
          if (MediaRecorder.isTypeSupported(m)) {
            selectedMime = m;
            break;
          }
        }
        if (selectedMime) {
          const mr = new MediaRecorder(stream, { mimeType: selectedMime, audioBitsPerSecond: 128000 });
          mediaRecorderRef.current = mr;
          mr.ondataavailable = (ev: BlobEvent) => {
            if (ev.data && ev.data.size > 0) mrChunksRef.current.push(ev.data);
          };
          mr.start(200);
        }
      } catch (mrErr) {
        console.warn('MediaRecorder backup init skipped:', mrErr);
      }

      isRecordingRef.current = true;
      isPausedRef.current = false;
      setIsRecording(true);
      setIsPaused(false);

      // Start duration timer
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Start level meter
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and reload.');
      } else {
        setError(`Microphone error: ${err.message || 'Unable to start recording.'}`);
      }
      cleanupAudioStream();
    }
  }, [audioUrl, cleanupAudioStream, updateAudioLevel]);

  const pauseRecording = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resumeRecording = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    timerRef.current = window.setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [updateAudioLevel]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    isPausedRef.current = false;
    setIsRecording(false);
    setIsPaused(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Process collected uncompressed PCM samples
    const chunks = pcmChunksRef.current;
    const currentAudioCtx = audioContextRef.current;
    const currentSampleRate = currentAudioCtx ? currentAudioCtx.sampleRate : 16000;

    let finalBlob: Blob | null = null;

    if (chunks.length > 0) {
      // Concatenate all chunks
      let totalSamples = 0;
      for (let i = 0; i < chunks.length; i++) {
        totalSamples += chunks[i].length;
      }
      const allSamples = new Float32Array(totalSamples);
      let offset = 0;
      for (let i = 0; i < chunks.length; i++) {
        allSamples.set(chunks[i], offset);
        offset += chunks[i].length;
      }

      // Resample to 16,000 Hz if recorded at a different hardware rate (e.g. 44.1k or 48k)
      const resampledSamples = resampleLinear(allSamples, currentSampleRate, 16000);

      // Check if samples contain actual audio
      let sumSq = 0;
      for (let i = 0; i < resampledSamples.length; i++) {
        sumSq += resampledSamples[i] * resampledSamples[i];
      }
      const rms = Math.sqrt(sumSq / resampledSamples.length);

      if (resampledSamples.length < 8000 || rms < 0.001) {
        setError('Recording is too short or empty. Please speak clearly into your microphone.');
      } else {
        // Encode directly into uncompressed 16-bit 16 kHz mono WAV
        finalBlob = encodeWavBlob(resampledSamples, 16000);
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
      }
    } else if (mrChunksRef.current.length > 0) {
      // Fallback from MediaRecorder if AudioContext produced no chunks
      const backupBlob = new Blob(mrChunksRef.current, { type: 'audio/webm' });
      setAudioBlob(backupBlob);
      const url = URL.createObjectURL(backupBlob);
      setAudioUrl(url);
    } else {
      setError('No audio data captured. Please check microphone permissions.');
    }

    cleanupAudioStream();
  }, [cleanupAudioStream]);

  const discardRecording = useCallback(() => {
    isRecordingRef.current = false;
    isPausedRef.current = false;
    setIsRecording(false);
    setIsPaused(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupAudioStream();

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setAudioLevel(0);
    setError(null);
    pcmChunksRef.current = [];
    mrChunksRef.current = [];
  }, [cleanupAudioStream, audioUrl]);

  useEffect(() => {
    return () => {
      cleanupAudioStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [cleanupAudioStream, audioUrl]);

  return {
    isRecording,
    isPaused,
    recordingDuration,
    audioBlob,
    audioUrl,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    hasAudio: audioBlob !== null,
  };
}
