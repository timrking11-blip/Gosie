import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { communityRequest, type CommunityItem } from '../../../lib/community/api';

export function mobileApiBase() {
  if (process.env.EXPO_PUBLIC_GOSIE_API_URL) {
    const url = new URL(process.env.EXPO_PUBLIC_GOSIE_API_URL);
    if ((!__DEV__ && url.protocol !== 'https:') || url.username || url.password) {
      throw new Error('Communities requires an HTTPS API URL without embedded credentials.');
    }
    return process.env.EXPO_PUBLIC_GOSIE_API_URL.replace(/\/$/, '');
  }
  if (Platform.OS === 'web') return '/api';
  if (__DEV__ && process.env.EXPO_PUBLIC_DOMAIN) return `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
  throw new Error('The Communities service has not been configured for this build.');
}
export const mobileCommunityRequest = <T,>(path: string, options?: RequestInit) =>
  communityRequest<T>(path, options, mobileApiBase());

export function useCommunityItems() {
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems((await mobileCommunityRequest<{ items: CommunityItem[] }>('/community/items')).items); }
    catch (e) { setItems([]); setError(e instanceof Error ? e.message : 'Communities could not load.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { items, loading, error, refresh };
}
