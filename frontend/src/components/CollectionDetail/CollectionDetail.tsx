import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCollectionDetail,
  deleteVideo,
  updateCollection,
  getCoverUrl,
} from '../../services/api';
import type { VideoItem, CollectionItem } from '../../services/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

const LANG_FLAGS: Record<string, string> = {
  ja: '🇯🇵',
  en: '🇺🇸',
  zh: '🇨🇳',
  ko: '🇰🇷',
};

const LANG_LABELS: Record<string, string> = {
  ja: '日语',
  en: '英语',
  zh: '中文',
  ko: '韩语',
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  processing: { label: '处理中...', cls: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30' },
  ready: { label: '就绪', cls: 'bg-green-600/20 text-green-400 border-green-600/30' },
  error: { label: '错误', cls: 'bg-red-600/20 text-red-400 border-red-600/30' },
};

const GRADIENTS = [
  'from-rose-600 to-orange-500',
  'from-violet-600 to-indigo-500',
  'from-cyan-600 to-blue-500',
  'from-emerald-600 to-teal-500',
  'from-amber-600 to-yellow-500',
  'from-pink-600 to-fuchsia-500',
  'from-sky-600 to-cyan-500',
  'from-red-600 to-pink-500',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

// ---------------------------------------------------------------------------
// Edit Collection Modal
// ---------------------------------------------------------------------------

interface EditModalProps {
  open: boolean;
  collection: CollectionItem | null;
  onClose: () => void;
  onUpdated: (c: CollectionItem) => void;
}

function EditCollectionModal({ open, collection, onClose, onUpdated }: EditModalProps) {
  const [name, setName] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && collection) {
      setName(collection.name);
      setCoverFile(null);
      setCoverPreview(collection.cover_path ? getCoverUrl(collection.cover_path) : null);
      setError('');
      setSubmitting(false);
    }
  }, [open, collection]);

  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const handleCoverChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setError('封面仅支持 jpg, png, webp, gif 格式');
        return;
      }
    }
    setCoverFile(file);
    setError('');
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection) return;
    if (!name.trim()) {
      setError('请输入合集名称');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      if (coverFile) {
        formData.append('cover', coverFile);
      }
      const updated = await updateCollection(collection.id, formData);
      onUpdated(updated);
    } catch (err: any) {
      setError(err.message || '更新失败，请重试');
      setSubmitting(false);
    }
  }, [name, coverFile, collection, onUpdated]);

  if (!open || !collection) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">
            <span className="text-[#e74c3c]">编辑</span>合集
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-[#2a2a2a] transition min-w-[44px] min-h-[44px] flex items-center justify-center text-[#888] hover:text-[#e0e0e0] disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">合集名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="合集名称"
              disabled={submitting}
              autoFocus
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-[#e0e0e0] placeholder-[#555] focus:border-[#e74c3c] outline-none transition disabled:opacity-50 min-h-[44px]"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm text-[#888] mb-1.5">封面图片</label>
            <div
              className={`relative flex flex-col items-center justify-center w-full min-h-[120px] border-2 border-dashed rounded-xl cursor-pointer transition-colors overflow-hidden ${
                coverPreview
                  ? 'border-[#e74c3c] bg-[#1a1010]'
                  : 'border-[#333] hover:border-[#e74c3c]/60 hover:bg-[#1a1a1a]'
              }`}
              onClick={() => !submitting && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleCoverChange}
                disabled={submitting}
                className="hidden"
              />
              {coverPreview ? (
                <div className="relative w-full h-32">
                  <img
                    src={coverPreview}
                    alt="封面预览"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <span className="text-sm text-white">点击更换</span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6">
                  <div className="text-3xl mb-2 opacity-40">🖼️</div>
                  <p className="text-sm text-[#666]">点击选择封面图片</p>
                  <p className="text-xs text-[#555] mt-1">jpg, png, webp, gif</p>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-[#2a1515] border border-[#e74c3c]/30 rounded-lg">
              <span className="text-[#e74c3c] shrink-0">⚠</span>
              <p className="text-sm text-[#e74c3c]">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 rounded-xl border border-[#333] text-[#888] hover:bg-[#2a2a2a] hover:text-[#e0e0e0] transition min-h-[44px] disabled:opacity-40 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CollectionDetail() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();

  const [collection, setCollection] = useState<CollectionItem | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---- data fetching ----

  const fetchData = useCallback(async () => {
    if (!collectionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getCollectionDetail(collectionId);
      setCollection(res.collection);
      setVideos(res.videos);
    } catch (err: any) {
      setError(err.message || '加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- edit ----

  const handleUpdated = useCallback((updated: CollectionItem) => {
    setCollection(updated);
    setShowEditModal(false);
  }, []);

  // ---- delete video ----

  const handleDeleteClick = useCallback((e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(videoId);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      await deleteVideo(confirmDeleteId);
      setVideos((prev) => prev.filter((v) => v.id !== confirmDeleteId));
      // Update collection video count locally
      setCollection((prev) => prev ? { ...prev, video_count: prev.video_count - 1 } : prev);
    } catch (err: any) {
      setError(err.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteId]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  // ---- card click ----

  const handleCardClick = useCallback(
    (video: VideoItem) => {
      if (video.status === 'error') return;
      navigate(`/learn/${video.id}`);
    },
    [navigate],
  );

  // ---- render ----

  const gradient = collection ? getGradient(collection.name) : GRADIENTS[0];
  const firstChar = collection ? collection.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0]">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-[#0f0f0f]/95 backdrop-blur border-b border-[#2a2a2a]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-[#2a2a2a] transition min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            >
              ←
            </button>

            {/* Collection info in header */}
            {collection && (
              <div className="flex items-center gap-3 min-w-0">
                {/* Small cover */}
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 hidden sm:block">
                  {collection.cover_path ? (
                    <img
                      src={getCoverUrl(collection.cover_path)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                      <span className="text-sm font-bold text-white/80">{firstChar}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-bold truncate">{collection.name}</h1>
                  <p className="text-xs text-[#888] hidden sm:block">
                    {collection.video_count} 个视频 · {LANG_FLAGS[collection.source_language] ?? '🌐'} {LANG_LABELS[collection.source_language] ?? collection.source_language}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {collection && (
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#333] text-[#a0a0a0] hover:text-[#e0e0e0] hover:border-[#555] transition min-h-[44px] text-sm font-medium"
              >
                <span className="text-base leading-none">✏️</span>
                <span className="hidden sm:inline">编辑</span>
              </button>
            )}
            <button
              onClick={() => navigate(`/upload?collection=${collectionId}`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px] min-w-[44px] text-sm"
            >
              <span className="text-lg leading-none">＋</span>
              <span className="hidden sm:inline">上传视频</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-[#2a1515] border border-[#e74c3c]/30 rounded-lg">
            <span className="text-[#e74c3c] shrink-0">⚠</span>
            <p className="text-sm text-[#e74c3c]">{error}</p>
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#e74c3c] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[#888]">加载中...</span>
            </div>
          </div>
        )}

        {/* ── Empty State ──────────────────────────────────── */}
        {!loading && videos.length === 0 && !error && collection && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4 opacity-30">🎬</div>
            <h3 className="text-lg font-medium text-[#a0a0a0] mb-2">还没有视频</h3>
            <p className="text-sm text-[#666] mb-6 max-w-xs">
              上传你的第一个视频到「{collection.name}」合集
            </p>
            <button
              onClick={() => navigate(`/upload?collection=${collectionId}`)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px]"
            >
              上传第一个视频
            </button>
          </div>
        )}

        {/* ── Video Grid ───────────────────────────────────── */}
        {!loading && videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video) => {
              const status = STATUS_MAP[video.status] ?? STATUS_MAP.error;
              const flag = LANG_FLAGS[video.source_language] ?? '🌐';
              const langLabel = LANG_LABELS[video.source_language] ?? video.source_language;
              const isDeleting = deletingId === video.id;
              const isClickable = video.status !== 'error';

              return (
                <div
                  key={video.id}
                  onClick={() => handleCardClick(video)}
                  className={`group relative bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden transition-all duration-200 ${
                    isClickable
                      ? 'cursor-pointer hover:border-[#e74c3c]/50 hover:shadow-lg hover:shadow-[#e74c3c]/5 hover:-translate-y-0.5'
                      : 'opacity-60 cursor-not-allowed'
                  } ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  {/* Card body */}
                  <div className="p-4 space-y-3">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium leading-snug line-clamp-2 flex-1">
                        {video.title}
                      </h3>
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteClick(e, video.id)}
                        disabled={isDeleting}
                        className="shrink-0 p-2 rounded-lg text-[#555] hover:text-[#e74c3c] hover:bg-[#2a1515] transition opacity-0 group-hover:opacity-100 focus:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Language badge */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-[#222] border border-[#333] text-[#ccc]">
                        {flag} {langLabel}
                      </span>
                      {/* Status badge */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${status.cls}`}>
                        {video.status === 'processing' && (
                          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse mr-1.5" />
                        )}
                        {status.label}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs text-[#666]">
                      <span>{formatDate(video.created_at)}</span>
                      <span>{formatFileSize(video.file_size)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Edit Collection Modal ─────────────────────────── */}
      <EditCollectionModal
        open={showEditModal}
        collection={collection}
        onClose={() => setShowEditModal(false)}
        onUpdated={handleUpdated}
      />

      {/* ── Confirm Delete Dialog ───────────────────────────── */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={handleCancelDelete}
        >
          <div
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">确认删除</h3>
            <p className="text-sm text-[#a0a0a0] mb-6">
              此操作不可撤销，视频及其字幕数据将被永久删除。
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                className="flex-1 px-4 py-3 rounded-xl border border-[#333] text-[#888] hover:bg-[#2a2a2a] hover:text-[#e0e0e0] transition min-h-[44px] font-medium"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-3 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px]"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
