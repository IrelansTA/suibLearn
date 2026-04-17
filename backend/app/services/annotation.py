"""Japanese romaji annotation service using pykakasi."""

import logging
import re
from typing import Optional

import pykakasi

logger = logging.getLogger(__name__)

# Initialize pykakasi converter (singleton)
_kakasi = None


def _get_kakasi():
    """Get or create pykakasi converter instance."""
    global _kakasi
    if _kakasi is None:
        _kakasi = pykakasi.kakasi()
    return _kakasi


def annotate_japanese(text: str) -> list[dict]:
    """
    Generate romaji annotations for Japanese text.
    Returns a list of word segments with readings.

    Each segment: {
        "orig": "食べる",       # original text
        "hira": "たべる",       # hiragana reading
        "roma": "taberu",     # romaji reading
        "type": "kanji"       # type: kanji, hiragana, katakana, ascii, symbol
    }
    """
    if not text.strip():
        return []

    kakasi = _get_kakasi()

    try:
        result = kakasi.convert(text)
        segments = []

        for item in result:
            orig = item.get("orig", "")
            hira = item.get("hira", "")
            hepburn = item.get("hepburn", "")

            if not orig:
                continue

            # Determine segment type
            seg_type = _classify_segment(orig)

            # For katakana, use the katakana itself as hiragana reading
            if seg_type == "katakana" and not hira:
                hira = _katakana_to_hiragana(orig)

            segments.append({
                "orig": orig,
                "hira": hira,
                "roma": hepburn,
                "type": seg_type,
            })

        return segments

    except Exception as e:
        logger.exception(f"Japanese annotation failed for: {text[:50]}")
        return [{"orig": text, "hira": "", "roma": "", "type": "unknown"}]


def get_romaji_string(text: str) -> str:
    """
    Get the full romaji reading for a Japanese text as a single string.
    Words are separated by spaces.
    """
    segments = annotate_japanese(text)
    parts = []
    for seg in segments:
        roma = seg.get("roma", "")
        if roma:
            parts.append(roma)
        elif seg.get("type") in ("ascii", "symbol"):
            parts.append(seg["orig"])
    return " ".join(parts)


def annotate_subtitles(subtitles: list[dict]) -> list[dict]:
    """
    Add romaji annotation to each subtitle line.
    Adds 'romaji' (string) and 'romaji_segments' (list) fields.
    """
    for sub in subtitles:
        text = sub.get("text", "")
        if text and _is_japanese(text):
            segments = annotate_japanese(text)
            sub["romaji"] = " ".join(s["roma"] for s in segments if s["roma"])
            sub["romaji_segments"] = segments
        else:
            sub["romaji"] = ""
            sub["romaji_segments"] = []

    return subtitles


async def annotate_subtitle_lines(video_id: str):
    """
    Annotate subtitle lines from the database for a given video.
    Updates the database directly with annotation JSON.
    """
    import json as _json
    from app.models.database import (
        get_subtitle_lines,
        update_subtitle_annotations_batch,
    )

    lines = await get_subtitle_lines(video_id)
    if not lines:
        return

    annotations = []
    for line in lines:
        text = line["original_text"]
        if text and _is_japanese(text):
            segments = annotate_japanese(text)
            annotation_data = {
                "romaji": " ".join(s["roma"] for s in segments if s["roma"]),
                "segments": segments,
            }
        else:
            annotation_data = {"romaji": "", "segments": []}

        annotations.append({
            "index_num": line["index_num"],
            "annotation": _json.dumps(annotation_data, ensure_ascii=False),
        })

    await update_subtitle_annotations_batch(video_id, annotations)
    logger.info(f"Annotation complete for video {video_id}")


# --- Helper Functions ---

def _classify_segment(text: str) -> str:
    """Classify a text segment by its character type."""
    if not text:
        return "unknown"

    # Check first non-whitespace character
    for char in text:
        if char.isspace():
            continue
        if '\u4e00' <= char <= '\u9fff' or '\u3400' <= char <= '\u4dbf':
            return "kanji"
        if '\u3040' <= char <= '\u309f':
            return "hiragana"
        if '\u30a0' <= char <= '\u30ff':
            return "katakana"
        if char.isascii() and char.isalpha():
            return "ascii"
        if char.isdigit():
            return "number"
        return "symbol"

    return "unknown"


def _is_japanese(text: str) -> bool:
    """Check if text contains Japanese characters (hiragana, katakana, or kanji used in Japanese)."""
    # Has hiragana or katakana → definitely Japanese
    if re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text):
        return True
    # Has CJK characters — could be Chinese or Japanese. Check for typical Japanese patterns.
    if re.search(r'[\u4e00-\u9fff]', text):
        # If mixed with hiragana/katakana it's Japanese (already caught above)
        # Standalone kanji could be Chinese or Japanese — assume Japanese in this context
        return True
    return False


def _katakana_to_hiragana(text: str) -> str:
    """Convert katakana to hiragana."""
    result = []
    for char in text:
        code = ord(char)
        if 0x30A0 <= code <= 0x30FF:
            result.append(chr(code - 0x60))  # Katakana to Hiragana offset
        else:
            result.append(char)
    return "".join(result)
