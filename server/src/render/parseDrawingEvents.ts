// İstemciden gelen çizim günlüğünü doğrular. Geçersiz veri renderer'a ulaşmadan reddedilir.
import type { DrawingEvent, StrokePoint } from '@app/shared';

const MAX_EVENTS = 5000;
const MAX_POINTS = 200_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseDrawingEvents(value: unknown): DrawingEvent[] | null {
  if (!Array.isArray(value) || value.length > MAX_EVENTS) return null;

  const events: DrawingEvent[] = [];
  let totalPoints = 0;
  let lastTime = 0; // zaman damgaları geriye gitmemeli

  for (const raw of value) {
    if (!isRecord(raw)) return null;

    if (raw.type === 'stroke') {
      const { color, width, points } = raw;
      if (typeof color !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(color)) return null;
      if (!isFiniteNumber(width) || width <= 0 || width > 100) return null;
      if (!Array.isArray(points) || points.length === 0) return null;
      totalPoints += points.length;
      if (totalPoints > MAX_POINTS) return null;

      const parsed: StrokePoint[] = [];
      for (const point of points) {
        if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y) || !isFiniteNumber(point.t)) return null;
        if (point.t < lastTime) return null;
        lastTime = point.t;
        parsed.push({ x: point.x, y: point.y, t: point.t });
      }
      events.push({ type: 'stroke', color, width, points: parsed });
    } else if (raw.type === 'erase') {
      const { t, target } = raw;
      if (!isFiniteNumber(t) || t < lastTime || typeof target !== 'number' || !Number.isInteger(target)) return null;
      if (events[target]?.type !== 'stroke') return null; // yalnızca daha önce çizilmiş bir çizgi silinebilir
      lastTime = t;
      events.push({ type: 'erase', t, target });
    } else {
      return null;
    }
  }
  return events;
}
