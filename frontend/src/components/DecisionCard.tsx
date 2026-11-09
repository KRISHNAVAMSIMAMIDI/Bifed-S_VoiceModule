import React from 'react';
import { AuthenticationResponse, AuthenticationDecision } from '../types/api';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  UserX,
  HelpCircle,
  Clock,
  Award,
  Zap,
  Info
} from 'lucide-react';

interface DecisionCardProps {
  authResult: AuthenticationResponse | null;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ authResult }) => {
  if (!authResult) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center">
        <Award className="w-10 h-10 text-slate-700 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-300">Final Authentication Decision</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Execute an authentication verification to view the official biometric decision, similarity score, and threshold evaluation.
        </p>
      </div>
    );
  }

  const { decision, similarity_score, threshold, is_provisional_threshold, total_processing_time_ms, speaker_id, message } = authResult;

  const getDecisionTheme = (dec: AuthenticationDecision) => {
    switch (dec) {
      case 'AUTHENTICATED':
        return {
          title: 'ACCESS GRANTED: AUTHENTICATED',
          badgeBg: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-emerald-950/50',
          icon: <ShieldCheck className="w-8 h-8 text-emerald-400" />,
          accent: 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 to-slate-900/80',
          tag: 'Verified Genuine Speaker'
        };
      case 'NOT_AUTHENTICATED':
        return {
          title: 'ACCESS DENIED: NOT AUTHENTICATED',
          badgeBg: 'bg-rose-950/80 border-rose-500/50 text-rose-300 shadow-rose-950/50',
          icon: <ShieldAlert className="w-8 h-8 text-rose-400" />,
          accent: 'border-rose-500/40 bg-gradient-to-br from-rose-950/30 to-slate-900/80',
          tag: 'Voice Profile Mismatch'
        };
      case 'SPOOF_DETECTED':
        return {
          title: 'ACCESS DENIED: SPOOF ATTACK DETECTED',
          badgeBg: 'bg-purple-950/80 border-purple-500/50 text-purple-300 shadow-purple-950/50',
          icon: <AlertTriangle className="w-8 h-8 text-purple-400" />,
          accent: 'border-purple-500/40 bg-gradient-to-br from-purple-950/30 to-slate-900/80',
          tag: 'Synthetic / Replay Detected by AASIST'
        };
      case 'AUDIO_QUALITY_INSUFFICIENT':
        return {
          title: 'ABORTED: AUDIO QUALITY INSUFFICIENT',
          badgeBg: 'bg-amber-950/80 border-amber-500/50 text-amber-300',
          icon: <AlertTriangle className="w-8 h-8 text-amber-400" />,
          accent: 'border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-slate-900/80',
          tag: 'Insufficient Voice Activity (Silero VAD)'
        };
      case 'SPEAKER_NOT_ENROLLED':
        return {
          title: 'REJECTED: SPEAKER NOT ENROLLED',
          badgeBg: 'bg-slate-900 border-slate-700 text-slate-300',
          icon: <UserX className="w-8 h-8 text-amber-400" />,
          accent: 'border-slate-700 bg-slate-900/80',
          tag: 'No Reference Embedding in Database'
        };
      case 'AWAITING_MODEL_INTEGRATION':
      default:
        return {
          title: 'PREPROCESSED: AWAITING MODEL WEIGHTS',
          badgeBg: 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-cyan-950/50',
          icon: <Clock className="w-8 h-8 text-cyan-400" />,
          accent: 'border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 to-slate-900/80',
          tag: 'Standardized 16 kHz Mono Audio Ready for Colab ML Weights'
        };
    }
  };

  const theme = getDecisionTheme(decision);

  return (
    <div className={`border rounded-xl p-5 shadow-lg ${theme.accent} transition-all`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
            {theme.icon}
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              {theme.tag}
            </span>
            <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
              {theme.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Latency:</span>
            <span className="font-mono font-bold text-white">{total_processing_time_ms.toFixed(1)} ms</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Claimed Identity
          </span>
          <span className="font-bold text-xs sm:text-sm text-cyan-300 truncate block">
            {speaker_id}
          </span>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Similarity Score
          </span>
          <span className="font-mono font-bold text-xs sm:text-sm text-white block">
            {similarity_score !== undefined && similarity_score !== null
              ? similarity_score.toFixed(4)
              : 'Awaiting ECAPA'}
          </span>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Auth Threshold
          </span>
          <span className="font-mono font-bold text-xs sm:text-sm text-white block">
            {threshold.toFixed(2)}
          </span>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Threshold Status
          </span>
          <span className="text-xs font-semibold text-amber-400 block">
            {is_provisional_threshold ? 'Provisional' : 'Calibrated'}
          </span>
        </div>
      </div>

      {/* Decision Summary Text */}
      <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-slate-200">{message}</p>
          {is_provisional_threshold && (
            <p className="text-[11px] text-slate-500 mt-1">
              Note: The threshold ({threshold.toFixed(2)}) is designated as provisional. Formal Equal Error Rate (EER) evaluation will calibrate operational operating points.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
