// Kaydı soruya (atamaya) yükler: sunucu MP4'ü üretir, sisteme kaydeder ve güncel atamayı döndürür.
import { File } from 'expo-file-system';
import { serializeEvents, type DrawingEvent, type TeacherAssignment } from '@app/shared';
import { api } from '../api';

export type UploadInput = {
  audioUri: string;
  cameraUris?: string[]; // kamera klipleri (kayıt sırasıyla); kamera kapalıysa boş
  events: DrawingEvent[];
  durationMs: number;
};

export async function uploadRecording(assignmentId: string, input: UploadInput): Promise<TeacherAssignment> {
  const form = new FormData();
  // Expo SDK 58'in fetch'i RN'nin eski { uri } dosya biçimini desteklemez; expo-file-system'ın File nesnesi kullanılır.
  form.append('audio', new File(input.audioUri));
  for (const uri of input.cameraUris ?? []) form.append('camera', new File(uri));
  form.append('events', serializeEvents(input.events));
  form.append('durationMs', String(input.durationMs));
  const { assignment } = await api<{ assignment: TeacherAssignment }>(`/api/teacher/assignments/${assignmentId}/recording`, { method: 'POST', form });
  return assignment;
}
