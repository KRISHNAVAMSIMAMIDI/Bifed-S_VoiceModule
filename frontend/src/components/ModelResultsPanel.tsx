import React from 'react';
import { AuthenticationResponse } from '../types/api';
import { ShieldCheck, Sparkles, Mic, Fingerprint, Activity, Clock, Info } from 'lucide-react';

interface ModelResultsPanelProps {
  authResult: AuthenticationResponse | null;
}

export const ModelResultsPanel: React.FC<ModelResultsPanelProps> = ({ authResult }) => {
  if (!authResult) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm text-center">
        <Activity className="w-8 h-8 text-slate-700 mx-auto mb-2" />
        <h3 className="text-xs font-bold text-slate-300">Individual Model Telemetry</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Detailed metrics from AASIST, DeepFilterNet3, Silero VAD, and ECAPA-TDNN will appear here after an authentication run.
        </p>
      </div>
    );
  }

  const { aasist, deepfilternet, silero_vad, ecapa, standardization } = authResult;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="pb-3 mb-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Individual Model Telemetry & Technical Metrics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent inspection of individual pipeline model outputs (values are genuine backend outputs only)
          </p>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">
          ID: {authResult.experiment_id}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: AASIST Anti-Spoofing */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                AASIST Anti-Spoof
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  aasist.is_functional
                    ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                    : 'text-amber-400 bg-amber-950/60 border border-amber-800/60'
                }`}
              >
                {aasist.is_functional ? 'Active' : 'Awaiting Weights'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Predicted Class:</span>
                <span className="font-mono font-bold text-slate-200">
                  {aasist.prediction ?? 'Not available'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Spoof Probability:</span>
                <span className="font-mono text-slate-200">
                  {aasist.spoof_prob !== undefined && aasist.spoof_prob !== null
                    ? (aasist.spoof_prob * 100).toFixed(2) + '%'
                    : 'Not available'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Bona Fide Prob:</span>
                <span className="font-mono text-slate-200">
                  {aasist.bona_fide_prob !== undefined && aasist.bona_fide_prob !== null
                    ? (aasist.bona_fide_prob * 100).toFixed(2) + '%'
                    : 'Not available'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Inference Time:</span>
                <span className="font-mono text-slate-200">
                  {aasist.inference_time_ms ? `${aasist.inference_time_ms.toFixed(1)} ms` : 'Not available'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
            {aasist.status_note}
          </div>
        </div>

        {/* Card 2: DeepFilterNet3 */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                DeepFilterNet3
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  deepfilternet.is_functional
                    ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                    : 'text-amber-400 bg-amber-950/60 border border-amber-800/60'
                }`}
              >
                {deepfilternet.is_functional ? 'Active' : 'Awaiting Weights'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Internal Rate:</span>
                <span className="font-mono text-slate-200">
                  {deepfilternet.internal_sample_rate} Hz (48 kHz)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Output Sample Rate:</span>
                <span className="font-mono text-slate-200">
                  {deepfilternet.output_sample_rate} Hz (16 kHz)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Enhancement:</span>
                <span className="font-mono text-slate-200">
                  {deepfilternet.is_functional ? 'Completed' : 'Awaiting Model'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Processing Time:</span>
                <span className="font-mono text-slate-200">
                  {deepfilternet.processing_time_ms ? `${deepfilternet.processing_time_ms.toFixed(1)} ms` : 'Not available'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
            {deepfilternet.status_note}
          </div>
        </div>

        {/* Card 3: Silero VAD */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-purple-400" />
                Silero VAD
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  silero_vad.is_functional
                    ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                    : 'text-amber-400 bg-amber-950/60 border border-amber-800/60'
                }`}
              >
                {silero_vad.is_functional ? 'Active' : 'Awaiting Weights'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Original Duration:</span>
                <span className="font-mono text-slate-200">
                  {standardization ? `${standardization.duration_seconds}s` : 'Not available'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Speech Duration:</span>
                <span className="font-mono text-slate-200">
                  {silero_vad.speech_duration_sec !== undefined && silero_vad.speech_duration_sec !== null
                    ? `${silero_vad.speech_duration_sec.toFixed(2)}s`
                    : 'Not available'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Silence Trimmed:</span>
                <span className="font-mono text-slate-200">
                  {silero_vad.silence_removed_sec !== undefined && silero_vad.silence_removed_sec !== null
                    ? `${silero_vad.silence_removed_sec.toFixed(2)}s`
                    : 'Not available'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Speech Ratio:</span>
                <span className="font-mono text-slate-200">
                  {silero_vad.speech_ratio !== undefined && silero_vad.speech_ratio !== null
                    ? `${(silero_vad.speech_ratio * 100).toFixed(1)}%`
                    : 'Not available'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
            {silero_vad.status_note}
          </div>
        </div>

        {/* Card 4: ECAPA-TDNN */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-teal-400" />
                ECAPA-TDNN
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  ecapa.is_functional
                    ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                    : 'text-amber-400 bg-amber-950/60 border border-amber-800/60'
                }`}
              >
                {ecapa.is_functional ? 'Active' : 'Awaiting Weights'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Embedding Vector:</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {ecapa.embedding_dimension}-dimensional
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Cosine Similarity:</span>
                <span className="font-mono font-bold text-slate-200">
                  {ecapa.similarity_score !== undefined && ecapa.similarity_score !== null
                    ? ecapa.similarity_score.toFixed(4)
                    : 'Not available'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Decision Threshold:</span>
                <span className="font-mono text-slate-200">
                  {ecapa.threshold.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Speaker Match:</span>
                <span className="font-mono font-bold text-slate-200">
                  {ecapa.is_matched !== undefined && ecapa.is_matched !== null
                    ? (ecapa.is_matched ? 'TRUE' : 'FALSE')
                    : 'Not available'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
            {ecapa.status_note}
          </div>
        </div>
      </div>
    </div>
  );
};
