// Çapraz kontrol (yönetici): bir videoya diğer öğretmenlerin verdiği "Hatasız" / "Hatalı" değerlendirmeleri ve notları.
// Yalnızca güncel video için gösterilir (video değişince sunucu eski değerlendirmeleri siler). Hiç değerlendirme yoksa hiçbir şey çizilmez.
import { PEER_VERDICT_LABEL, type PeerCheckInfo } from '@app/shared';

export function PeerChecks({ checks }: { checks: PeerCheckInfo[] }) {
  if (checks.length === 0) return null;
  return (
    <div className="peer-checks" data-testid="peer-checks">
      <strong className="small">Çapraz kontrol</strong>
      <ul>
        {checks.map((c, i) => (
          <li key={i}>
            <span className={`verdict verdict-${c.verdict}`}>{PEER_VERDICT_LABEL[c.verdict]}</span> {c.checkerName}
            {c.note && <span className="muted"> — {c.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
