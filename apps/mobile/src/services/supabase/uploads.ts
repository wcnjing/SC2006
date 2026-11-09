import { ServiceError } from '@/services/types';

import { supabase } from '@/lib/supabase';

export const ACTIVITY_IMAGES_BUCKET = 'activity-images';

export type ActivityImageFile = {
  uri: string;
  path?: string;
};

export async function uploadImage(
  bucket: 'chat-images' | 'community-images' | typeof ACTIVITY_IMAGES_BUCKET,
  userId: string,
  localUri: string,
): Promise<string> {
  if (!supabase) return localUri;
  try {
    const response = await fetch(localUri);
    if (!response.ok) throw new Error(`Unable to read image: ${response.status}`);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const extension = contentType.split('/')[1]?.split(';')[0] ?? 'jpg';
    const data = await response.arrayBuffer();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, data, { contentType, upsert: false });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } catch {
    throw new ServiceError('UPLOAD_FAILED');
  }
}

const extensionFor = (uri: string) => {
  const extension = uri.split('.').pop()?.split(/[?#]/)[0]?.toLowerCase();
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg';
};

const imagePath = (userId: string, activityId: string, index: number, extension: string) =>
  `${userId}/${activityId}/${String(index).padStart(4, '0')}-${Math.random().toString(36).slice(2)}.${extension}`;

const pendingImagePath = (userId: string, activityId: string, extension: string) =>
  `${userId}/${activityId}/pending-${Math.random().toString(36).slice(2)}.${extension}`;

export async function listActivityImages(
  userId: string | null | undefined,
  activityId: string,
): Promise<ActivityImageFile[]> {
  if (!supabase || !userId) return [];
  const storage = supabase.storage.from(ACTIVITY_IMAGES_BUCKET);
  const folder = `${userId}/${activityId}`;
  const { data, error } = await storage.list(folder, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new ServiceError('UPLOAD_FAILED');
  return (data ?? []).map((file) => {
    const path = `${folder}/${file.name}`;
    return {
      path,
      uri: storage.getPublicUrl(path).data.publicUrl,
    };
  });
}

export async function saveActivityImages(
  userId: string,
  activityId: string,
  images: ActivityImageFile[],
): Promise<string[]> {
  if (!supabase) return images.map((image) => image.uri);
  const storage = supabase.storage.from(ACTIVITY_IMAGES_BUCKET);
  const existing = await listActivityImages(userId, activityId);
  const retained = new Set(images.map((image) => image.path).filter(Boolean));
  const removed = existing
    .map((image) => image.path)
    .filter((path): path is string => !!path && !retained.has(path));
  if (removed.length) {
    const { error } = await storage.remove(removed);
    if (error) throw new ServiceError('UPLOAD_FAILED');
  }

  const paths: string[] = [];
  for (const image of images) {
    if (image.path) {
      paths.push(image.path);
      continue;
    }
    const response = await fetch(image.uri);
    if (!response.ok) throw new ServiceError('UPLOAD_FAILED');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const path = pendingImagePath(userId, activityId, extensionFor(image.uri));
    const { error } = await storage.upload(path, await response.arrayBuffer(), {
      contentType,
      upsert: false,
    });
    if (error) throw new ServiceError('UPLOAD_FAILED');
    paths.push(path);
  }

  const moves = paths
    .map((path, index) => ({ path, index }))
    .filter(
      ({ path, index }) =>
        !path
          .split('/')
          .pop()
          ?.startsWith(`${String(index).padStart(4, '0')}-`),
    );
  for (const [moveIndex, move] of moves.entries()) {
    const temporary = `${move.path}.reordering-${moveIndex}`;
    const first = await storage.move(move.path, temporary);
    if (first.error) throw new ServiceError('UPLOAD_FAILED');
    const extension = move.path.split('.').pop() ?? 'jpg';
    const finalPath = imagePath(userId, activityId, move.index, extension);
    const second = await storage.move(temporary, finalPath);
    if (second.error) throw new ServiceError('UPLOAD_FAILED');
    paths[paths.indexOf(move.path)] = finalPath;
  }

  return paths.map((path) => storage.getPublicUrl(path).data.publicUrl);
}
