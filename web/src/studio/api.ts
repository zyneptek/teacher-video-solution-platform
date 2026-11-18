import { serializeEvents, type DrawingEvent, type TeacherAssignment } from '@app/shared';
import { api } from '../auth/session';

// Kaydı atamaya yükler: sunucu MP4'ü üretir, sisteme (Storage + veritabanı) kaydeder ve güncel atamayı döndürür.
export async function uploadRecording(assignmentId: string, input: { audio: Blob; camera?: Blob | null; events: DrawingEvent[]; durationMs: number }): Promise<TeacherAssignment> {
  const form = new FormData();
  form.append('audio', input.audio, 'audio');
  if (input.camera) form.append('camera', input.camera, 'camera');
  form.append('events', serializeEvents(input.events));
  form.append('durationMs', String(input.durationMs));
  const { assignment } = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${assignmentId}/recording`, { method: 'POST', body: form });
  return assignment;
}
