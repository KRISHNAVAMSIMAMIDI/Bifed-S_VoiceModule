import React from 'react';
import { ShieldCheck, Activity, Cpu, Database } from 'lucide-react';

interface HeaderProps {
  backendConnected: boolean;
  modelsFunctional: boolean;
}

export const Header: React.FC<HeaderProps> = ({ backendConnected, modelsFunctional }) => {
  return (
    <header className="border-b border-slate-800 bg-[#070b16]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-400/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                BiFed-S <span className="text-cyan-400 font-semibold text-xs px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60">Voice Biometric Auth</span>
              </h1>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:inline-block font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                CSE Final-Year Project
              </span>
            </div>
            <p className="text-xs text-slate-400">
              6-Stage Voice Biometric Pipeline Demonstration: AASIST &bull; DeepFilterNet3 &bull; Silero VAD &bull; ECAPA-TDNN
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2.5 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Backend:</span>
            <span className={`font-semibold flex items-center gap-1 ${backendConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              {backendConnected ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">ML Engine:</span>
            <span className={`font-semibold ${modelsFunctional ? 'text-emerald-400' : 'text-amber-400'}`}>
              {modelsFunctional ? 'Models Active' : 'Awaiting Colab Weights'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
