"""Subtitle parsing service - parse SRT/ASS files into unified format."""

import logging
import re
from pathlib import Path
from typing import Optional

import chardet
import pysubs2

logger = logging.getLogger(__name__)


def detect_encoding(file_path: str) -> str:
    """Detect file encoding using chardet."""
    with open(file_path, "rb") as f:
        raw = f.read()
    result = chardet.detect(raw)
    encoding = result.get("encoding", "utf-8") or "utf-8"
    confidence = result.get("confidence", 0)
    logger.info(f"Detected encoding: {encoding} (confidence: {confidence:.2f}) for {file_path}")
    return encoding


def read_subtitle_file(file_path: str) -> str:
    """Read a subtitle file with auto-detected encoding, return as UTF-8 string."""
    encoding = detect_encoding(file_path)

    # Try detected encoding first, fallback to common encodings
    encodings_to_try = [encoding, "utf-8", "utf-8-sig", "gbk", "gb2312", "shift_jis", "euc-jp", "latin-1"]
    seen = set()

    for enc in encodings_to_try:
        if enc.lower() in seen:
            continue
        seen.add(enc.lower())
        try:
            with open(file_path, "r", encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, LookupError):
            continue

    # Last resort: read with errors='replace'
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def strip_html_tags(text: str) -> str:
    """Strip HTML tags from SRT text."""
    return re.sub(r"<[^>]+>", "", text)


def strip_ass_tags(text: str) -> str:
    """Strip ASS override tags like {\\b1}, {\\an8}, {\\pos(x,y)} etc."""
    # Remove {...} blocks
    text = re.sub(r"\{[^}]*\}", "", text)
    # Convert \\N and \\n to space
    text = text.replace("\\N", " ").replace("\\n", " ")
    return text.strip()


def clean_subtitle_text(text: str) -> str:
    """Clean subtitle text by removing all tags and normalizing whitespace."""
    text = strip_html_tags(text)
    text = strip_ass_tags(text)
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _load_subs(file_path: str) -> pysubs2.SSAFile:
    """Load subtitle file with encoding detection."""
    content = read_subtitle_file(file_path)
    try:
        return pysubs2.SSAFile.from_string(content)
    except Exception as e:
        logger.warning(f"pysubs2 from_string failed, trying direct file load: {e}")
        encoding = detect_encoding(file_path)
        try:
            return pysubs2.load(file_path, encoding=encoding)
        except Exception as e2:
            raise ValueError(f"无法解析字幕文件: {str(e2)}")


# Style names that indicate Japanese dialogue
_JP_STYLES = {"jp", "japanese", "ja", "jpn", "jp_dialog", "日本語", "原文"}
# Style names that indicate Chinese translation
_CN_STYLES = {"cn", "chinese", "ch", "chs", "cht", "zh", "中文", "翻译", "译文"}
# Style names to skip (not dialogue)
_SKIP_STYLES = {
    "title", "staff", "disclaimer", "note", "sign", "screen",
    "op", "ed", "jp_op", "jp_ed", "cn_op", "cn_ed",
    "opening", "ending", "comment", "credit",
}


def _classify_style(style_name: str) -> str:
    """Classify a style name as 'jp', 'cn', or 'skip'."""
    name_lower = style_name.lower().strip()
    if name_lower in _SKIP_STYLES:
        return "skip"
    if name_lower in _JP_STYLES:
        return "jp"
    if name_lower in _CN_STYLES:
        return "cn"
    # Partial match
    for s in _SKIP_STYLES:
        if s in name_lower:
            return "skip"
    for s in _JP_STYLES:
        if s in name_lower:
            return "jp"
    for s in _CN_STYLES:
        if s in name_lower:
            return "cn"
    return "unknown"


def _make_time_key(start_ms: int, end_ms: int) -> str:
    """Create a time key for matching JP and CN lines."""
    return f"{start_ms}-{end_ms}"


