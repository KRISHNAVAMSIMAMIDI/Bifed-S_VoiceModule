import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { SystemStatus } from './components/SystemStatus';
import { EnrollmentPanel } from './components/EnrollmentPanel';
import { AuthenticationPanel } from './components/AuthenticationPanel';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { DecisionCard } from './components/DecisionCard';
import { ModelResultsPanel } from './components/ModelResultsPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { ExperimentHistory } from './components/ExperimentHistory';
import { PrivacyNotice } from './components/PrivacyNotice';
import {
  ModelsStatusResponse,
  SpeakerEnrollmentItem,
  AuthenticationResponse,
  EnrollmentResponse,
  ExperimentHistoryItem,
  ExperimentStats
} from './types/api';
import { apiService } from './services/api';

export function App() {
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [modelStatuses, setModelStatuses] = useState<ModelsStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  const [threshold, setThreshold] = useState<number>(0.65);
  const [enrolledSpeakers, setEnrolledSpeakers] = useState<SpeakerEnrollmentItem[]>([]);
  const [lastAuthResult, setLastAuthResult] = useState<AuthenticationResponse | null>(null);
  const [lastEnrollResult, setLastEnrollResult] = useState<EnrollmentResponse | null>(null);

  const [history, setHistory] = useState<ExperimentHistoryItem[]>([]);
  const [stats, setStats] = useState<ExperimentStats | null>(null);

  // Poll / fetch health and initial data
  const fetchData = useCallback(async () => {
    try {
      await apiService.getHealth();
      setBackendConnected(true);

      const [statusRes, speakersRes, histRes, statsRes] = await Promise.all([
        apiService.getModelStatuses().catch(() => null),
        apiService.getEnrollments().catch(() => []),
        apiService.getHistory().catch(() => []),
        apiService.getHistoryStats().catch(() => null),
      ]);

      if (statusRes) setModelStatuses(statusRes);
      if (speakersRes) setEnrolledSpeakers(speakersRes);
      if (histRes) setHistory(histRes);
      if (statsRes) setStats(statsRes);
    } catch (e) {
      setBackendConnected(false);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleEnrollmentSuccess = (res: EnrollmentResponse) => {
    setLastEnrollResult(res);
    fetchData();
  };

  const handleAuthenticationComplete = (res: AuthenticationResponse) => {
    setLastAuthResult(res);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#070b16] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* 1. Header */}
      <Header
        backendConnected={backendConnected}
        modelsFunctional={modelStatuses?.all_functional ?? false}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Backend offline warning banner */}
        {!backendConnected && !loadingStatus && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span>
                <strong>Backend Disconnected:</strong> FastAPI server is not responding at <code className="font-mono bg-rose-950 px-1 py-0.5 rounded">http://127.0.0.1:8000</code>. Please start the backend.
              </span>
            </div>
            <button
              onClick={fetchData}
              className="px-2.5 py-1 bg-rose-900 hover:bg-rose-800 rounded text-xs font-semibold text-white transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* 2. System Status & Configurable Threshold */}
        <section aria-label="System Readiness">
          <SystemStatus
            status={modelStatuses}
            loading={loadingStatus}
            threshold={threshold}
            onThresholdChange={setThreshold}
            isProvisionalThreshold={true}
          />
        </section>

        {/* 3 & 4. Primary Workflows: Enrollment and Authentication */}
        <section aria-label="Biometric Operations" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <EnrollmentPanel
            enrolledSpeakers={enrolledSpeakers}
            onEnrollmentSuccess={handleEnrollmentSuccess}
            onRefreshSpeakers={fetchData}
            disabled={!backendConnected}
          />

          <AuthenticationPanel
            enrolledSpeakers={enrolledSpeakers}
            threshold={threshold}
            onAuthenticationComplete={handleAuthenticationComplete}
            disabled={!backendConnected}
          />
        </section>

        {/* 5. Pipeline Visualization */}
        <section aria-label="Pipeline Stages">
          <PipelineVisualizer
            stages={lastAuthResult?.stages || lastEnrollResult?.stages || []}
          />
        </section>

        {/* 6. Final Authentication Result Decision Card */}
        <section aria-label="Authentication Decision">
          <DecisionCard authResult={lastAuthResult} />
        </section>

        {/* 7. Individual Model Technical Results */}
        <section aria-label="Model Telemetry">
          <ModelResultsPanel authResult={lastAuthResult} />
        </section>

        {/* 8. Performance Analytics */}
        <section aria-label="Analytics">
          <AnalyticsPanel stats={stats} history={history} />
        </section>

        {/* 9. Experiment History Table & CSV Export */}
        <section aria-label="Audit History">
          <ExperimentHistory
            history={history}
            onRefresh={fetchData}
            onClear={fetchData}
            disabled={!backendConnected}
          />
        </section>

        {/* 10. Biometric Privacy Notice */}
        <PrivacyNotice />
      </main>
    </div>
  );
}

export default App;
