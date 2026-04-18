import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getVideos,
  deleteVideo,
  getStorageInfo,
  getCollections,
  getCoverUrl,
  moveVideosToCollection,
} from '../../services/api';
import type { VideoItem, StorageInfo, CollectionItem } from '../../services/api';

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

const LANGUAGE_OPTIONS = [
  { value: '', label: '全部语言' },
  { value: 'ja', label: '🇯🇵 日语' },
  { value: 'en', label: '🇺🇸 英语' },
  { value: 'zh', label: '🇨🇳 中文' },
  { value: 'ko', label: '🇰🇷 韩语' },
];

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
// Move-to-Collection Modal
// ---------------------------------------------------------------------------

interface MoveModalProps {
  open: boolean;
  count: number;
  collections: CollectionItem[];
  loadingCollections: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (collectionId: string | null) => void;
}

function MoveToCollectionModal({
  open,
  count,
  collections,
  loadingCollections,
  submitting,
  error,
  onClose,
  onConfirm,
}: MoveModalProps) {
  // `undefined` = nothing chosen, `null` = "无合集" chosen, string = collection id chosen
  const [selected, setSelected] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (open) setSelected(undefined);
  }, [open]);

  if (!open) return null;

  const canConfirm = selected !== undefined && !submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-lg font-bold">
            <span className="text-[#e74c3c]">移动</span>
            {count} 个视频到合集
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-[#2a2a2a] transition min-w-[44px] min-h-[44px] flex items-center justify-center text-[#888] hover:text-[#e0e0e0] disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {/* Options list */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5">
          {loadingCollections ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#e74c3c] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* "无合集" option */}
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={submitting}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                  selected === null
                    ? 'border-[#e74c3c] bg-[#2a1515]'
                    : 'border-[#2a2a2a] hover:border-[#444] hover:bg-[#1f1f1f]'
                } disabled:opacity-50`}
              >
                <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center shrink-0 text-xl">
                  ⊘
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">无合集</div>
                  <div className="text-xs text-[#666]">从当前合集中移除</div>
                </div>
                {selected === null && (
                  <span className="text-[#e74c3c] text-lg shrink-0">✓</span>
                )}
              </button>

              {collections.length > 0 && (
                <div className="h-px bg-[#2a2a2a] my-2" />
              )}

              {collections.map((c) => {
                const isSelected = selected === c.id;
                const gradient = getGradient(c.name);
                const firstChar = c.name.charAt(0).toUpperCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c.id)}
                    disabled={submitting}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                      isSelected
                        ? 'border-[#e74c3c] bg-[#2a1515]'
                        : 'border-[#2a2a2a] hover:border-[#444] hover:bg-[#1f1f1f]'
                    } disabled:opacity-50`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                      {c.cover_path ? (
                        <img
                          src={getCoverUrl(c.cover_path)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
                        >
                          <span className="text-sm font-bold text-white/80">
                            {firstChar}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-[#666]">
                        {c.video_count} 个视频
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[#e74c3c] text-lg shrink-0">✓</span>
                    )}
                  </button>
                );
              })}

              {collections.length === 0 && !loadingCollections && (
                <div className="py-8 text-center text-sm text-[#666]">
                  还没有合集，先去首页创建一个吧
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-[#2a1515] border border-[#e74c3c]/30 rounded-lg shrink-0">
            <span className="text-[#e74c3c] shrink-0">⚠</span>
            <p className="text-sm text-[#e74c3c]">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-xl border border-[#333] text-[#888] hover:bg-[#2a2a2a] hover:text-[#e0e0e0] transition min-h-[44px] disabled:opacity-40 font-medium"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => canConfirm && onConfirm(selected as string | null)}
            disabled={!canConfirm}
            className="flex-1 px-4 py-3 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? '移动中...' : '确认移动'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContentLibrary() {
  const navigate = useNavigate();

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ---- selection mode ----
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState('');

  // ---- data fetching ----

  const fetchData = useCallback(async (s = search, lang = language) => {
    setLoading(true);
    setError('');
    try {
      const [videosRes, storageRes] = await Promise.all([
        getVideos(s, lang),
        getStorageInfo(),
      ]);
      setVideos(videosRes.videos);
      setStorage(storageRes);
    } catch (err: any) {
      setError(err.message || '加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [search, language]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- search / filter handlers ----

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  }, []);

  // ---- delete ----

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
      // Refresh storage info
      const storageRes = await getStorageInfo();
      setStorage(storageRes);
    } catch (err: any) {
      setError(err.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteId]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  // ---- selection mode ----

  const toggleSelection = useCallback((videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectableIds = useMemo(
    () => videos.filter((v) => v.status !== 'error').map((v) => v.id),
    [videos],
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (selectableIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }, [selectableIds]);

  const openMoveModal = useCallback(async () => {
    setMoveError('');
    setShowMoveModal(true);
    setLoadingCollections(true);
    try {
      const res = await getCollections();
      setCollections(res.collections);
    } catch (err: any) {
      setMoveError(err.message || '加载合集失败');
    } finally {
      setLoadingCollections(false);
    }
  }, []);

  const handleConfirmMove = useCallback(
    async (collectionId: string | null) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      setMoving(true);
      setMoveError('');
      try {
        await moveVideosToCollection(ids, collectionId);
        setShowMoveModal(false);
        exitSelectionMode();
        await fetchData();
      } catch (err: any) {
        setMoveError(err.message || '移动失败，请重试');
      } finally {
        setMoving(false);
      }
    },
    [selectedIds, exitSelectionMode, fetchData],
  );

  // ---- card click ----

  const handleCardClick = useCallback(
    (video: VideoItem) => {
      if (selectionMode) {
        if (video.status === 'error') return;
        toggleSelection(video.id);
        return;
      }
      if (video.status === 'error') return;
      navigate(`/learn/${video.id}`);
    },
    [navigate, selectionMode, toggleSelection],
  );

  // ---- render ----

  const storagePercent = storage ? storage.usage_percent : 0;
  const storageBarColor =
    storagePercent > 90 ? 'bg-red-500' : storagePercent > 70 ? 'bg-yellow-500' : 'bg-[#e74c3c]';

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0]">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-[#0f0f0f]/95 backdrop-blur border-b border-[#2a2a2a]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-[#2a2a2a] transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              ←
            </button>
            <h1 className="text-xl font-bold">
              <span className="text-[#e74c3c]">Sub</span>Learn
              <span className="text-sm text-[#666] ml-2 font-normal">全部视频</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <button
                onClick={exitSelectionMode}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#333] text-[#a0a0a0] hover:text-[#e0e0e0] hover:border-[#555] transition min-h-[44px] text-sm font-medium"
              >
                <span className="hidden sm:inline">退出选择</span>
                <span className="sm:hidden">✕</span>
              </button>
            ) : (
              <button
                onClick={enterSelectionMode}
                disabled={videos.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#333] text-[#a0a0a0] hover:text-[#e0e0e0] hover:border-[#555] transition min-h-[44px] text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                title="批量选择"
              >
                <span className="text-base leading-none">☑</span>
                <span className="hidden sm:inline">批量选择</span>
              </button>
            )}
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px] min-w-[44px] text-sm"
            >
              <span className="text-lg leading-none">＋</span>
              <span className="hidden sm:inline">上传视频</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* ── Storage Bar ──────────────────────────────────── */}
        {storage && (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#a0a0a0]">存储空间</span>
              <span className="text-[#e0e0e0] font-medium">
                {storage.used_gb.toFixed(1)} GB / {storage.total_gb} GB 已使用
              </span>
            </div>
            <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${storageBarColor}`}
                style={{ width: `${Math.min(storagePercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Search & Filter ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-lg pointer-events-none">🔍</span>
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="搜索视频..."
              className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl pl-10 pr-4 py-3 text-[#e0e0e0] placeholder-[#555] focus:border-[#e74c3c] outline-none transition min-h-[44px]"
            />
          </div>
          <select
            value={language}
            onChange={handleLanguageChange}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[#e0e0e0] focus:border-[#e74c3c] outline-none transition min-h-[44px] min-w-[140px] cursor-pointer"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

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
        {!loading && videos.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4 opacity-30">📚</div>
            <h3 className="text-lg font-medium text-[#a0a0a0] mb-2">还没有视频</h3>
            <p className="text-sm text-[#666] mb-6 max-w-xs">
              上传你的第一个视频和字幕，开始沉浸式语言学习之旅
            </p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px]"
            >
              上传第一个视频
            </Link>
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
              const isErrored = video.status === 'error';
              const isSelected = selectedIds.has(video.id);
              const isClickable = !isErrored;

              return (
                <div
                  key={video.id}
                  onClick={() => handleCardClick(video)}
                  className={`group relative bg-[#181818] border rounded-xl overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? 'border-[#e74c3c] shadow-lg shadow-[#e74c3c]/10'
                      : 'border-[#2a2a2a]'
                  } ${
                    isClickable
                      ? 'cursor-pointer hover:border-[#e74c3c]/50 hover:shadow-lg hover:shadow-[#e74c3c]/5 hover:-translate-y-0.5'
                      : 'opacity-60 cursor-not-allowed'
                  } ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  {selectionMode && isClickable && (
                    <div
                      className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center pointer-events-none ${
                        isSelected
                          ? 'bg-[#e74c3c] border-[#e74c3c]'
                          : 'bg-[#0f0f0f]/70 border-[#555]'
                      }`}
                    >
                      {isSelected && (
                        <span className="text-white text-sm leading-none">✓</span>
                      )}
                    </div>
                  )}
                  {/* Card body */}
                  <div className="p-4 space-y-3">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm font-medium leading-snug line-clamp-2 flex-1 ${selectionMode && isClickable ? 'pl-8' : ''}`}>
                        {video.title}
                      </h3>
                      {/* Delete button (hidden in selection mode) */}
                      {!selectionMode && (
                        <button
                          onClick={(e) => handleDeleteClick(e, video.id)}
                          disabled={isDeleting}
                          className="shrink-0 p-2 rounded-lg text-[#555] hover:text-[#e74c3c] hover:bg-[#2a1515] transition opacity-0 group-hover:opacity-100 focus:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="删除"
                        >
                          🗑️
                        </button>
                      )}
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

      {/* ── Selection Action Bar ────────────────────────────── */}
      {selectionMode && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-[#181818]/95 backdrop-blur border-t border-[#2a2a2a] shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              disabled={selectableIds.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#333] text-[#a0a0a0] hover:text-[#e0e0e0] hover:border-[#555] transition min-h-[44px] text-sm font-medium disabled:opacity-40"
            >
              {allSelected ? '取消全选' : '全选'}
            </button>
            <div className="flex-1 text-sm text-[#a0a0a0]">
              已选 <span className="text-[#e0e0e0] font-medium">{selectedIds.size}</span> 个视频
            </div>
            <button
              onClick={openMoveModal}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e74c3c] text-white font-medium hover:bg-[#c0392b] transition min-h-[44px] text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-base leading-none">📂</span>
              <span className="hidden sm:inline">移动到合集</span>
              <span className="sm:hidden">移动</span>
            </button>
          </div>
        </div>
      )}

      {/* Spacer so fixed action bar doesn't cover last row */}
      {selectionMode && <div className="h-20" />}

      {/* ── Move to Collection Modal ───────────────────────── */}
      <MoveToCollectionModal
        open={showMoveModal}
        count={selectedIds.size}
        collections={collections}
        loadingCollections={loadingCollections}
        submitting={moving}
        error={moveError}
        onClose={() => !moving && setShowMoveModal(false)}
        onConfirm={handleConfirmMove}
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
