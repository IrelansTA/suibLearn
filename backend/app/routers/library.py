"""Library routes - content library management (list, detail, delete)."""

import json
import logging

from fastapi import APIRouter, HTTPException

from app.models.database import (
    list_videos,
    get_video,
    get_subtitle_lines,
    delete_video as db_delete_video,
)
from app.services.storage import delete_video_files

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def api_list_videos(search: str = "", language: str = ""):
    """List all videos with optional search and language filter."""
    videos = await list_videos(search=search, language=language)
    return {"videos": videos, "total": len(videos)}


@router.get("/{video_id}")
async def api_get_video_detail(video_id: str):
    """Get video metadata and all subtitle lines."""
    video = await get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    subtitle_lines = await get_subtitle_lines(video_id)

    # Parse annotation JSON for each line
    for line in subtitle_lines:
        if line.get("annotation"):
            try:
                line["annotation"] = json.loads(line["annotation"])
            except (json.JSONDecodeError, TypeError):
                line["annotation"] = None

    return {
        "video": video,
        "subtitles": subtitle_lines,
    }


@router.delete("/{video_id}")
async def api_delete_video(video_id: str):
    """Delete a video and all associated files and data."""
    video = await get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    # Delete files from storage
    delete_video_files(video_id)

    # Delete from database (cascade deletes subtitle_lines)
    await db_delete_video(video_id)

    return {"status": "ok", "message": f"已删除视频: {video['title']}"}