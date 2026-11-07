import { ServiceError } from '@/services/types';

import { supabase } from '@/lib/supabase';

export async function uploadImage(
  bucket: 'chat-images' | 'community-images',
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
