"""File storage service - manages video and subtitle file storage."""

import logging
import os
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Supported formats
VIDEO_EXTENSIONS = {".mp4", ".mkv"}
SUBTITLE_EXTENSIONS = {".srt", ".ass", ".ssa"}


def generate_video_id() -> str:
    """Generate a unique video ID."""
    return str(uuid.uuid4())


def get_video_dir(video_id: str) -> Path:
    """Get the storage directory for a specific video."""
    return Path(settings.MEDIA_DIR) / video_id


def validate_video_extension(filename: str) -> bool:
    """Check if the file has a supported video extension."""
    ext = Path(filename).suffix.lower()
    return ext in VIDEO_EXTENSIONS


def validate_subtitle_extension(filename: str) -> bool:
    """Check if the file has a supported subtitle extension."""
    ext = Path(filename).suffix.lower()
    return ext in SUBTITLE_EXTENSIONS


def get_total_storage_used() -> int:
    """Calculate total storage used by all media files in bytes."""
    media_dir = Path(settings.MEDIA_DIR)
    if not media_dir.exists():
        return 0
    total = 0
    for f in media_dir.rglob("*"):
        if f.is_file():
            total += f.stat().st_size
    return total


def check_storage_capacity(additional_bytes: int = 0) -> bool:
    """Check if there's enough storage capacity for additional bytes."""
    used = get_total_storage_used()
    return (used + additional_bytes) <= settings.MAX_TOTAL_STORAGE


async def save_uploaded_file(
    video_id: str,
    video_content: bytes,
    video_filename: str,
    subtitle_content: bytes,
    subtitle_filename: str,
) -> dict:
    """
    Save uploaded video and subtitle files to storage.
    Returns dict with video_path and subtitle_path.
    """
    video_dir = get_video_dir(video_id)
    video_dir.mkdir(parents=True, exist_ok=True)

    video_ext = Path(video_filename).suffix.lower()
    subtitle_ext = Path(subtitle_filename).suffix.lower()

    video_path = video_dir / f"video{video_ext}"
    subtitle_path = video_dir / f"subtitle{subtitle_ext}"

    # Save files
    video_path.write_bytes(video_content)
    subtitle_path.write_bytes(subtitle_content)

    # If MKV, try to remux to MP4
    final_video_path = video_path
    if video_ext == ".mkv":
        remuxed = await remux_mkv_to_mp4(video_path)
        if remuxed:
            final_video_path = remuxed
            # Remove original MKV
            if video_path.exists() and video_path != final_video_path:
                video_path.unlink()

    return {
        "video_path": str(final_video_path.relative_to(Path(settings.MEDIA_DIR).parent.parent)),
        "subtitle_path": str(subtitle_path.relative_to(Path(settings.MEDIA_DIR).parent.parent)),
        "video_abs_path": str(final_video_path),
        "subtitle_abs_path": str(subtitle_path),
        "file_size": final_video_path.stat().st_size,
    }


async def remux_mkv_to_mp4(mkv_path: Path) -> Optional[Path]:
    """
    Remux MKV to MP4 container without re-encoding (fast, uses ffmpeg).
    Returns the MP4 path on success, None on failure.
    """
    mp4_path = mkv_path.with_suffix(".mp4")

    try:
        result = subprocess.run(
            [
                "ffmpeg", "-i", str(mkv_path),
                "-c", "copy",  # No re-encoding
                "-movflags", "+faststart",  # Optimize for streaming
                str(mp4_path),
            ],
            capture_output=True,
            text=True,
            timeout=120,  # 2 min max for remux
        )

        if result.returncode == 0 and mp4_path.exists():
            logger.info(f"Remuxed MKV to MP4: {mp4_path}")
            return mp4_path
        else:
            logger.warning(f"MKV remux failed: {result.stderr[:500]}")
            return None

    except FileNotFoundError:
        logger.warning("ffmpeg not found, skipping MKV remux")
        return None
    except subprocess.TimeoutExpired:
        logger.warning("MKV remux timed out")
        if mp4_path.exists():
            mp4_path.unlink()
        return None
    except Exception as e:
        logger.exception(f"MKV remux error: {e}")
        return None


def delete_video_files(video_id: str):
    """Delete all files for a video."""
    video_dir = get_video_dir(video_id)
    if video_dir.exists():
        shutil.rmtree(video_dir)
        logger.info(f"Deleted video files: {video_dir}")


def get_storage_info() -> dict:
    """Get storage usage information."""
    used = get_total_storage_used()
    total = settings.MAX_TOTAL_STORAGE
    return {
        "used_bytes": used,
        "total_bytes": total,
        "used_gb": round(used / (1024 ** 3), 2),
        "total_gb": round(total / (1024 ** 3), 2),
        "usage_percent": round(used / total * 100, 1) if total > 0 else 0,
    }