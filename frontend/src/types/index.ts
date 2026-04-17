/** Unified subtitle line for VideoPlayer and SubtitlePanel components */
export interface SubtitleLine {
  start: number;       // seconds
  end: number;         // seconds
  text: string;        // original text
  translated_text?: string;  // Chinese translation
  romaji?: string;     // full romaji string
  romaji_segments?: RomajiSegment[];  // per-word romaji
}

export interface RomajiSegment {
  orig: string;   // original text segment
  hira: string;   // hiragana reading
  roma: string;   // romaji reading
  type: 'kanji' | 'hiragana' | 'katakana' | 'ascii' | 'number' | 'symbol' | 'unknown';
}
