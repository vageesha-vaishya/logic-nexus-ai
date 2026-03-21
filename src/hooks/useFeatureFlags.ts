import { useEffect, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';

export interface FeatureFlag {
  flag_key: string;
  is_enabled: boolean;
  description: string | null;
}

export function useFeatureFlags(keys?: string[]) {
  const { scopedDb } = useCRM();
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFlags = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const normalizedKeys = Array.isArray(keys)
          ? Array.from(new Set(keys.map((key) => String(key || '').trim()).filter(Boolean)))
          : [];
        const query = scopedDb
          .from('app_feature_flags', true)
          .select('flag_key, is_enabled, description');
        const scopedQuery = normalizedKeys.length > 0 ? query.in('flag_key', normalizedKeys) : query;

        const { data, error: queryError } = await scopedQuery;

        if (queryError) {
          throw queryError;
        }

        if (!isMounted) return;

        const mapped: Record<string, FeatureFlag> = {};
        (data || []).forEach((row: any) => {
          mapped[row.flag_key] = {
            flag_key: row.flag_key,
            is_enabled: row.is_enabled ?? false,
            description: row.description ?? null,
          };
        });

        setFlags(mapped);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || 'Failed to load feature flags');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadFlags();

    return () => {
      isMounted = false;
    };
  }, [keys, scopedDb]);

  const isEnabled = (key: string, defaultValue: boolean = false) => {
    if (keys && !keys.includes(key)) return defaultValue;
    const flag = flags[key];
    if (!flag) return defaultValue;
    return !!flag.is_enabled;
  };

  return {
    flags,
    isLoading,
    error,
    isEnabled,
  };
}
