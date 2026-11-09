import os
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
from app.config import settings
from app.schemas.enrollment import SpeakerEnrollmentItem, EnrollmentResponse
from app.services.enrollment_service import (
    list_enrolled_speakers,
    enroll_speaker,
    delete_speaker_enrollment
)

router = APIRouter()

@router.get("", response_model=List[SpeakerEnrollmentItem])
def get_enrolled_speakers():
    return list_enrolled_speakers()

@router.post("", response_model=EnrollmentResponse)
async def post_enrollment(
    speaker_id: str = Form(...),
    confirm_overwrite: bool = Form(False),
    notes: Optional[str] = Form(""),
    audio_file: UploadFile = File(...)
):
    if not speaker_id or not speaker_id.strip():
        raise HTTPException(status_code=400, detail="Speaker ID is required.")

    # Validate file extension
    ext = Path(audio_file.filename).suffix.lower() if audio_file.filename else ".wav"
    temp_filename = f"enroll_{uuid.uuid4().hex[:8]}{ext}"
    temp_path = settings.TEMP_DIR / temp_filename

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)

        response = enroll_speaker(
            speaker_id=speaker_id,
            raw_audio_path=str(temp_path),
            confirm_overwrite=confirm_overwrite,
            notes=notes or ""
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        # Clean up temporary upload file if exists
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass

@router.delete("/{speaker_id}")
def delete_enrollment(speaker_id: str):
    success = delete_speaker_enrollment(speaker_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Speaker '{speaker_id}' not found.")
    return {"success": True, "message": f"Speaker '{speaker_id}' enrollment deleted successfully."}
