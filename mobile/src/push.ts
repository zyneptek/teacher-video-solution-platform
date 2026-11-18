// Push bildirimi: izin istenir, Expo push jetonu alınır ve sunucuya kaydedilir. Gerçek cihazda çalışır;
// simülatörde veya proje kimliği (EAS projectId) yoksa sessizce atlanır. Bildirime tıklanınca ilgili soruya gidilir (App.tsx).
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Genel', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await api('/api/push-token', { method: 'POST', body: { token } });
  } catch {
    // simülatör, izin yok veya proje kimliği yok: push olmadan devam
  }
}
