import React, { useState } from 'react';
import { ExperimentHistoryItem } from '../types/api';
import { History, Search, Download, Trash2, Eye, X, Filter, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiService } from '../services/api';

interface ExperimentHistoryProps {
  history: ExperimentHistoryItem[];
  onRefresh: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export const ExperimentHistory: React.FC<ExperimentHistoryProps> = ({
  history,
  onRefresh,
  onClear,
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<ExperimentHistoryItem | null>(null);

  const filteredHistory = history.filter((item) =>
    item.speaker_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.experiment_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.final_decision.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all experiment records? This cannot be undone.')) {
      return;
    }
    try {
      await apiService.clearHistory();
      onClear();
    } catch (err: any) {
      alert(`Failed to clear history: ${err.message}`);
    }
  };

  const handleExportCSV = () => {
    if (history.length === 0) return;

    const headers = [
      'Experiment ID',
      'Speaker ID',
      'Timestamp',
      'Input Method',
      'AASIST Prediction',
      'Spoof Probability',
      'VAD Speech Duration (s)',
      'ECAPA Similarity',
      'Threshold',
      'Final Decision',
      'Total Latency (s)',
    ];

    const rows = history.map((item) => [
      `"${item.experiment_id}"`,
      `"${item.speaker_id}"`,
      `"${item.timestamp}"`,
      `"${item.input_method}"`,
      `"${item.aasist_prediction ?? 'N/A'}"`,
      item.spoof_probability ?? '',
      item.vad_speech_duration ?? '',
      item.ecapa_similarity ?? '',
      item.threshold ?? '',
      `"${item.final_decision}"`,
      item.total_duration_sec ?? '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bifed_s_experiments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'AUTHENTICATED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">AUTHENTICATED</span>;
      case 'NOT_AUTHENTICATED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/70 border border-rose-800/60 text-rose-400">NOT AUTHENTICATED</span>;
      case 'SPOOF_DETECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/70 border border-purple-800/60 text-purple-400">SPOOF DETECTED</span>;
      case 'AUDIO_QUALITY_INSUFFICIENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/70 border border-amber-800/60 text-amber-400">LOW QUALITY</span>;
      case 'AWAITING_MODEL_INTEGRATION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">AWAITING MODELS</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">{decision}</span>;
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="pb-3 mb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            Experiment Run History & Audit Log
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Persisted SQLite records of all authentication requests and pipeline stage outcomes
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={disabled || history.length === 0}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={disabled || history.length === 0}
            className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/40 disabled:opacity-50 text-rose-300 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-rose-800/60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            Clear Log
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search experiments by Speaker ID, experiment ID, or outcome..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-xs font-medium text-slate-400">No experiment records found</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Authenticate a speaker above to record an experiment in SQLite.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-semibold text-slate-400 bg-slate-950/60">
                <th className="py-2.5 px-3">Exp ID</th>
                <th className="py-2.5 px-3">Speaker ID</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">AASIST Spoof %</th>
                <th className="py-2.5 px-3">ECAPA Similarity</th>
                <th className="py-2.5 px-3">Decision</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredHistory.map((item) => (
                <tr key={item.experiment_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{item.experiment_id}</td>
                  <td className="py-2 px-3 font-bold text-slate-200">{item.speaker_id}</td>
                  <td className="py-2 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-400 capitalize">{item.input_method}</td>
                  <td className="py-2 px-3 font-mono text-slate-300">
                    {item.spoof_probability !== null && item.spoof_probability !== undefined
                      ? `${(item.spoof_probability * 100).toFixed(1)}%`
                      : 'N/A'}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-200">
                    {item.ecapa_similarity !== null && item.ecapa_similarity !== undefined
                      ? item.ecapa_similarity.toFixed(4)
                      : 'N/A'}
                  </td>
                  <td className="py-2 px-3">{getDecisionBadge(item.final_decision)}</td>
                  <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                    {item.total_duration_sec !== null && item.total_duration_sec !== undefined
                      ? `${(item.total_duration_sec * 1000).toFixed(0)} ms`
                      : 'N/A'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                      title="Inspect full stage details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal / Drawer for Detailed Experiment Inspection */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Experiment Details: <span className="font-mono text-cyan-300">{selectedItem.experiment_id}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Claimed Speaker</span>
                <span className="font-bold text-slate-200">{selectedItem.speaker_id}</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Final Outcome</span>
                <span className="font-bold text-cyan-400">{selectedItem.final_decision}</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Similarity vs Threshold</span>
                <span className="font-mono text-slate-200">
                  {selectedItem.ecapa_similarity ? selectedItem.ecapa_similarity.toFixed(4) : 'N/A'} / {selectedItem.threshold ? selectedItem.threshold.toFixed(2) : '0.65'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Execution Latency</span>
                <span className="font-mono text-slate-200">
                  {selectedItem.total_duration_sec ? `${(selectedItem.total_duration_sec * 1000).toFixed(1)} ms` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Stages breakdown */}
            {selectedItem.stages_detail?.stages && (
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-2">Stage Telemetry:</h4>
                <div className="space-y-1.5">
                  {selectedItem.stages_detail.stages.map((st: any) => (
                    <div key={st.stage_number} className="p-2 bg-slate-950 rounded border border-slate-800/80 text-xs flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-cyan-400 mr-2">S{st.stage_number}</span>
                        <span className="font-semibold text-slate-200">{st.name}</span>
                        <p className="text-[11px] text-slate-400">{st.summary || st.error_message || 'N/A'}</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {st.execution_time_ms ? `${st.execution_time_ms.toFixed(1)}ms` : st.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
