// Ortam değişkenlerini server/.env dosyasından yükler ve doğrular.
// Değerler sunucu dışına çıkmaz; hiçbir yerde loglanmaz.

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // .env yoksa (örneğin ortam değişkenleri dışarıdan verildiyse) devam et.
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} tanımlı değil. server/.env dosyasını kontrol et.`);
  }
  return value;
}

// Supabase panelinde adresin sonuna /rest/v1/ gibi bir ek gelebilir.
// Yalnızca ana adresi (https://....supabase.co) alırız.
function supabaseOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error('SUPABASE_URL geçerli bir adres değil. server/.env dosyasını kontrol et.');
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: supabaseOrigin(required('SUPABASE_URL')),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  databaseUrl: required('DATABASE_URL'),
};