def parse_subtitle_file(file_path: str) -> list[dict]:
    """
    Parse a subtitle file (SRT/ASS/SSA) into a unified list of subtitle entries.

    For ASS files with separate JP and CN styles, pairs them by matching timestamps.

    Returns list of dicts:
    [
        {
            "index_num": 0,
            "start_time": 1.234,
            "end_time": 3.456,
            "original_text": "日语原文 (or the only text if single-language)",
            "translated_text": "中文翻译 (if bilingual, else empty)"
        },
        ...
    ]
    """
    file_path = str(file_path)
    subs = _load_subs(file_path)

    # --- Check if this is a bilingual ASS file (JP + CN styles) ---
    style_names = {s.lower().strip() for s in subs.styles.keys()} if hasattr(subs, 'styles') else set()

    # Collect all dialogue events and classify them
    jp_lines = {}  # time_key -> clean text
    cn_lines = {}  # time_key -> clean text
    all_lines = []  # fallback: all dialogue events
    has_jp = False
    has_cn = False

    for event in subs:
        if event.type != "Dialogue":
            continue

        style_class = _classify_style(event.style)

        text = clean_subtitle_text(event.text)
        if not text:
            continue

        time_key = _make_time_key(event.start, event.end)

        if style_class == "jp":
            jp_lines[time_key] = {"text": text, "start": event.start, "end": event.end}
            has_jp = True
        elif style_class == "cn":
            cn_lines[time_key] = {"text": text, "start": event.start, "end": event.end}
            has_cn = True
        elif style_class == "skip":
            continue
        else:
            # Unknown style — collect as generic
            all_lines.append({"text": text, "start": event.start, "end": event.end})

    # --- Build output ---
    entries = []

    if has_jp and has_cn:
        # BILINGUAL MODE: pair JP and CN by timestamp
        logger.info(f"Detected bilingual ASS: {len(jp_lines)} JP lines, {len(cn_lines)} CN lines")

        # Use JP lines as the primary timeline, attach CN translations
        sorted_jp = sorted(jp_lines.items(), key=lambda x: x[1]["start"])

        for index, (time_key, jp) in enumerate(sorted_jp):
            cn = cn_lines.get(time_key)
            entries.append({
                "index_num": index,
                "start_time": round(jp["start"] / 1000.0, 3),
                "end_time": round(jp["end"] / 1000.0, 3),
                "original_text": jp["text"],
                "translated_text": cn["text"] if cn else "",
            })

        # Also add any CN lines that didn't match a JP line (orphan translations)
        matched_keys = set(jp_lines.keys())
        orphan_cn = [(k, v) for k, v in cn_lines.items() if k not in matched_keys]
        if orphan_cn:
            logger.info(f"{len(orphan_cn)} CN lines without JP match, adding as translated-only")
            orphan_cn.sort(key=lambda x: x[1]["start"])
            for k, cn in orphan_cn:
                entries.append({
                    "index_num": len(entries),
                    "start_time": round(cn["start"] / 1000.0, 3),
                    "end_time": round(cn["end"] / 1000.0, 3),
                    "original_text": "",
                    "translated_text": cn["text"],
                })

        # Re-sort by start_time and re-index
        entries.sort(key=lambda x: x["start_time"])
        for i, e in enumerate(entries):
            e["index_num"] = i

    elif has_jp and not has_cn:
        # JP only
        logger.info(f"Detected JP-only ASS: {len(jp_lines)} lines")
        sorted_jp = sorted(jp_lines.values(), key=lambda x: x["start"])
        for index, jp in enumerate(sorted_jp):
            entries.append({
                "index_num": index,
                "start_time": round(jp["start"] / 1000.0, 3),
                "end_time": round(jp["end"] / 1000.0, 3),
                "original_text": jp["text"],
                "translated_text": "",
            })

    elif has_cn and not has_jp:
        # CN only
        logger.info(f"Detected CN-only ASS: {len(cn_lines)} lines")
        sorted_cn = sorted(cn_lines.values(), key=lambda x: x["start"])
        for index, cn in enumerate(sorted_cn):
            entries.append({
                "index_num": index,
                "start_time": round(cn["start"] / 1000.0, 3),
                "end_time": round(cn["end"] / 1000.0, 3),
                "original_text": cn["text"],
                "translated_text": "",
            })

    else:
        # SINGLE LANGUAGE / SRT / unknown styles — use all dialogue lines
        logger.info(f"Single-language subtitle: {len(all_lines)} lines")
        all_lines.sort(key=lambda x: x["start"])
        for index, line in enumerate(all_lines):
            entries.append({
                "index_num": index,
                "start_time": round(line["start"] / 1000.0, 3),
                "end_time": round(line["end"] / 1000.0, 3),
                "original_text": line["text"],
                "translated_text": "",
            })

    logger.info(f"Parsed {len(entries)} subtitle entries from {file_path}")
    return entries