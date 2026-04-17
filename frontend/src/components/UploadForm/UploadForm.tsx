import { useState, useRef, useCallback } from 'react';
import { uploadFiles } from '../../services/api';

interface Props {
  collectionId?: string;
  onSuccess: (videoId: string) => void;
  onCancel: () => void;
}

type Status = 'idle' | 'uploading' | 'success' | 'error';

const LANGUAGES = [
  { value: 'ja', label: '🇯🇵 日语' },
  { value: 'en', label: '🇺🇸 英语' },
  { value: 'zh', label: '🇨🇳 中文' },
  { value: 'ko', label: '🇰🇷 韩语' },
];

const VIDEO_EXTENSIONS = ['.mp4', '.mkv'];
const SUBTITLE_EXTENSIONS = ['.srt', '.ass'];

function getExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function validateFile(file: File | null, allowedExts: string[], label: string): string | null {
  if (!file) return `请选择${label}文件`;
  const ext = getExtension(file.name);
  if (!allowedExts.includes(ext)) {
    return `${label}仅支持 ${allowedExts.join(', ')} 格式`;
  }
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function UploadForm({ collectionId, onSuccess, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('ja');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const videoInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  const handleVideoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setVideoFile(file);
    setError('');
    // Auto-fill title from video filename
    if (file && !title) {
      const name = file.name.replace(/\.[^.]+$/, '');
      setTitle(name);
    }
  }, [title]);

  const handleSubtitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSubtitleFile(e.target.files?.[0] ?? null);
    setError('');
  }, []);

  const handleDrop = useCallback(
    (setter: (f: File | null) => void, allowedExts: string[], label: string) =>
      (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0] ?? null;
        if (file) {
          const err = validateFile(file, allowedExts, label);
          if (err) {
            setError(err);
            return;
          }
          setter(file);
          setError('');
          if (setter === setVideoFile && !title) {
            setTitle(file.name.replace(/\.[^.]+$/, ''));
          }
        }
      },
    [title],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate
      const videoErr = validateFile(videoFile, VIDEO_EXTENSIONS, '视频');
      if (videoErr) { setError(videoErr); return; }
      const subErr = validateFile(subtitleFile, SUBTITLE_EXTENSIONS, '字幕');
      if (subErr) { setError(subErr); return; }
      if (!title.trim()) { setError('请输入标题'); return; }

      setStatus('uploading');
      setProgress(0);
      setError('');

      try {
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('source_language', language);
        formData.append('video', videoFile!);
        formData.append('subtitle', subtitleFile!);
        if (collectionId) {
          formData.append('collection_id', collectionId);
        }

        const result = await uploadFiles(formData, (pct) => setProgress(pct));
        setStatus('success');
        onSuccess(result.video_id);
      } catch (err: any) {
        setStatus('error');
        setError(err.message || '上传失败，请重试');
      }
    },
    [videoFile, subtitleFile, title, language, collectionId, onSuccess],
  );

  const isUploading = status === 'uploading';

  const filePickerClasses =
    'relative flex flex-col items-center justify-center w-full min-h-[120px] p-6 border-2 border-dashed border-[#333] rounded-xl cursor-pointer transition-colors hover:border-[#e74c3c]/60 hover:bg-[#1a1a1a]';
  const filePickerActive = 'border-[#e74c3c] bg-[#1a1010]';

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-8">
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 sm:p-8 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">
              <span className="text-[#e74c3c]">上传</span>视频
            </h2>
            {collectionId && (
              <p className="text-xs text-[#888] mt-1">上传至合集</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="p-2 rounded-lg hover:bg-[#2a2a2a] transition min-w-[44px] min-h-[44px] flex items-center justify-center text-[#888] hover:text-[#e0e0e0] disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入视频标题"
              disabled={isUploading}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-[#e0e0e0] placeholder-[#555] focus:border-[#e74c3c] outline-none transition disabled:opacity-50 min-h-[44px]"
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">视频语言</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isUploading}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-[#e0e0e0] focus:border-[#e74c3c] outline-none transition disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Video File Picker */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">视频文件</label>
            <div
              className={`${filePickerClasses} ${videoFile ? filePickerActive : ''}`}
              onClick={() => !isUploading && videoInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop(setVideoFile, VIDEO_EXTENSIONS, '视频')}
            >
              <input
                ref={videoInputRef}
                type="file"
                accept=".mp4,.mkv"
                onChange={handleVideoChange}
                disabled={isUploading}
                className="hidden"
              />
              {videoFile ? (
                <div className="text-center">
                  <div className="text-2xl mb-1">🎬</div>
                  <p className="text-sm text-[#e0e0e0] font-medium truncate max-w-[280px]">
                    {videoFile.name}
                  </p>
                  <p className="text-xs text-[#666] mt-1">{formatSize(videoFile.size)}</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl mb-2 opacity-40">🎬</div>
                  <p className="text-sm text-[#666]">点击选择或拖放视频文件</p>
                  <p className="text-xs text-[#555] mt-1">.mp4, .mkv</p>
                </div>
              )}
            </div>
          </div>

          {/* Subtitle File Picker */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">字幕文件</label>
            <div
              className={`${filePickerClasses} ${subtitleFile ? filePickerActive : ''}`}
              onClick={() => !isUploading && subtitleInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop(setSubtitleFile, SUBTITLE_EXTENSIONS, '字幕')}
            >
              <input
                ref={subtitleInputRef}
                type="file"
                accept=".srt,.ass"
                onChange={handleSubtitleChange}
                disabled={isUploading}
                className="hidden"
              />
              {subtitleFile ? (
                <div className="text-center">
                  <div className="text-2xl mb-1">📝</div>
                  <p className="text-sm text-[#e0e0e0] font-medium truncate max-w-[280px]">
                    {subtitleFile.name}
                  </p>
                  <p className="text-xs text-[#666] mt-1">{formatSize(subtitleFile.size)}</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl mb-2 opacity-40">📝</div>
                  <p className="text-sm text-[#666]">点击选择或拖放字幕文件</p>
                  <p className="text-xs text-[#555] mt-1">.srt, .ass</p>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-[#2a1515] border border-[#e74c3c]/30 rounded-lg">
              <span className="text-[#e74c3c] shrink-0">⚠</span>
              <p className="text-sm text-[#e74c3c]">{error}</p>
            </div>
          )}

          {/* Progress Bar */}
          {isUploading && (
            <div>
              <div className="flex justify-between text-xs text-[#888] mb-1.5">
                <span>上传中...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#e74c3c] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isUploading}
              className="flex-1 px-4 py-3 rounded-xl border border-[#333] text-[#888] hover:bg-[#2a2a2a] hover:text-[#e0e0e0] transition min-h-[44px] disabled:opacity-40 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 px-4 py-3 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? `上传中 ${progress}%` : '开始上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
