from fastapi import APIRouter
from app.services.pipeline_service import get_pipeline_model_statuses
from app.config import settings

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "api_version": "1.0.0"
    }

@router.get("/models/status")
def model_statuses():
    return get_pipeline_model_statuses()
