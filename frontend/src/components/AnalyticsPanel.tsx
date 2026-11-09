import React from 'react';
import { ExperimentStats, ExperimentHistoryItem } from '../types/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { BarChart3, AlertCircle, Info, Clock, CheckCircle2, ShieldAlert, Activity } from 'lucide-react';

interface AnalyticsPanelProps {
  stats: ExperimentStats | null;
  history: ExperimentHistoryItem[];
}

const COLORS: Record<string, string> = {
  AUTHENTICATED: '#10b981', // emerald
  NOT_AUTHENTICATED: '#f43f5e', // rose
  SPOOF_DETECTED: '#a855f7', // purple
  AUDIO_QUALITY_INSUFFICIENT: '#f59e0b', // amber
  SPEAKER_NOT_ENROLLED: '#64748b', // slate
  AWAITING_MODEL_INTEGRATION: '#06b6d4', // cyan
};

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ stats, history }) => {
  if (!stats || stats.total_attempts === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-center">
        <BarChart3 className="w-8 h-8 text-slate-700 mx-auto mb-2" />
        <h3 className="text-xs font-bold text-slate-300">Operational Performance Analytics</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Operational metrics and execution charts will dynamically populate after authentication attempts are performed.
        </p>
      </div>
    );
  }

  // Outcome distribution data for Pie Chart
  const outcomeData = Object.entries(stats.decision_counts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    key: name,
    value,
  }));

  // Latency trends across recent experiments (chronological)
  const latencyData = [...history].reverse().slice(-10).map((item, idx) => ({
    name: `#${idx + 1} (${item.speaker_id})`,
    durationMs: item.total_duration_sec ? item.total_duration_sec * 1000 : 0,
    similarity: item.ecapa_similarity ?? null,
  }));

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="pb-3 mb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            Operational Performance Telemetry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirical runtime statistics aggregated from actual recorded SQLite experiment runs
          </p>
        </div>

        <div className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          <span>Operational stats only (not formal EER / FAR / FRR metrics)</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Total Inferences
          </span>
          <span className="font-mono font-bold text-base text-white">
            {stats.total_attempts}
          </span>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Authenticated
          </span>
          <span className="font-mono font-bold text-base text-emerald-400">
            {stats.successful_authentications}
          </span>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Rejected
          </span>
          <span className="font-mono font-bold text-base text-rose-400">
            {stats.rejected_attempts}
          </span>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-400" />
            Spoof Caught
          </span>
          <span className="font-mono font-bold text-base text-purple-400">
            {stats.spoof_detections}
          </span>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            Avg Latency
          </span>
          <span className="font-mono font-bold text-base text-cyan-300">
            {(stats.average_processing_time_sec * 1000).toFixed(0)} ms
          </span>
        </div>

        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Avg Similarity
          </span>
          <span className="font-mono font-bold text-base text-white">
            {stats.average_similarity !== null && stats.average_similarity !== undefined ? stats.average_similarity.toFixed(4) : 'N/A'}
          </span>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Outcome Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-300 mb-3">Authentication Decisions Breakdown</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={outcomeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {outcomeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.key] || '#38bdf8'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {outcomeData.map((d) => (
              <div key={d.key} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[d.key] || '#38bdf8' }} />
                <span>{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Latency & Inferences Trend (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-300 mb-3">Pipeline Execution Latency (Recent Attempts, ms)</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Bar dataKey="durationMs" name="Total Duration (ms)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
