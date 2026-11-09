import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api import health, enrollment, authentication, history
from app.models.aasist import aasist_model
from app.models.deepfilternet import deepfilternet_model
from app.models.silero_vad import silero_vad_model
from app.models.ecapa import ecapa_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("BiFed-S-VoiceAuth")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Initializing BiFed-S Voice Authentication Demonstration backend...")
    init_db()
    logger.info("Database initialized at %s", settings.DATABASE_PATH)

    # Attempt to load ML models once on startup (non-blocking if weights not yet provided)
    logger.info("Checking pipeline model assets...")
    aasist_model.load()
    deepfilternet_model.load()
    silero_vad_model.load()
    ecapa_model.load()
    logger.info("Model readiness check completed.")

    yield
    # Shutdown actions
    logger.info("Shutting down BiFed-S backend.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Voice Biometric Authentication Demonstration Web Application for BiFed-S Project.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for React Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local demo development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(health.router, prefix="/api", tags=["System Health"])
app.include_router(enrollment.router, prefix="/api/enrollment", tags=["Speaker Enrollment"])
app.include_router(authentication.router, prefix="/api/authenticate", tags=["Voice Authentication"])
app.include_router(history.router, prefix="/api/history", tags=["Experiment History"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
