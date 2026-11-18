// Mobil uygulama (öğretmen): giriş → ana sayfa (sorular, bildirimler) → soru → kayıt stüdyosu / kırpma / hata bildirimi.
// Yönetici mobil uygulamaya girmez (web panelini kullanır). Ekranlar basit bir yığınla (src/nav.ts) yönetilir.
import * as Notifications from 'expo-notifications';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { TeacherAssignment } from '@app/shared';
import { api } from './src/api';
import type { Nav, Route } from './src/nav';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { QuestionScreen } from './src/screens/QuestionScreen';
import { RecordRoute } from './src/screens/RecordRoute';
import { ReportScreen } from './src/screens/ReportScreen';
import { TrimScreen } from './src/screens/TrimScreen';
import { SessionProvider, useSession } from './src/session';
import { colors } from './src/theme';

function Root() {
  const { ready, user } = useSession();
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600;
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [homeKey, setHomeKey] = useState(0); // ana sayfaya dönünce listeyi yenilemek için
  const route = stack[stack.length - 1] as Route;

  const nav: Nav = {
    push: (r) => setStack((s) => [...s, r]),
    pop: () =>
      setStack((s) => {
        setHomeKey((k) => k + 1);
        return s.length > 1 ? s.slice(0, -1) : s;
      }),
    reset: (r) => setStack([r]),
  };
  const navRef = useRef(nav);
  navRef.current = nav;

  // Ekran yönü: telefonda yalnızca kayıt stüdyosu yataydır, diğer ekranlar dikeydir; tablette serbesttir.
  useEffect(() => {
    if (isTablet) {
      void ScreenOrientation.unlockAsync();
      return;
    }
    if (route.name === 'record') return; // stüdyo kendi kilidini uygular
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
  }, [isTablet, route.name]);

  // Çıkış yapılınca yığın sıfırlanır.
  useEffect(() => {
    if (!user) setStack([{ name: 'home' }]);
  }, [user]);

  // Push bildirimine tıklanınca ilgili soruya gidilir.
  useEffect(() => {
    if (!user) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = (response.notification.request.content.data as { assignmentId?: string } | undefined)?.assignmentId;
      if (id) navRef.current.push({ name: 'question', id });
    });
    return () => sub.remove();
  }, [user]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (!user) return <LoginScreen />;

  switch (route.name) {
    case 'question':
      return <QuestionScreen key={`q-${route.id}-${homeKey}`} id={route.id} nav={nav} />;
    case 'record':
      return <RecordRoute id={route.id} nav={nav} />;
    case 'trim':
      return <TrimScreen id={route.id} nav={nav} />;
    case 'report':
      return <ReportScreen id={route.id} nav={nav} />;
    default:
      return <HomeScreen nav={nav} refreshKey={homeKey} />;
  }
}


export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
        <StatusBar style="auto" />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
