// Henüz yapılmamış yönetici ekranları için sade bilgi sayfası (ekran yerleşimi hazır, içerik sonraki adımda).
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2>{title}</h2>
      <div className="card placeholder">
        <p>{description}</p>
        <p className="muted">Bu ekran sonraki adımda yapılacak.</p>
      </div>
    </div>
  );
}
