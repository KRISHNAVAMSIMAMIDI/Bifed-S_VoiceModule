import sqlite3
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.config import settings

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Table 1: Speaker Enrollments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS enrollments (
        speaker_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        sample_count INTEGER DEFAULT 1,
        embedding_path TEXT,
        is_active INTEGER DEFAULT 1,
        notes TEXT
    )
    """)

    # Table 2: Experiment History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS experiments (
        experiment_id TEXT PRIMARY KEY,
        speaker_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        input_method TEXT NOT NULL,
        aasist_prediction TEXT,
        spoof_probability REAL,
        vad_speech_duration REAL,
        ecapa_similarity REAL,
        threshold REAL,
        final_decision TEXT NOT NULL,
        total_duration_sec REAL,
        stages_detail TEXT
    )
    """)

    conn.commit()
    conn.close()

# Enrollment Database Operations
def db_list_enrollments() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT speaker_id, created_at, sample_count, notes FROM enrollments WHERE is_active = 1 ORDER BY created_at DESC")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def db_get_enrollment(speaker_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM enrollments WHERE speaker_id = ? AND is_active = 1", (speaker_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def db_save_enrollment(speaker_id: str, embedding_path: str, notes: str = "") -> None:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO enrollments (speaker_id, created_at, sample_count, embedding_path, is_active, notes)
        VALUES (?, ?, 1, ?, 1, ?)
        ON CONFLICT(speaker_id) DO UPDATE SET
            created_at = excluded.created_at,
            sample_count = enrollments.sample_count + 1,
            embedding_path = excluded.embedding_path,
            is_active = 1,
            notes = excluded.notes
    """, (speaker_id, now_str, embedding_path, notes))
    conn.commit()
    conn.close()

def db_delete_enrollment(speaker_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM enrollments WHERE speaker_id = ?", (speaker_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# Experiment History Operations
def db_save_experiment(
    experiment_id: str,
    speaker_id: str,
    input_method: str,
    aasist_prediction: Optional[str],
    spoof_probability: Optional[float],
    vad_speech_duration: Optional[float],
    ecapa_similarity: Optional[float],
    threshold: float,
    final_decision: str,
    total_duration_sec: float,
    stages_detail: Dict[str, Any]
) -> None:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO experiments (
            experiment_id, speaker_id, timestamp, input_method,
            aasist_prediction, spoof_probability, vad_speech_duration,
            ecapa_similarity, threshold, final_decision, total_duration_sec, stages_detail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        experiment_id, speaker_id, now_str, input_method,
        aasist_prediction, spoof_probability, vad_speech_duration,
        ecapa_similarity, threshold, final_decision, total_duration_sec,
        json.dumps(stages_detail)
    ))
    conn.commit()
    conn.close()

def db_list_experiments(speaker_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if speaker_id:
        cursor.execute("SELECT * FROM experiments WHERE speaker_id = ? ORDER BY timestamp DESC LIMIT ?", (speaker_id, limit))
    else:
        cursor.execute("SELECT * FROM experiments ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = []
    for row in cursor.fetchall():
        item = dict(row)
        if item.get("stages_detail"):
            try:
                item["stages_detail"] = json.loads(item["stages_detail"])
            except Exception:
                pass
        rows.append(item)
    conn.close()
    return rows

def db_clear_experiments() -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM experiments")
    count = cursor.rowcount
    conn.commit()
    conn.close()
    return count
