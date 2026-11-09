export type StageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped' | 'awaiting_model';

export interface PipelineStageInfo {
  name: string;
  stage_number: number;
  status: StageStatus;
  is_model_connected: boolean;
  execution_time_ms?: number;
  summary?: string;
  details?: Record<string, any>;
  error_message?: string;
}

export interface StandardizationResult {
  original_format?: string;
  original_sample_rate?: number;
  original_channels?: number;
  standardized_sample_rate: number;
  standardized_channels: number;
  duration_seconds: number;
  file_size_bytes: number;
  audio_path: string;
}

export interface AASISTResult {
  is_functional: boolean;
  prediction?: 'bonafide' | 'spoof';
  bona_fide_prob?: number;
  spoof_prob?: number;
  inference_time_ms?: number;
  status_note: string;
}

export interface DeepFilterNetResult {
  is_functional: boolean;
  input_sample_rate: number;
  internal_sample_rate: number;
  output_sample_rate: number;
  processing_time_ms?: number;
  status_note: string;
}

export interface SileroVADResult {
  is_functional: boolean;
  original_duration_sec?: number;
  speech_duration_sec?: number;
  silence_removed_sec?: number;
  speech_ratio?: number;
  status_note: string;
}

export interface ECAPAResult {
  is_functional: boolean;
  embedding_dimension: number;
  similarity_score?: number;
  threshold: number;
  is_matched?: boolean;
  status_note: string;
}

export type AuthenticationDecision =
  | 'AUTHENTICATED'
  | 'NOT_AUTHENTICATED'
  | 'SPOOF_DETECTED'
  | 'AUDIO_QUALITY_INSUFFICIENT'
  | 'SPEAKER_NOT_ENROLLED'
  | 'PROCESSING_ERROR'
  | 'AWAITING_MODEL_INTEGRATION';

export interface AuthenticationResponse {
  experiment_id: string;
  speaker_id: string;
  input_method: string;
  timestamp: string;
  decision: AuthenticationDecision;
  threshold: number;
  is_provisional_threshold: boolean;
  similarity_score?: number;
  total_processing_time_ms: number;
  stages: PipelineStageInfo[];
  standardization?: StandardizationResult;
  aasist: AASISTResult;
  deepfilternet: DeepFilterNetResult;
  silero_vad: SileroVADResult;
  ecapa: ECAPAResult;
  is_ml_fully_integrated: boolean;
  message: string;
}

export interface SpeakerEnrollmentItem {
  speaker_id: string;
  created_at: string;
  sample_count: number;
  notes?: string;
}

export interface EnrollmentResponse {
  success: boolean;
  speaker_id: string;
  message: string;
  standardization?: StandardizationResult;
  stages: PipelineStageInfo[];
  is_model_connected: boolean;
}

export interface ModelStatus {
  name: string;
  stage: number;
  is_functional: boolean;
  weight_file_found?: boolean;
  expected_weight_path?: string;
  status_message: string;
  input_sample_rate?: number;
  internal_sample_rate?: number;
  output_sample_rate?: number;
  embedding_dimension?: number;
}

export interface ModelsStatusResponse {
  aasist: ModelStatus;
  deepfilternet: ModelStatus;
  silero_vad: ModelStatus;
  ecapa: ModelStatus;
  all_functional: boolean;
}

export interface ExperimentHistoryItem {
  experiment_id: string;
  speaker_id: string;
  timestamp: string;
  input_method: string;
  aasist_prediction?: string;
  spoof_probability?: number;
  vad_speech_duration?: number;
  ecapa_similarity?: number;
  threshold?: number;
  final_decision: string;
  total_duration_sec?: number;
  stages_detail?: Record<string, any>;
}

export interface ExperimentStats {
  total_attempts: number;
  successful_authentications: number;
  rejected_attempts: number;
  spoof_detections: number;
  average_processing_time_sec: number;
  average_similarity?: number;
  decision_counts: Record<string, number>;
}
