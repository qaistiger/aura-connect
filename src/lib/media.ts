import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "media";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type MediaKind = "photo" | "video";

export function validateMedia(file: File): { ok: true; kind: MediaKind } | { ok: false; error: string } {
  const isPhoto = PHOTO_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (!isPhoto && !isVideo) {
    return { ok: false, error: "Unsupported file type. Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV." };
  }
  if (isPhoto && file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Photos must be 10 MB or smaller." };
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: "Videos must be 100 MB or smaller." };
  }
  if (file.size === 0) return { ok: false, error: "That file appears to be empty." };
  return { ok: true, kind: isPhoto ? "photo" : "video" };
}

function safeExtension(file: File) {
  const raw = file.name.split(".").pop() ?? "";
  const ext = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext.length > 0 && ext.length <= 5 ? ext : "bin";
}

export function buildMediaPath(userId: string, file: File) {
  const id = crypto.randomUUID();
  return `${userId}/${id}.${safeExtension(file)}`;
}

const signedCache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(path: string, seconds = 3600) {
  const cached = signedCache.get(path);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) return null;
  signedCache.set(path, { url: data.signedUrl, expires: Date.now() + seconds * 1000 });
  return data.signedUrl;
}
