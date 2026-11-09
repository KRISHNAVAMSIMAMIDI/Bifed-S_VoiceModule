import React, { useState } from 'react';
import { UserPlus, Users, Trash2, CheckCircle2, AlertCircle, RefreshCw, UserCheck, Shield } from 'lucide-react';
import { AudioInput } from './AudioInput';
import { SpeakerEnrollmentItem, EnrollmentResponse } from '../types/api';
import { apiService } from '../services/api';

interface EnrollmentPanelProps {
  enrolledSpeakers: SpeakerEnrollmentItem[];
  onEnrollmentSuccess: (res: EnrollmentResponse) => void;
  onRefreshSpeakers: () => void;
  disabled?: boolean;
}

export const EnrollmentPanel: React.FC<EnrollmentPanelProps> = ({
  enrolledSpeakers,
  onEnrollmentSuccess,
  onRefreshSpeakers,
  disabled = false,
}) => {
  const [speakerId, setSpeakerId] = useState<string>('');
  const [audioData, setAudioData] = useState<{ blobOrFile: Blob | File; filename: string; source: string } | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<boolean>(false);
  const [needsOverwriteConfirm, setNeedsOverwriteConfirm] = useState<boolean>(false);

  const handleAudioReady = (blobOrFile: Blob | File, filename: string, source: 'recording' | 'upload') => {
    setAudioData({ blobOrFile, filename, source });
    setError(null);
  };

  const handleAudioCleared = () => {
    setAudioData(null);
  };

  const handleEnroll = async (forceOverwrite: boolean = false) => {
    setError(null);
    setSuccessMsg(null);
    setNeedsOverwriteConfirm(false);

    const cleanId = speakerId.trim();
    if (!cleanId) {
      setError('Please provide a Speaker ID (e.g., SPEAKER_01 or evaluator username).');
      return;
    }

    if (!audioData) {
      setError('Please record or upload a reference voice sample.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.enrollSpeaker(
        cleanId,
        audioData.blobOrFile,
        audioData.filename,
        forceOverwrite || confirmOverwrite,
        notes
      );

      if (!response.success && response.message.includes('already enrolled')) {
        setNeedsOverwriteConfirm(true);
        setError(response.message);
      } else {
        setSuccessMsg(response.message);
        onEnrollmentSuccess(response);
        onRefreshSpeakers();
        setNeedsOverwriteConfirm(false);
      }
    } catch (err: any) {
      setError(err.message || 'Enrollment request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSpeaker = async (id: string) => {
    if (!confirm(`Are you sure you want to delete enrollment reference for '${id}'? This will remove reference embeddings.`)) {
      return;
    }

    try {
      await apiService.deleteEnrollment(id);
      onRefreshSpeakers();
    } catch (err: any) {
      alert(`Failed to delete speaker: ${err.message}`);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800/60 flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Speaker Enrollment</h2>
            <p className="text-xs text-slate-400">Register new reference speaker voice biometric profile</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefreshSpeakers}
          disabled={disabled || loading}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          title="Refresh enrolled speakers list"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Form: Input & Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Speaker ID / Evaluator Identifier <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={speakerId}
              onChange={(e) => {
                setSpeakerId(e.target.value);
                setNeedsOverwriteConfirm(false);
              }}
              placeholder="e.g. SPEAKER_ALICE, EVALUATOR_01"
              disabled={disabled || loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Audio Input Component */}
          <AudioInput
            label="Reference Voice Audio Sample"
            onAudioReady={handleAudioReady}
            onAudioCleared={handleAudioCleared}
            disabled={disabled || loading}
          />

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Optional Reference Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Clean studio recording, female speaker"
              disabled={disabled || loading}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
            />
          </div>

          {/* Feedback & Overwrite Confirmation */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span>{error}</span>
                {needsOverwriteConfirm && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEnroll(true)}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Confirm Overwrite Reference
                    </button>
                    <button
                      type="button"
                      onClick={() => setNeedsOverwriteConfirm(false)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleEnroll(false)}
            disabled={disabled || loading || !audioData || !speakerId.trim()}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Standardizing & Enrolling Speaker...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Submit Speaker for Enrollment
              </>
            )}
          </button>
        </div>

        {/* Right List: Currently Enrolled Speakers (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col h-full">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Enrolled Speakers ({enrolledSpeakers.length})
            </span>
          </div>

          {enrolledSpeakers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <UserCheck className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-xs font-medium text-slate-400">No speakers enrolled yet</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                Enroll at least one speaker using the form on the left to test voice authentication.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {enrolledSpeakers.map((spk) => (
                <div
                  key={spk.speaker_id}
                  className="p-2.5 bg-slate-900 border border-slate-800/80 rounded-lg flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                >
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200 truncate">{spk.speaker_id}</span>
                      <span className="text-[10px] bg-cyan-950 border border-cyan-800/60 text-cyan-300 px-1.5 py-0.2 rounded font-mono">
                        v{spk.sample_count}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Enrolled: {new Date(spk.created_at).toLocaleDateString()} {new Date(spk.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSpeaker(spk.speaker_id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                    title={`Delete enrollment for ${spk.speaker_id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Raw audio discarded after processing; only reference embeddings retained.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
