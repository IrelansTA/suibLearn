"""SQLite database module for tracking videos and subtitle processing."""

import aiosqlite
import json
import time
from typing import Optional

from app.config import settings

_db_path = settings.DATABASE_PATH


async def get_db() -> aiosqlite.Connection:
    """Get a database connection."""
    db = await aiosqlite.connect(_db_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db():
    """Initialize database tables."""
    async with aiosqlite.connect(_db_path) as db:
        await db.execute("PRAGMA foreign_keys = ON")

        # Videos table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS videos (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                source_language TEXT DEFAULT 'ja',
                video_filename TEXT NOT NULL,
                subtitle_filename TEXT NOT NULL,
                video_path TEXT NOT NULL,
                subtitle_path TEXT NOT NULL,
                duration REAL,
                file_size INTEGER,
                thumbnail_path TEXT,
                status TEXT DEFAULT 'processing',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Subtitle lines table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS subtitle_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
                index_num INTEGER NOT NULL,
                start_time REAL NOT NULL,
                end_time REAL NOT NULL,
                original_text TEXT NOT NULL,
                translated_text TEXT,
                annotation TEXT,
                status TEXT DEFAULT 'pending',
                UNIQUE(video_id, index_num)
            )
        """)

        # Index for faster subtitle retrieval
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_subtitle_lines_video_id
            ON subtitle_lines(video_id, start_time)
        """)

        await db.commit()


# --- Video Operations ---

async def create_video(
    video_id: str,
    title: str,
    source_language: str,
    video_filename: str,
    subtitle_filename: str,
    video_path: str,
    subtitle_path: str,
    file_size: int = 0,
) -> dict:
    """Create a new video record."""
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            INSERT INTO videos (id, title, source_language, video_filename, subtitle_filename,
                                video_path, subtitle_path, file_size, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing')
            """,
            (video_id, title, source_language, video_filename, subtitle_filename,
             video_path, subtitle_path, file_size),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM videos WHERE id = ?", (video_id,))
        row = await cursor.fetchone()
        return dict(row)


async def get_video(video_id: str) -> Optional[dict]:
    """Get a video by ID."""
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM videos WHERE id = ?", (video_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_videos(search: str = "", language: str = "") -> list[dict]:
    """List all videos with optional search and language filter."""
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT * FROM videos WHERE 1=1"
        params = []

        if search:
            query += " AND title LIKE ?"
            params.append(f"%{search}%")
        if language:
            query += " AND source_language = ?"
            params.append(language)

        query += " ORDER BY created_at DESC"
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def update_video_status(video_id: str, status: str):
    """Update video processing status."""
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "UPDATE videos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (status, video_id),
        )
        await db.commit()


async def delete_video(video_id: str):
    """Delete a video and its subtitle lines (cascade)."""
    async with aiosqlite.connect(_db_path) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        await db.execute("DELETE FROM videos WHERE id = ?", (video_id,))
        await db.commit()


# --- Subtitle Line Operations ---

async def insert_subtitle_lines(video_id: str, lines: list[dict]):
    """Insert parsed subtitle lines for a video."""
    async with aiosqlite.connect(_db_path) as db:
        await db.executemany(
            """
            INSERT OR REPLACE INTO subtitle_lines
                (video_id, index_num, start_time, end_time, original_text, translated_text, status)
            VALUES (?, ?, ?, ?, ?, ?, 'done')
            """,
            [(video_id, line["index_num"], line["start_time"], line["end_time"],
              line["original_text"], line.get("translated_text", ""))
             for line in lines],
        )
        await db.commit()


async def get_subtitle_lines(video_id: str) -> list[dict]:
    """Get all subtitle lines for a video, ordered by start time."""
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM subtitle_lines WHERE video_id = ? ORDER BY start_time",
            (video_id,),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def update_subtitle_translation(video_id: str, index_num: int, translated_text: str):
    """Update translation for a single subtitle line."""
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            """
            UPDATE subtitle_lines SET translated_text = ?, status = 'translated'
            WHERE video_id = ? AND index_num = ?
            """,
            (translated_text, video_id, index_num),
        )
        await db.commit()


async def update_subtitle_translations_batch(video_id: str, translations: list[dict]):
    """Batch update translations for multiple subtitle lines."""
    async with aiosqlite.connect(_db_path) as db:
        await db.executemany(
            """
            UPDATE subtitle_lines SET translated_text = ?, status = 'translated'
            WHERE video_id = ? AND index_num = ?
            """,
            [(t["translated_text"], video_id, t["index_num"]) for t in translations],
        )
        await db.commit()


async def update_subtitle_annotation(video_id: str, index_num: int, annotation: str):
    """Update annotation for a single subtitle line."""
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            """
            UPDATE subtitle_lines SET annotation = ?, status = 'done'
            WHERE video_id = ? AND index_num = ?
            """,
            (annotation, video_id, index_num),
        )
        await db.commit()


async def update_subtitle_annotations_batch(video_id: str, annotations: list[dict]):
    """Batch update annotations for multiple subtitle lines."""
    async with aiosqlite.connect(_db_path) as db:
        await db.executemany(
            """
            UPDATE subtitle_lines SET annotation = ?, status = 'done'
            WHERE video_id = ? AND index_num = ?
            """,
            [(a["annotation"], video_id, a["index_num"]) for a in annotations],
        )
        await db.commit()


async def check_all_subtitles_done(video_id: str) -> bool:
    """Check if all subtitle lines for a video are fully processed."""
    async with aiosqlite.connect(_db_path) as db:
        cursor = await db.execute(
            "SELECT COUNT(*) FROM subtitle_lines WHERE video_id = ? AND status != 'done'",
            (video_id,),
        )
        row = await cursor.fetchone()
        return row[0] == 0

# --- Settings Operations ---

async def get_setting(key: str) -> Optional[str]:
    """Get a setting value by key."""
    async with aiosqlite.connect(_db_path) as db:
        cursor = await db.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = await cursor.fetchone()
        return row[0] if row else None


async def set_setting(key: str, value: str):
    """Set a setting value."""
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )
        await db.commit()