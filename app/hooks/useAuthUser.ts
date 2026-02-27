'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/types';

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const supaUser = data.user;

      if (!supaUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser({
        id: supaUser.id,
        email: supaUser.email ?? '',
        name: supaUser.user_metadata?.name ?? null,
        role: supaUser.user_metadata?.role ?? 'PropertyManager',
        suite_number: supaUser.user_metadata?.suite_number ?? null,
        building_id: supaUser.user_metadata?.building_id ?? null,
      });

      setLoading(false);
    };

    load();
  }, []);

  return { user, loading };
}
