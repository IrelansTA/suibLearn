"""Translation service using Qwen3-Omni LLM API (OpenAI-compatible via DashScope)."""

import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


def _get_client() -> AsyncOpenAI:
    """Get LLM API client (Qwen3-Omni via DashScope, OpenAI-compatible)."""
    return AsyncOpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
    )


async def translate_subtitles(
    subtitles: list[dict],
    source_lang: str = "ja",
    target_lang: str = "zh",
    batch_size: int = 30,
) -> list[dict]:
    """
    Translate subtitle lines from source language to target language.
    Processes in batches for efficiency.
    Returns the same list with 'translated_text' field added.
    """
    if not settings.LLM_API_KEY:
        logger.warning("LLM API key not configured, skipping translation")
        for sub in subtitles:
            sub["translated_text"] = ""
        return subtitles

    client = _get_client()
    result = []

    for i in range(0, len(subtitles), batch_size):
        batch = subtitles[i:i + batch_size]
        translated = await _translate_batch(client, batch, source_lang, target_lang)
        result.extend(translated)

    return result


async def _translate_batch(
    client: AsyncOpenAI,
    batch: list[dict],
    source_lang: str,
    target_lang: str,
) -> list[dict]:
    """Translate a batch of subtitle lines using a single API call."""
    lang_names = {"ja": "日语", "en": "英语", "ko": "韩语", "zh": "中文"}
    src_name = lang_names.get(source_lang, source_lang)
    tgt_name = lang_names.get(target_lang, target_lang)

    # Build numbered text for batch translation
    lines_text = "\n".join(f"[{idx}] {sub['text']}" for idx, sub in enumerate(batch))

    prompt = f"""请将以下{src_name}字幕翻译成{tgt_name}。
要求：
1. 每行对应翻译，保持编号格式 [数字] 翻译内容
2. 翻译要自然流畅，符合口语表达
3. 保留语气词和情感色彩
4. 不要添加任何额外说明

原文：
{lines_text}"""

    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": "你是一个专业的字幕翻译专家，擅长将影视字幕翻译得自然流畅。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=4096,
        )

        reply = response.choices[0].message.content.strip()

        # Parse translated lines
        translations = _parse_numbered_translations(reply, len(batch))

        for idx, sub in enumerate(batch):
            sub["translated_text"] = translations.get(idx, "")

    except Exception as e:
        logger.exception(f"Translation batch failed: {e}")
        for sub in batch:
            sub["translated_text"] = ""

    return batch


def _parse_numbered_translations(text: str, expected_count: int) -> dict[int, str]:
    """Parse numbered translation output like '[0] 翻译内容'."""
    import re
    translations = {}
    for line in text.strip().split("\n"):
        line = line.strip()
        match = re.match(r"\[(\d+)\]\s*(.*)", line)
        if match:
            idx = int(match.group(1))
            content = match.group(2).strip()
            translations[idx] = content
    return translations


async def translate_subtitle_lines(
    video_id: str,
    source_lang: str = "ja",
    target_lang: str = "zh",
    batch_size: int = 30,
):
    """
    Translate subtitle lines from the database for a given video.
    Updates the database directly with translations.
    """
    from app.models.database import (
        get_subtitle_lines,
        update_subtitle_translations_batch,
    )

    if not settings.LLM_API_KEY:
        logger.warning("LLM API key not configured, skipping translation")
        return

    lines = await get_subtitle_lines(video_id)
    if not lines:
        return

    client = _get_client()

    for i in range(0, len(lines), batch_size):
        batch = lines[i:i + batch_size]
        # Build the text batch for translation
        text_batch = [{"text": line["original_text"]} for line in batch]
        translated = await _translate_batch(client, text_batch, source_lang, target_lang)

        # Prepare batch update
        updates = []
        for j, line in enumerate(batch):
            updates.append({
                "index_num": line["index_num"],
                "translated_text": translated[j].get("translated_text", ""),
            })

        await update_subtitle_translations_batch(video_id, updates)

    logger.info(f"Translation complete for video {video_id}")
