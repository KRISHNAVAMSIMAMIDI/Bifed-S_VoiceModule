import React from 'react';
import { PipelineStageInfo, StageStatus } from '../types/api';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  AlertTriangle,
  ArrowDown,
  Volume2,
  ShieldCheck,
  Sparkles,
  Mic,
  Fingerprint,
  Scale,
  Award
} from 'lucide-react';

interface PipelineVisualizerProps {
  stages: PipelineStageInfo[];
  isProcessing?: boolean;
}

const STAGE_ICONS: Record<number, React.ReactNode> = {
  1: <Volume2 className="w-4 h-4 text-cyan-400" />,
  2: <ShieldCheck className="w-4 h-4 text-blue-400" />,
  3: <Sparkles className="w-4 h-4 text-indigo-400" />,
  4: <Mic className="w-4 h-4 text-purple-400" />,
  5: <Fingerprint className="w-4 h-4 text-teal-400" />,
  6: <Award className="w-4 h-4 text-emerald-400" />
};

export const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  stages,
  isProcessing = false
}) => {
  const getStatusBadge = (status: StageStatus, isModelConnected: boolean) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full animate-pulse">
            <Clock className="w-3 h-3 text-cyan-400 animate-spin" />
            Processing...
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3 text-rose-400" />
            Failed
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
            <MinusCircle className="w-3 h-3 text-slate-500" />
            Skipped
          </span>
        );
      case 'awaiting_model':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-amber-400" />
            Awaiting Colab Weights
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
            Pending
          </span>
        );
    }
  };

  // Default stages template if no execution has happened yet
  const defaultStages: PipelineStageInfo[] = [
    { name: 'Audio Standardization', stage_number: 1, status: 'pending', is_model_connected: true, summary: 'Decode & convert to 16 kHz mono WAV' },
    { name: 'AASIST Anti-Spoofing', stage_number: 2, status: 'awaiting_model', is_model_connected: false, summary: 'Replay & synthetic speech spoof detection' },
    { name: 'DeepFilterNet3 Enhancement', stage_number: 3, status: 'awaiting_model', is_model_connected: false, summary: 'Resample to 48 kHz, enhance, resample back to 16 kHz' },
    { name: 'Silero Voice Activity Detection', stage_number: 4, status: 'awaiting_model', is_model_connected: false, summary: 'Speech validation & silence removal' },
    { name: 'ECAPA-TDNN Embedding Extraction', stage_number: 5, status: 'awaiting_model', is_model_connected: false, summary: 'Extract 192-dimensional speaker embedding' },
    { name: 'Final Authentication Decision', stage_number: 6, status: 'awaiting_model', is_model_connected: false, summary: 'Threshold comparison vs enrolled reference' },
  ];

  const displayStages = stages.length > 0 ? stages : defaultStages;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            Sequential Pipeline Execution Visualization
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict sequential execution order as designed in the BiFed-S architecture
          </p>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-3 py-1 rounded-full animate-pulse">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            Executing Pipeline Stages...
          </div>
        )}
      </div>

      {/* Visual Pipeline Flow */}
      <div className="space-y-3">
        {displayStages.map((stage, idx) => {
          const isLast = idx === displayStages.length - 1;
          const icon = STAGE_ICONS[stage.stage_number] || <Volume2 className="w-4 h-4 text-slate-400" />;

          return (
            <React.Fragment key={stage.stage_number}>
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  stage.status === 'completed'
                    ? 'bg-slate-950/80 border-emerald-800/40 shadow-sm shadow-emerald-950/20'
                    : stage.status === 'failed'
                    ? 'bg-slate-950/80 border-rose-800/50'
                    : stage.status === 'awaiting_model'
                    ? 'bg-slate-950/60 border-amber-800/30'
                    : stage.status === 'skipped'
                    ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                    : 'bg-slate-950/40 border-slate-800/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800/50">
                          STAGE {stage.stage_number}
                        </span>
                        <h3 className="text-xs font-bold text-white">{stage.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {stage.summary || 'Awaiting stage execution'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {stage.execution_time_ms !== undefined && stage.execution_time_ms !== null && (
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {stage.execution_time_ms.toFixed(1)} ms
                      </span>
                    )}
                    {getStatusBadge(stage.status, stage.is_model_connected)}
                  </div>
                </div>

                {stage.error_message && (
                  <div className="mt-2 p-2 bg-rose-950/40 border border-rose-800/50 rounded text-[11px] text-rose-300">
                    <strong>Error:</strong> {stage.error_message}
                  </div>
                )}
              </div>

              {!isLast && (
                <div className="flex justify-center -my-1">
                  <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
