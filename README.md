# BiFed-S: Voice Biometric Authentication Demonstration Web Application

A professional, single-page research demonstration web application for the voice biometric authentication pipeline of the CSE final-year capstone project **BiFed-S**.

---

## 1. Project Overview & Objective

This application demonstrates the end-to-end voice biometric authentication pipeline designed for BiFed-S. It provides an interactive research interface allowing evaluators to:

1. **Enroll reference speakers** via live microphone recording or audio file upload (`.wav`, `.webm`, `.mp3`, `.ogg`).
2. **Execute the complete 6-stage sequential voice authentication pipeline**.
3. **Authenticate returning speakers** and evaluate similarity scores against enrolled references.
4. **Inspect individual model telemetry** (AASIST anti-spoof probabilities, DeepFilterNet3 enhancement metrics, Silero VAD speech ratios, and 192-dimensional ECAPA-TDNN cosine similarity).
5. **Analyze empirical performance metrics** and browse an SQLite audit log of experiment runs.

> **Scope Note:** This application is strictly dedicated to demonstrating the voice authentication pipeline. Face authentication, multimodal fusion, federated aggregation, Byzantine attack defense, and backdoor mitigation modules are deliberately excluded from this demonstration scope.

---

## 2. 6-Stage Voice Processing Pipeline Architecture

The pipeline processes voice samples in the strict, uncompromised sequential order:

```text
Audio Input (Live MediaRecorder / Upload)
      │
      ▼
[Stage 1: Audio Standardization]
  - Decode WebM / Opus / WAV containers
  - Convert to Mono, 16,000 Hz, 16-bit PCM WAV
  - Validate duration and channel constraints
      │
      ▼
[Stage 2: AASIST Anti-Spoofing Detection]
  - Run FIRST on raw standardized audio before any filtering
  - Reject synthetic, vocoded, or replayed spoof audio
  - IF Spoof detected ➔ ABORT pipeline & skip subsequent stages
  - IF Bona Fide ➔ Proceed to Stage 3
      │
      ▼
[Stage 3: DeepFilterNet3 Audio Enhancement]
  - Upsample 16 kHz audio to 48 kHz internal operating rate
  - Suppress environmental noise and acoustic artifacts
  - Resample enhanced output back to 16 kHz
      │
      ▼
[Stage 4: Silero Voice Activity Detection (VAD)]
  - Detect speech intervals and compute speech ratio
  - Trim unnecessary silence segments
  - Reject audio if remaining speech is insufficient (< 0.5s)
      │
      ▼
[Stage 5: ECAPA-TDNN Speaker Embedding Extraction]
  - Extract 192-dimensional L2-normalized speaker embedding vector
  - Compute Cosine Similarity against enrolled reference embedding:
        Cosine Sim = (A · B) / (||A|| * ||B||)
      │
      ▼
[Stage 6: Final Authentication Decision]
  - Compare cosine similarity against configurable threshold (default: 0.65)
  - Output Decision: AUTHENTICATED | NOT AUTHENTICATED | SPOOF DETECTED | etc.
```

---

## 3. Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS (Dark navy / charcoal research theme)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Audio API:** Browser `MediaRecorder` API + Web Audio `AudioContext` & `AnalyserNode` for live level meters

### Backend
- **Framework:** FastAPI with Python 3.11
- **Server:** Uvicorn (ASGI)
- **Validation:** Pydantic v2
- **Database:** SQLite (`backend/storage/bifed_experiments.db`)
- **Audio Processing:** Python `wave`, `struct`, `scipy`, `soundfile`
- **ML Frameworks (Plug-and-play):** ONNX Runtime (`onnxruntime`), PyTorch (`torch`, `torchaudio`), SpeechBrain

---

## 4. Project Directory Structure

