// --- Types :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

export interface VideoItem {
  id: string;
  title: string;
  source_language: string;
  video_filename: string;
  subtitle_filename: string;
  video_path: string;
  subtitle_path: string;
  duration: number | null;
  file_size: number;
  thumbnail_path: string | null;
  status: 'processing' | 'ready' | 'error';
  collection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubtitleLine {
  id: number;
  video_id: string;
  index_num: number;
  start_time: number;
  end_time: number;
  original_text: string;
  translated_text: string | null;
  annotation: {
    romaji: string;
    segments: Array<{
      orig: string;
      hira: string;
      roma: string;
      type: string;
    }>;
  } | null;
  status: string;
}

export interface VideoDetail {
  video: VideoItem;
  subtitles: SubtitleLine[];
}

export interface StorageInfo {
  used_bytes: number;
  total_bytes: number;
  used_gb: number;
  total_gb: number;
  usage_percent: number;
}

export interface UploadResult {
  video_id: string;
  title: string;
  status: string;
  message: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  cover_path: string | null;
  source_language: string;
  video_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionDetail {
  collection: CollectionItem;
  videos: VideoItem[];
}

// --- API Functions :::::::::::::::::::::::::::::::::::::::::::::::::::::::

const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(data.detail || `Request failed: ${resp.status}`);
  }

  return resp.json();
}

/** Upload video + subtitle files */
export async function uploadFiles(
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data.detail || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('网络错误，上传失败'));
    xhr.send(formData);
  });
}

/** List all videos */
export async function getVideos(search = '', language = ''): Promise<{ videos: VideoItem[]; total: number }> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (language) params.set('language', language);
  const qs = params.toString();
  return request(`/videos${qs ? `?${qs}` : ''}`);
}

/** Get video detail with subtitles */
export async function getVideoDetail(videoId: string): Promise<VideoDetail> {
  return request(`/videos/${videoId}`);
}

/** Delete a video */
export async function deleteVideo(videoId: string): Promise<void> {
  await request(`/videos/${videoId}`, { method: 'DELETE' });
}

/** Batch move videos to a collection (null = remove from any collection) */
export async function moveVideosToCollection(
  videoIds: string[],
  collectionId: string | null,
): Promise<{ status: string; moved: number; collection_id: string | null }> {
  return request('/videos/batch/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_ids: videoIds, collection_id: collectionId }),
  });
}

/** Get storage usage info */
export async function getStorageInfo(): Promise<StorageInfo> {
  return request('/upload/storage');
}

/** Get video file URL (served by Nginx) */
export function getVideoFileUrl(videoId: string): string {
  return `/media/${videoId}/video.mp4`;
}

// --- Collection API Functions ::::::::::::::::::::::::::::::::::::::::::::

/** List all collections */
export async function getCollections(): Promise<{ collections: CollectionItem[]; total: number }> {
  return request('/collections');
}

/** Get collection detail with videos */
export async function getCollectionDetail(collectionId: string): Promise<CollectionDetail> {
  return request(`/collections/${collectionId}`);
}

/** Create a new collection */
export async function createCollection(formData: FormData): Promise<CollectionItem> {
  const resp = await fetch(`${BASE_URL}/collections`, {
    method: 'POST',
    body: formData,
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(data.detail || `Request failed: ${resp.status}`);
  }
  return resp.json();
}

/** Update a collection */
export async function updateCollection(collectionId: string, formData: FormData): Promise<CollectionItem> {
  const resp = await fetch(`${BASE_URL}/collections/${collectionId}`, {
    method: 'PUT',
    body: formData,
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(data.detail || `Request failed: ${resp.status}`);
  }
  return resp.json();
}

/** Delete a collection */
export async function deleteCollection(collectionId: string): Promise<void> {
  await request(`/collections/${collectionId}`, { method: 'DELETE' });
}

/** Get cover image URL */
export function getCoverUrl(coverPath: string): string {
  return `/media/${coverPath}`;
}
