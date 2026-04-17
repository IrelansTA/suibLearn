"""SubLearn - 视频字幕学习平台 后端主入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.config import settings
from app.models.database import init_db
from app.routers import upload, library, collections


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    # Startup: initialize database
    await init_db()
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="SubLearn API",
    description="视频字幕学习平台后端服务 - 上传视频+字幕，生成学习模式",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS middleware - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "*",  # Allow all for mobile access during dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(library.router, prefix="/api/videos", tags=["library"])
app.include_router(collections.router, prefix="/api/collections", tags=["collections"])

# Serve media files (for local dev; in production Nginx handles this)
app.mount("/media", StaticFiles(directory=settings.MEDIA_DIR), name="media")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "sublearn", "version": "0.2.0"}