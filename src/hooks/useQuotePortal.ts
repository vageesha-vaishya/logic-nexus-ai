import { useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export interface PortalToken {
  id: string;
  quote_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  accessed_at?: string;
}

export function useQuotePortal() {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);

  const generateToken = async (quoteId: string, expiresInDays: number = 7) => {
    setLoading(true);
    try {
      // Generate a random secure token
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const { data, error } = await (supabase as any)
        .from('portal_tokens')
        .insert({
          quote_id: quoteId,
          token: token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      
      return data as PortalToken;
    } catch (error: any) {
      console.error('Error generating portal token:', error);
      toast.error('Failed to generate portal link');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getActiveTokens = async (quoteId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('portal_tokens')
        .select('*')
        .eq('quote_id', quoteId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PortalToken[];
    } catch (error) {
      console.error('Error fetching active tokens:', error);
      return [];
    }
  };

  const revokeToken = async (tokenId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('portal_tokens')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;
      toast.success('Link revoked successfully');
      return true;
    } catch (error) {
      toast.error('Failed to revoke link');
      return false;
    }
  };

  return {
    generateToken,
    getActiveTokens,
    revokeToken,
    loading
  };
}
