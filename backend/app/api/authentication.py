import os
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.config import settings
from app.schemas.authentication import AuthenticationResponse
from app.services.authentication_service import authenticate_speaker

router = APIRouter()

@router.post("", response_model=AuthenticationResponse)
async def post_authentication(
    speaker_id: str = Form(...),
    input_method: str = Form("upload"),
    custom_threshold: Optional[float] = Form(None),
    audio_file: UploadFile = File(...)
):
    if not speaker_id or not speaker_id.strip():
        raise HTTPException(status_code=400, detail="Speaker ID is required.")

    ext = Path(audio_file.filename).suffix.lower() if audio_file.filename else ".wav"
    temp_filename = f"auth_{uuid.uuid4().hex[:8]}{ext}"
    temp_path = settings.TEMP_DIR / temp_filename

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)

        response = authenticate_speaker(
            speaker_id=speaker_id,
            raw_audio_path=str(temp_path),
            input_method=input_method,
            custom_threshold=custom_threshold
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        # Clean up ephemeral raw audio file
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass
