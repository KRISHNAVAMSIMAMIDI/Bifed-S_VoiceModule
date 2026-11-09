import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { AudioInput } from './AudioInput';
import { SpeakerEnrollmentItem, AuthenticationResponse } from '../types/api';
import { apiService } from '../services/api';

interface AuthenticationPanelProps {
  enrolledSpeakers: SpeakerEnrollmentItem[];
  threshold: number;
  onAuthenticationComplete: (res: AuthenticationResponse) => void;
  disabled?: boolean;
}

export const AuthenticationPanel: React.FC<AuthenticationPanelProps> = ({
  enrolledSpeakers,
  threshold,
  onAuthenticationComplete,
  disabled = false,
}) => {
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');
  const [customSpeakerId, setCustomSpeakerId] = useState<string>('');
  const [useCustomId, setUseCustomId] = useState<boolean>(false);
  const [audioData, setAudioData] = useState<{ blobOrFile: Blob | File; filename: string; source: 'recording' | 'upload' } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeSpeakerId = useCustomId ? customSpeakerId.trim() : selectedSpeakerId.trim();

  const handleAudioReady = (blobOrFile: Blob | File, filename: string, source: 'recording' | 'upload') => {
    setAudioData({ blobOrFile, filename, source });
    setError(null);
  };

  const handleAudioCleared = () => {
    setAudioData(null);
  };

  const handleAuthenticate = async () => {
    setError(null);
    if (!activeSpeakerId) {
      setError('Please select or specify a Speaker ID to authenticate against.');
      return;
    }

    if (!audioData) {
      setError('Please record or upload a voice sample to authenticate.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.authenticate(
        activeSpeakerId,
        audioData.blobOrFile,
        audioData.filename,
        audioData.source,
        threshold
      );
      onAuthenticationComplete(response);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-950 border border-blue-800/60 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Voice Authentication Verification</h2>
            <p className="text-xs text-slate-400">Verify a claim of speaker identity through the 6-stage pipeline</p>
          </div>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          Target Threshold: <span className="font-mono font-bold text-cyan-400">{threshold.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Speaker Selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Claimed Speaker Identity <span className="text-rose-400">*</span>
            </label>
            <button
              type="button"
              onClick={() => setUseCustomId(!useCustomId)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {useCustomId ? '← Select from enrolled list' : '+ Enter custom/unregistered ID'}
            </button>
          </div>

          {!useCustomId ? (
            <select
              value={selectedSpeakerId}
              onChange={(e) => setSelectedSpeakerId(e.target.value)}
              disabled={disabled || loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg text-xs text-white focus:outline-none transition-colors"
            >
              <option value="">-- Choose an enrolled speaker identity --</option>
              {enrolledSpeakers.map((s) => (
                <option key={s.speaker_id} value={s.speaker_id}>
                  {s.speaker_id} (Enrolled {new Date(s.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={customSpeakerId}
              onChange={(e) => setCustomSpeakerId(e.target.value)}
              placeholder="e.g. UNREGISTERED_IMPOSTOR_01"
              disabled={disabled || loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          )}

          {enrolledSpeakers.length === 0 && !useCustomId && (
            <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              No speakers enrolled yet. You can enroll above or test with a custom ID.
            </p>
          )}
        </div>

        {/* Audio Input */}
        <AudioInput
          label="Verification Voice Sample"
          onAudioReady={handleAudioReady}
          onAudioCleared={handleAudioCleared}
          disabled={disabled || loading}
        />

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleAuthenticate}
          disabled={disabled || loading || !audioData || !activeSpeakerId}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Executing 6-Stage Authentication Pipeline...
            </>
          ) : (
            <>
              <KeyRound className="w-4 h-4" />
              Authenticate Speaker Voice Sample
            </>
          )}
        </button>
      </div>
    </div>
  );
};
