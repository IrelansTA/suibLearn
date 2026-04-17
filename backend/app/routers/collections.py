"""Collections routes - manage video collections (合集)."""

import logging
import os
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from typing import Optional

from app.config import settings
from app.models.database import (
    create_collection,
    list_collections,
    get_collection,
    update_collection,
    delete_collection,
    list_videos,
)
from app.services.storage import delete_video_files

logger = logging.getLogger(__name__)
router = APIRouter()

COVER_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _get_collection_dir(collection_id: str) -> Path:
    """Get the storage directory for a collection's assets."""
    return Path(settings.MEDIA_DIR) / "collections" / collection_id


def _save_cover_image(collection_id: str, content: bytes, filename: str) -> str:
    """Save cover image and return the relative path (for serving via /media)."""
    ext = Path(filename).suffix.lower()
    if ext not in COVER_EXTENSIONS:
        raise ValueError(f"不支持的图片格式: {ext}")

    collection_dir = _get_collection_dir(collection_id)
    collection_dir.mkdir(parents=True, exist_ok=True)

    cover_filename = f"cover{ext}"
    cover_abs = collection_dir / cover_filename
    cover_abs.write_bytes(content)

    # Return path relative to MEDIA_DIR parent's parent so it matches the /media mount
    # MEDIA_DIR is served at /media, so the relative path from MEDIA_DIR is what we need
    return f"collections/{collection_id}/{cover_filename}"


def _delete_collection_dir(collection_id: str):
    """Delete the collection's asset directory (cover images etc.)."""
    collection_dir = _get_collection_dir(collection_id)
    if collection_dir.exists():
        shutil.rmtree(collection_dir)
        logger.info(f"Deleted collection directory: {collection_dir}")


@router.post("")
async def api_create_collection(
    name: str = Form(...),
    source_language: str = Form("ja"),
    cover: Optional[UploadFile] = File(None),
):
    """Create a new collection, optionally with a cover image."""
    cover_path = None

    # We need to create the collection first to get the ID, but we need the ID for the cover path.
    # Create without cover, then update if cover provided.
    collection = await create_collection(
        name=name.strip(),
        source_language=source_language,
    )

    if cover and cover.filename:
        ext = Path(cover.filename).suffix.lower()
        if ext not in COVER_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的封面图片格式。请上传 jpg、png 或 webp 文件。",
            )
        content = await cover.read()
        if content:
            try:
                cover_path = _save_cover_image(collection["id"], content, cover.filename)
                collection = await update_collection(collection["id"], cover_path=cover_path)
            except Exception as e:
                logger.exception(f"Failed to save cover image: {e}")
                # Collection is created, just without cover — not a fatal error

    return {"collection": collection}


@router.get("")
async def api_list_collections():
    """List all collections with video counts."""
    collections = await list_collections()
    return {"collections": collections, "total": len(collections)}


@router.get("/{collection_id}")
async def api_get_collection(collection_id: str):
    """Get a collection's detail along with its videos."""
    collection = await get_collection(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="合集不存在")

    videos = await list_videos(collection_id=collection_id)

    return {
        "collection": collection,
        "videos": videos,
    }


@router.put("/{collection_id}")
async def api_update_collection(
    collection_id: str,
    name: Optional[str] = Form(None),
    cover: Optional[UploadFile] = File(None),
):
    """Update a collection's name and/or cover image."""
    existing = await get_collection(collection_id)
    if not existing:
        raise HTTPException(status_code=404, detail="合集不存在")

    cover_path = None
    if cover and cover.filename:
        ext = Path(cover.filename).suffix.lower()
        if ext not in COVER_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的封面图片格式。请上传 jpg、png 或 webp 文件。",
            )
        content = await cover.read()
        if content:
            try:
                cover_path = _save_cover_image(collection_id, content, cover.filename)
            except Exception as e:
                logger.exception(f"Failed to save cover image: {e}")
                raise HTTPException(status_code=500, detail="封面图片保存失败")

    updated = await update_collection(
        collection_id,
        name=name.strip() if name else None,
        cover_path=cover_path,
    )

    if not updated:
        raise HTTPException(status_code=404, detail="合集不存在")

    return {"collection": updated}


@router.delete("/{collection_id}")
async def api_delete_collection(collection_id: str):
    """Delete a collection, all its videos, and associated files."""
    existing = await get_collection(collection_id)
    if not existing:
        raise HTTPException(status_code=404, detail="合集不存在")

    # Delete collection from DB and get video IDs
    video_ids = await delete_collection(collection_id)

    # Delete video files from storage
    for vid in video_ids:
        delete_video_files(vid)

    # Delete collection's own assets (cover image dir)
    _delete_collection_dir(collection_id)

    return {
        "status": "ok",
        "message": f"已删除合集「{existing['name']}」及其 {len(video_ids)} 个视频",
    }