```text
BiFed-S-Web/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI entrypoint & model readiness check
│   │   ├── config.py                   # Central settings, paths & thresholds
│   │   ├── database.py                 # SQLite initialization & CRUD operations
│   │   ├── models/                     # Modular ML model wrappers
│   │   │   ├── base.py                 # BaseVoiceModel abstract class
│   │   │   ├── aasist.py               # Stage 2: AASIST Anti-Spoofing (ONNX)
│   │   │   ├── deepfilternet.py        # Stage 3: DeepFilterNet3 (48 kHz)
│   │   │   ├── silero_vad.py           # Stage 4: Silero VAD
│   │   │   └── ecapa.py                # Stage 5: ECAPA-TDNN (192-dim)
│   │   ├── services/
│   │   │   ├── audio_standardization.py # Stage 1: 16 kHz mono WAV conversion
│   │   │   ├── pipeline_service.py     # Sequential pipeline orchestrator
│   │   │   ├── enrollment_service.py   # Speaker enrollment & reference storage
│   │   │   └── authentication_service.py # Verification & SQLite audit logging
│   │   ├── api/                        # REST API endpoints
│   │   │   ├── health.py               # Health & model availability status
│   │   │   ├── enrollment.py           # Enrollment endpoints (GET, POST, DELETE)
│   │   │   ├── authentication.py       # Authentication endpoint (POST)
│   │   │   └── history.py              # Experiment history & analytics endpoints
│   │   └── schemas/                    # Pydantic request & response schemas
│   ├── models_weights/                 # Directory for Colab model weights
│   │   ├── aasist/                     # AASIST.onnx
│   │   ├── silero_vad/                 # silero_vad.onnx
│   │   └── ecapa_tdnn/                 # ECAPA checkpoint & hparams
│   ├── storage/
│   │   ├── references/                 # Enrolled speaker embedding (.npy) files
│   │   └── temp/                       # Ephemeral audio files (auto-cleaned)
│   ├── venv/                           # Python 3.11 virtual environment
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/                 # 8 dashboard UI panels
│   │   ├── hooks/                      # useAudioRecorder MediaRecorder hook
│   │   ├── services/                   # Typed API client
│   │   ├── types/                      # TypeScript API contracts
│   │   ├── App.tsx                     # Single-page dashboard assembly
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

---

## 5. Execution Instructions (Windows PowerShell)

### Step 1: Start the FastAPI Backend
Open a PowerShell terminal and run:

```powershell
cd C:\Users\user\BiFed-S-Web\backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend server will start at:
- **API Root:** `http://127.0.0.1:8000`
- **Swagger Documentation:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/api/health`
- **Model Status:** `http://127.0.0.1:8000/api/models/status`

### Step 2: Start the React Frontend
Open a second PowerShell terminal and run:

```powershell
cd C:\Users\user\BiFed-S-Web\frontend
..\.tools\node-v20.18.0-win-x64\node.exe ..\.tools\node-v20.18.0-win-x64\node_modules\npm\bin\npm-cli.js run dev
```

The frontend development server will launch at:
- **Web App Dashboard:** `http://localhost:5173`

---

## 6. How to Connect Google Colab Model Weights

The backend is architected to load model weights directly without mock or placeholder data:

| Stage | Model Name | Destination Directory | Expected File(s) |
| :--- | :--- | :--- | :--- |
| **Stage 2** | AASIST Anti-Spoofing | `backend/models_weights/aasist/` | `AASIST.onnx` |
| **Stage 3** | DeepFilterNet3 | `backend/models_weights/deepfilternet/` | Model weights / `deepfilternet` wheel |
| **Stage 4** | Silero VAD | `backend/models_weights/silero_vad/` | `silero_vad.onnx` |
| **Stage 5** | ECAPA-TDNN | `backend/models_weights/ecapa_tdnn/` | `embedding_model.ckpt`, `hyperparams.yaml` |

When files are placed in these directories and the backend restarts, the `/api/models/status` endpoint will automatically detect them, marking each respective model as `Active` on the frontend dashboard.
