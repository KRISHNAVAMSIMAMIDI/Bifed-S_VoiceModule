import React from 'react';
import { ModelsStatusResponse } from '../types/api';
import { CheckCircle2, Clock, Info, ShieldAlert, Cpu, Sparkles, Sliders } from 'lucide-react';

interface SystemStatusProps {
  status: ModelsStatusResponse | null;
  loading: boolean;
  threshold: number;
  onThresholdChange: (val: number) => void;
  isProvisionalThreshold: boolean;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  status,
  loading,
  threshold,
  onThresholdChange,
  isProvisionalThreshold,
}) => {
  const models = [
    {
      id: 'std',
      name: 'Stage 1: Standardization',
      desc: '16 kHz mono WAV conversion',
      isFunctional: true,
      readyNote: 'Functional & Tested',
      missingNote: 'N/A',
    },
    {
      id: 'aasist',
      name: 'Stage 2: AASIST Anti-Spoofing',
      desc: 'Replay / synthetic speech rejection',
      isFunctional: status?.aasist.is_functional ?? false,
      readyNote: 'ONNX Session Ready',
      missingNote: 'Awaiting Colab AASIST.onnx',
    },
    {
      id: 'deepfilternet',
      name: 'Stage 3: DeepFilterNet3',
      desc: 'Resample 48 kHz & noise reduction',
      isFunctional: status?.deepfilternet.is_functional ?? false,
      readyNote: 'DeepFilterNet3 Ready',
      missingNote: 'Awaiting Colab weights',
    },
    {
      id: 'silero_vad',
      name: 'Stage 4: Silero VAD',
      desc: 'Silence trimming & speech ratio',
      isFunctional: status?.silero_vad.is_functional ?? false,
      readyNote: 'Silero VAD Ready',
      missingNote: 'Awaiting Colab ONNX/model',
    },
    {
      id: 'ecapa',
      name: 'Stage 5: ECAPA-TDNN',
      desc: '192-dim speaker embeddings',
      isFunctional: status?.ecapa.is_functional ?? false,
      readyNote: 'SpeechBrain Model Ready',
      missingNote: 'Awaiting Colab checkpoint',
    },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Voice Pipeline Architecture & Model Readiness
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status of backend inference engines and verification thresholds
          </p>
        </div>

        {/* Configurable Threshold */}
        <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-auto">
          <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-300 font-medium whitespace-nowrap">
              Threshold:
            </span>
            <input
              type="range"
              min="0.30"
              max="0.95"
              step="0.01"
              value={threshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
              className="w-24 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono font-bold text-cyan-400 w-9 text-right">
              {threshold.toFixed(2)}
            </span>
            {isProvisionalThreshold && (
              <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.2 rounded font-medium" title="Threshold is provisional pending formal empirical evaluation">
                Provisional
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {models.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-lg border text-xs transition-all ${
              m.isFunctional
                ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                : 'bg-slate-950/50 border-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-1 mb-1.5">
              <span className="font-semibold text-white leading-tight">{m.name}</span>
              {m.isFunctional ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">{m.desc}</p>
            <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
              <span className="text-slate-400 font-medium">Status:</span>
              <span
                className={`font-semibold ${
                  m.isFunctional ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {m.isFunctional ? m.readyNote : m.missingNote}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
