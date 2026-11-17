import type { DrawingEvent } from '@app/shared';

export type RenderInput = { image: File; audio: Blob; events: DrawingEvent[]; durationMs: number };

// GEÇİCİ: geliştirme uç noktasına yükler, sunucunun ürettiği MP4'ü döndürür.
export async function renderOnServer(input: RenderInput): Promise<{ video: Blob; renderMs: number }> {
  const form = new FormData();
  form.append('image', input.image);
  form.append('audio', input.audio, 'audio');
  form.append('events', JSON.stringify(input.events));
  form.append('durationMs', String(input.durationMs));

  const response = await fetch('/api/dev/render', { method: 'POST', body: form });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Sunucu hatası (${response.status})`);
  }
  return { video: await response.blob(), renderMs: Number(response.headers.get('X-Render-Ms') ?? 0) };
}
