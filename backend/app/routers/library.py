"""Library routes - content library management (list, detail, delete)."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.database import (
    list_videos,
    get_video,
    get_subtitle_lines,
    delete_video as db_delete_video,
    update_videos_collection,
    get_collection,
)
from app.services.storage import delete_video_files

logger = logging.getLogger(__name__)
router = APIRouter()


class BatchMoveRequest(BaseModel):
    video_ids: list[str]
    collection_id: Optional[str] = None


@router.get("")
async def api_list_videos(search: str = "", language: str = "", collection_id: str = ""):
    """List all videos with optional search, language, and collection filter."""
    videos = await list_videos(
        search=search,
        language=language,
        collection_id=collection_id if collection_id else None,
    )
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


@router.post("/batch/move")
async def api_batch_move_videos(payload: BatchMoveRequest):
    """Move multiple videos to a specified collection (or None to remove from collection)."""
    if not payload.video_ids:
        raise HTTPException(status_code=400, detail="请选择至少一个视频")

    if payload.collection_id:
        collection = await get_collection(payload.collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="目标合集不存在")

    moved = await update_videos_collection(payload.video_ids, payload.collection_id)

    return {
        "status": "ok",
        "moved": moved,
        "collection_id": payload.collection_id,
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