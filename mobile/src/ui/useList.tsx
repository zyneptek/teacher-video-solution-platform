// Bir listeyi okuyan ortak kanca: açılışta, aşağı çekince ve her 30 sn'de bir yenilenir.
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { RefreshControl } from 'react-native';

export function useList<T>(load: () => Promise<T>): { data: T | null; error: string | null; reload: () => Promise<void>; refreshControl: ReactElement } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi.');
    }
  }, [load]);
  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), 30_000);
    return () => clearInterval(id);
  }, [reload]);
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />;
  return { data, error, reload, refreshControl };
}
