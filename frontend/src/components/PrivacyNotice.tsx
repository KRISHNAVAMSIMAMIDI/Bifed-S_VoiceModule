import React from 'react';
import { Shield, Lock, EyeOff, Trash2 } from 'lucide-react';

export const PrivacyNotice: React.FC = () => {
  return (
    <footer className="mt-8 pt-6 border-t border-slate-800/80 text-slate-500 text-xs">
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 shrink-0 mt-0.5">
            <Shield className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              Academic Biometric Data Handling & Privacy Notice
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Voice recordings and extracted speaker embeddings are sensitive biometric identifiers. For this research demonstration:
            </p>
            <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5 mt-1">
              <li>Raw voice recordings (audio files) are processed in ephemeral storage and discarded immediately after pipeline inference.</li>
              <li>Only mathematical 192-dimensional numerical vectors (embeddings) are preserved for enrolled speaker references.</li>
              <li>No personal identity information is transmitted to third-party cloud services; all processing is local.</li>
              <li>Evaluators can permanently delete any enrolled reference profile at any time via the speaker enrollment panel.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2 pb-6">
        <div>
          BiFed-S: Final-Year CSE Capstone Project &bull; Voice Biometrics Demonstration
        </div>
        <div className="flex items-center gap-4">
          <span>FastAPI + SQLite Backend</span>
          <span>&bull;</span>
          <span>React + Vite Frontend</span>
        </div>
      </div>
    </footer>
  );
};
