import React, { useState, useRef } from 'react';
import { Mic, MicOff, Pause, Play, Square, Upload, Trash2, Volume2, AlertCircle, FileAudio } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

interface AudioInputProps {
  label: string;
  onAudioReady: (blobOrFile: Blob | File, filename: string, source: 'recording' | 'upload') => void;
  onAudioCleared: () => void;
  disabled?: boolean;
}

export const AudioInput: React.FC<AudioInputProps> = ({
  label,
  onAudioReady,
  onAudioCleared,
  disabled = false,
}) => {
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadDuration, setUploadDuration] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isRecording,
    isPaused,
    recordingDuration,
    audioBlob,
    audioUrl,
    audioLevel,
    error: recordError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    hasAudio: hasRecordedAudio,
  } = useAudioRecorder();

  // Handle recorded audio completion
  React.useEffect(() => {
    if (audioBlob && !isRecording) {
      const ext = audioBlob.type.includes('wav') ? 'wav' : 'webm';
      onAudioReady(audioBlob, `recorded_voice_sample.${ext}`, 'recording');
    }
  }, [audioBlob, isRecording, onAudioReady]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size <= 25MB
    if (file.size > 25 * 1024 * 1024) {
      setFileError('File size exceeds the 25 MB maximum limit.');
      return;
    }

    // Revoke previous
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);

    const url = URL.createObjectURL(file);
    setUploadedFile(file);
    setUploadUrl(url);

    // Measure duration via Audio element
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      setUploadDuration(Math.round(tempAudio.duration * 10) / 10);
    };

    onAudioReady(file, file.name, 'upload');
  };

  const clearUpload = () => {
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    setUploadedFile(null);
    setUploadUrl(null);
    setUploadDuration(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onAudioCleared();
  };

  const handleDiscardRecording = () => {
    discardRecording();
    onAudioCleared();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          {label}
        </label>
        
        {/* Tab switcher */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            type="button"
            disabled={disabled || isRecording}
            onClick={() => setActiveTab('record')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'record'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Recording
          </button>
          <button
            type="button"
            disabled={disabled || isRecording}
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'upload'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Upload Audio
          </button>
        </div>
      </div>

      {/* Option A: Live Microphone Recording */}
      {activeTab === 'record' && (
        <div className="space-y-3">
          {recordError && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span>{recordError}</span>
            </div>
          )}

          {!hasRecordedAudio && !isRecording && (
            <div className="text-center py-6 px-4 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <div className="w-12 h-12 rounded-full bg-cyan-950/50 border border-cyan-800/50 flex items-center justify-center mx-auto mb-3">
                <Mic className="w-6 h-6 text-cyan-400" />
              </div>
              <p className="text-sm font-medium text-slate-200">Live Voice Sample Recording</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Speak clearly for at least 2–5 seconds. Audio will be converted to 16 kHz mono WAV for the pipeline.
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={startRecording}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                <Mic className="w-4 h-4" />
                Start Recording
              </button>
            </div>
          )}

          {/* Active Recording State */}
          {isRecording && (
            <div className="p-4 bg-slate-950/70 border border-cyan-800/50 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-xs font-medium text-slate-300">
                    {isPaused ? 'Recording Paused' : 'Recording in Progress...'}
                  </span>
                </div>
                <span className="font-mono text-sm text-cyan-400 font-bold">
                  {formatDuration(recordingDuration)}
                </span>
              </div>

              {/* Audio Level Indicator */}
              <div className="mb-4">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Input Mic Level</span>
                  <span>{audioLevel}%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                {isPaused ? (
                  <button
                    type="button"
                    onClick={resumeRecording}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    Pause
                  </button>
                )}
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  Stop Recording
                </button>
              </div>
            </div>
          )}

          {/* Finished Recording Preview */}
          {hasRecordedAudio && !isRecording && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-medium text-slate-200">
                    Recorded Audio Sample ({formatDuration(recordingDuration)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDiscardRecording}
                  disabled={disabled}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Discard & Re-record
                </button>
              </div>

              {audioUrl && (
                <audio
                  controls
                  src={audioUrl}
                  className="w-full h-8 rounded mt-1 bg-slate-900 border border-slate-800"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Option B: Audio File Upload */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          {fileError && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {!uploadedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="text-center py-6 px-4 border border-dashed border-slate-800 hover:border-cyan-700/60 rounded-xl bg-slate-950/40 cursor-pointer transition-colors group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/mp3,audio/mpeg,audio/flac"
                onChange={handleFileChange}
                disabled={disabled}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-slate-900 group-hover:bg-cyan-950/50 border border-slate-800 group-hover:border-cyan-800/50 flex items-center justify-center mx-auto mb-3 transition-colors">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              </div>
              <p className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">
                Click to select or drop an audio file
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports WAV, WebM, MP3, OGG (Max 25 MB)
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden pr-2">
                  <FileAudio className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="truncate text-xs">
                    <span className="font-medium text-slate-200">{uploadedFile.name}</span>
                    <span className="text-slate-400 ml-2">
                      ({(uploadedFile.size / 1024).toFixed(1)} KB{uploadDuration ? `, ${uploadDuration}s` : ''})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearUpload}
                  disabled={disabled}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 shrink-0 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>

              {uploadUrl && (
                <audio
                  controls
                  src={uploadUrl}
                  className="w-full h-8 rounded mt-1 bg-slate-900 border border-slate-800"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
