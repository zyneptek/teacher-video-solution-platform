// Yönetici: video onaya gönderildikten sonra öğretmen tarafından yeniden yüklendiyse (düzenleme, geri alma, yeniden çekme) veya
// silindiyse videonun üstünde görünen etiket. Eski çapraz kontrol bildirimine tıklayıp gelen yöneticinin kafası karışmasın:
// eski değerlendirmeler silinmiştir ve video artık o değerlendirmelerin verildiği video değildir.
import type { AssignmentInfo } from '@app/shared';

export function VideoReplacedNote({ assignment: a }: { assignment: Pick<AssignmentInfo, 'teacherName' | 'videoReplacedAt' | 'recording'> }) {
  if (!a.videoReplacedAt) return null;
  const when = new Date(a.videoReplacedAt).toLocaleString('tr-TR');
  return (
    <div className="replaced-note" data-testid="video-replaced">
      Video {a.teacherName} tarafından {a.recording ? 'yeniden yüklendi' : 'silindi'} · {when}
    </div>
  );
}
