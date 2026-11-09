from fastapi import APIRouter, Query
from typing import List, Optional, Dict, Any
from app.database import db_list_experiments, db_clear_experiments
from app.schemas.history import ExperimentHistoryItem, ExperimentStats

router = APIRouter()

@router.get("", response_model=List[ExperimentHistoryItem])
def get_experiments(
    speaker_id: Optional[str] = Query(None, description="Filter experiments by speaker ID"),
    limit: int = Query(50, ge=1, le=200)
):
    rows = db_list_experiments(speaker_id=speaker_id, limit=limit)
    return [ExperimentHistoryItem(**r) for r in rows]

@router.get("/stats", response_model=ExperimentStats)
def get_experiment_stats():
    rows = db_list_experiments(limit=500)
    total = len(rows)
    success_count = sum(1 for r in rows if r["final_decision"] == "AUTHENTICATED")
    spoof_count = sum(1 for r in rows if r["final_decision"] == "SPOOF_DETECTED")
    rejected_count = sum(1 for r in rows if r["final_decision"] == "NOT_AUTHENTICATED")

    durations = [r["total_duration_sec"] for r in rows if r.get("total_duration_sec") is not None]
    avg_duration = sum(durations) / len(durations) if durations else 0.0

    similarities = [r["ecapa_similarity"] for r in rows if r.get("ecapa_similarity") is not None]
    avg_sim = round(sum(similarities) / len(similarities), 4) if similarities else None

    decision_counts: Dict[str, int] = {}
    for r in rows:
        dec = r.get("final_decision", "UNKNOWN")
        decision_counts[dec] = decision_counts.get(dec, 0) + 1

    return ExperimentStats(
        total_attempts=total,
        successful_authentications=success_count,
        rejected_attempts=rejected_count,
        spoof_detections=spoof_count,
        average_processing_time_sec=round(avg_duration, 3),
        average_similarity=avg_sim,
        decision_counts=decision_counts
    )

@router.delete("")
def clear_experiments():
    count = db_clear_experiments()
    return {"success": True, "message": f"Cleared {count} experiment records."}
