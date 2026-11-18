import type { DrawingEvent } from '@app/shared';

export type RenderInput = { image: File; audio: Blob; camera?: Blob | null; events: DrawingEvent[]; durationMs: number };

// GEÇİCİ: geliştirme uç noktasına yükler; sunucunun ürettiği MP4'ün adresini döndürür.
export async function renderOnServer(input: RenderInput): Promise<{ videoUrl: string; sizeKb: number; renderMs: number }> {
  const form = new FormData();
  form.append('image', input.image);
  form.append('audio', input.audio, 'audio');
  if (input.camera) form.append('camera', input.camera, 'camera');
  form.append('events', JSON.stringify(input.events));
  form.append('durationMs', String(input.durationMs));

  const response = await fetch('/api/dev/render', { method: 'POST', body: form });
  const body = (await response.json().catch(() => null)) as { id?: string; renderMs?: number; sizeBytes?: number; error?: string } | null;
  if (!response.ok || !body?.id) throw new Error(body?.error ?? `Sunucu hatası (${response.status})`);
  return {
    videoUrl: `/api/dev/video/${body.id}`,
    sizeKb: Math.round((body.sizeBytes ?? 0) / 1024),
    renderMs: body.renderMs ?? 0,
  };
}
