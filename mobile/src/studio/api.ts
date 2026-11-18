import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import type { DrawingEvent } from '@app/shared';
import { API_URL } from '../config';

export type RenderInput = {
  imageModule: number; // require(...) ile paketlenmiş soru görseli (geçici; sonra sunucudan gelecek)
  audioUri: string;
  cameraUris?: string[]; // kamera klipleri (kayıt sırasıyla); kamera kapalıysa boş
  events: DrawingEvent[];
  durationMs: number;
};

// GEÇİCİ: geliştirme uç noktasına yükler; sunucunun ürettiği MP4'ün adresini döndürür.
export async function renderOnServer(input: RenderInput): Promise<{ videoUrl: string; sizeKb: number; renderMs: number }> {
  const asset = Asset.fromModule(input.imageModule);
  await asset.downloadAsync();
  const imageUri = asset.localUri ?? asset.uri;

  const form = new FormData();
  // Expo SDK 58'in fetch'i RN'nin eski { uri } dosya biçimini desteklemez; expo-file-system'ın File nesnesi kullanılır.
  form.append('image', new File(imageUri));
  form.append('audio', new File(input.audioUri));
  for (const uri of input.cameraUris ?? []) form.append('camera', new File(uri));
  form.append('events', JSON.stringify(input.events));
  form.append('durationMs', String(input.durationMs));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${API_URL}/api/dev/render`, { method: 'POST', body: form, signal: controller.signal });
    const body = (await response.json().catch(() => null)) as { id?: string; renderMs?: number; sizeBytes?: number; error?: string } | null;
    if (!response.ok || !body?.id) throw new Error(body?.error ?? `Sunucu hatası (${response.status})`);
    return {
      videoUrl: `${API_URL}/api/dev/video/${body.id}`,
      sizeKb: Math.round((body.sizeBytes ?? 0) / 1024),
      renderMs: body.renderMs ?? 0,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Sunucu zaman aşımına uğradı.');
    if (err instanceof TypeError) throw new Error('Sunucuya ulaşılamadı. Sunucunun çalıştığından ve adresin doğru olduğundan emin olun.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
