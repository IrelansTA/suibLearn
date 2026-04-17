"""Upload routes - video and subtitle file upload with async processing."""

import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, BackgroundTasks
from typing import Optional

from app.config import settings
from app.services.storage import (
    generate_video_id,
    validate_video_extension,
    validate_subtitle_extension,
    check_storage_capacity,
    save_uploaded_file,
    get_storage_info,
)
from app.services.subtitle_parser import parse_subtitle_file
from app.services.translator import translate_subtitle_lines
from app.services.annotation import annotate_subtitle_lines
from app.models.database import (
    create_video,
    insert_subtitle_lines,
    update_video_status,
    check_all_subtitles_done,
)

logger = logging.getLogger(__name__)
router = APIRouter()


async def _process_subtitles_background(video_id: str, subtitle_abs_path: str, source_language: str):
    """Background task: parse subtitles and store them. No translation or annotation — use subtitle file content as-is."""
    try:
        # Step 1: Parse subtitle file
        logger.info(f"Parsing subtitles for video {video_id}")
        entries = parse_subtitle_file(subtitle_abs_path)

        if not entries:
            logger.warning(f"No subtitle entries found for video {video_id}")
            await update_video_status(video_id, "error")
            return

        # Step 2: Store parsed subtitles
        await insert_subtitle_lines(video_id, entries)
        logger.info(f"Stored {len(entries)} subtitle lines for video {video_id}")

        # Step 3: Mark as ready — no translation/annotation needed
        await update_video_status(video_id, "ready")
        logger.info(f"Subtitle processing complete for video {video_id}")

    except Exception as e:
        logger.exception(f"Background subtitle processing failed for {video_id}: {e}")
        await update_video_status(video_id, "error")


@router.post("")
async def api_upload(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    source_language: str = Form("ja"),
    video: UploadFile = File(...),
    subtitle: UploadFile = File(...),
    collection_id: Optional[str] = Form(None),
):
    """
    Upload a video file and subtitle file.
    Returns immediately after saving files, processes subtitles in background.
    """
    # Validate video format
    if not validate_video_extension(video.filename or ""):
        raise HTTPException(
            status_code=400,
            detail="不支持的视频格式。请上传 mp4 或 mkv 文件。",
        )

    # Validate subtitle format
    if not validate_subtitle_extension(subtitle.filename or ""):
        raise HTTPException(
            status_code=400,
            detail="不支持的字幕格式。请上传 srt 或 ass 文件。",
        )

    # Read file contents
    video_content = await video.read()
    subtitle_content = await subtitle.read()

    # Check file size (0 = no limit)
    if settings.MAX_FILE_SIZE > 0 and len(video_content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"视频文件过大。最大允许 {settings.MAX_FILE_SIZE // (1024*1024)}MB。",
        )

    # Check storage capacity
    if not check_storage_capacity(len(video_content)):
        raise HTTPException(
            status_code=507,
            detail="存储空间不足。请删除一些旧内容后重试。",
        )

    # Generate video ID and save files
    video_id = generate_video_id()

    try:
        file_info = await save_uploaded_file(
            video_id=video_id,
            video_content=video_content,
            video_filename=video.filename or "video.mp4",
            subtitle_content=subtitle_content,
            subtitle_filename=subtitle.filename or "subtitle.srt",
        )
    except Exception as e:
        logger.exception(f"File save failed: {e}")
        raise HTTPException(status_code=500, detail=f"文件保存失败: {str(e)}")

    # Create database record
    video_record = await create_video(
        video_id=video_id,
        title=title.strip() or (video.filename or "未命名"),
        source_language=source_language,
        video_filename=video.filename or "video.mp4",
        subtitle_filename=subtitle.filename or "subtitle.srt",
        video_path=file_info["video_path"],
        subtitle_path=file_info["subtitle_path"],
        file_size=file_info["file_size"],
        collection_id=collection_id,
    )

    # Enqueue background processing
    background_tasks.add_task(
        _process_subtitles_background,
        video_id,
        file_info["subtitle_abs_path"],
        source_language,
    )

    return {
        "video_id": video_id,
        "title": video_record["title"],
        "status": "processing",
        "message": "上传成功！字幕正在后台处理...",
    }


@router.get("/storage")
async def api_storage_info():
    """Get storage usage information."""
    return get_storage_info()