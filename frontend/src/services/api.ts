import {
  ModelsStatusResponse,
  SpeakerEnrollmentItem,
  EnrollmentResponse,
  AuthenticationResponse,
  ExperimentHistoryItem,
  ExperimentStats
} from '../types/api';

const API_BASE = '/api';

export const apiService = {
  // Health & Model Status
  async getHealth(): Promise<{ status: string; service: string }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Backend health check failed');
    return res.json();
  },

  async getModelStatuses(): Promise<ModelsStatusResponse> {
    const res = await fetch(`${API_BASE}/models/status`);
    if (!res.ok) throw new Error('Failed to retrieve model statuses');
    return res.json();
  },

  // Speaker Enrollment
  async getEnrollments(): Promise<SpeakerEnrollmentItem[]> {
    const res = await fetch(`${API_BASE}/enrollment`);
    if (!res.ok) throw new Error('Failed to fetch enrollments');
    return res.json();
  },

  async enrollSpeaker(
    speakerId: string,
    audioBlobOrFile: Blob | File,
    filename: string = 'recording.webm',
    confirmOverwrite: boolean = false,
    notes: string = ''
  ): Promise<EnrollmentResponse> {
    const formData = new FormData();
    formData.append('speaker_id', speakerId);
    formData.append('confirm_overwrite', String(confirmOverwrite));
    formData.append('notes', notes);
    formData.append('audio_file', audioBlobOrFile, filename);

    const res = await fetch(`${API_BASE}/enrollment`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Enrollment failed');
    }
    return data;
  },

  async deleteEnrollment(speakerId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/enrollment/${encodeURIComponent(speakerId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to delete enrollment');
    }
    return res.json();
  },

  // Authentication
  async authenticate(
    speakerId: string,
    audioBlobOrFile: Blob | File,
    filename: string = 'auth_recording.webm',
    inputMethod: 'recording' | 'upload' = 'upload',
    customThreshold?: number
  ): Promise<AuthenticationResponse> {
    const formData = new FormData();
    formData.append('speaker_id', speakerId);
    formData.append('input_method', inputMethod);
    if (customThreshold !== undefined) {
      formData.append('custom_threshold', String(customThreshold));
    }
    formData.append('audio_file', audioBlobOrFile, filename);

    const res = await fetch(`${API_BASE}/authenticate`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Authentication request failed');
    }
    return data;
  },

  // Experiment History & Analytics
  async getHistory(speakerId?: string, limit: number = 50): Promise<ExperimentHistoryItem[]> {
    const params = new URLSearchParams();
    if (speakerId) params.append('speaker_id', speakerId);
    params.append('limit', String(limit));

    const res = await fetch(`${API_BASE}/history?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to retrieve experiment history');
    return res.json();
  },

  async getHistoryStats(): Promise<ExperimentStats> {
    const res = await fetch(`${API_BASE}/history/stats`);
    if (!res.ok) throw new Error('Failed to retrieve experiment analytics');
    return res.json();
  },

  async clearHistory(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/history`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear experiment history');
    return res.json();
  }
};
