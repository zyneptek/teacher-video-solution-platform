// Sunucu adresi. iOS simülatörü Mac'in `localhost`'una erişebilir.
// Gerçek bir telefonda bilgisayarın yerel ağ adresi gerekir; örnek:
//   EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npm run dev:mobile
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
