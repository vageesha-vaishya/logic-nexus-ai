import { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { logger } from '@/lib/logger';

// quotes.status is a free-text column, not a DB-enforced enum -- production
// data includes values (e.g. "booked") outside the hand-maintained
// QuoteStatus union in quotes-data.ts. Classify by known won/lost outcomes
// and treat everything else as active/in-flight, rather than maintaining a
// brittle allow-list that silently drops unrecognized statuses from every
// bucket (undercounting both "active" and "won").
const WON_STATUSES = new Set(['accepted', 'booked']);
const LOST_STATUSES = new Set(['rejected', 'expired', 'cancelled']);

interface SalesQuote {
  id: string;
  status: string;
  sell_price: number | null;
  created_at: string;
  accepted_at: string | null;
}

interface SalesLead {
  id: string;
  status: string | null;
  created_at: string;
}

export interface SalesActivityEvent {
  id: string;
  subject: string | null;
  activity_type: string | null;
  status: string | null;
  created_at: string;
}

function isSameMonth(dateIso: string, reference: Date): boolean {
  const d = new Date(dateIso);
  return d.getFullYear() === reference.getFullYear() && d.getMonth() === reference.getMonth();
}

export function useSalesCommandCenterData() {
  const { scopedDb, contextReady } = useCRM();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [quotes, setQuotes] = useState<SalesQuote[]>([]);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [activities, setActivities] = useState<SalesActivityEvent[]>([]);

  useEffect(() => {
    if (!contextReady) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [quotesResult, leadsResult, activitiesResult] = await Promise.all([
          scopedDb
            .from('quotes')
            .select('id, status, sell_price, created_at, accepted_at')
            .order('created_at', { ascending: false })
            .limit(500),
          scopedDb
            .from('leads')
            .select('id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(500),
          scopedDb
            .from('activities')
            .select('id, subject, activity_type, status, created_at')
            .order('created_at', { ascending: false })
            .limit(6),
        ]);

        if (cancelled) return;

        if (quotesResult.error) throw new Error(`Failed to fetch quotes: ${quotesResult.error.message}`);
        if (leadsResult.error) throw new Error(`Failed to fetch leads: ${leadsResult.error.message}`);
        if (activitiesResult.error) throw new Error(`Failed to fetch activities: ${activitiesResult.error.message}`);

        setQuotes((quotesResult.data as SalesQuote[]) || []);
        setLeads((leadsResult.data as SalesLead[]) || []);
        setActivities((activitiesResult.data as SalesActivityEvent[]) || []);
      } catch (err: any) {
        logger.error('[useSalesCommandCenterData] fetch failed', err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [contextReady, scopedDb]);

  const metrics = useMemo(() => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const wonQuotes = quotes.filter((q) => WON_STATUSES.has(q.status));
    // Revenue is recognized when a quote is won, not when the record was
    // first drafted -- use accepted_at (falling back to created_at for
    // older rows where it wasn't backfilled) rather than created_at.
    const revenueThisMonth = wonQuotes
      .filter((q) => isSameMonth(q.accepted_at || q.created_at, now))
      .reduce((sum, q) => sum + Number(q.sell_price || 0), 0);
    const revenuePrevMonth = wonQuotes
      .filter((q) => isSameMonth(q.accepted_at || q.created_at, prevMonth))
      .reduce((sum, q) => sum + Number(q.sell_price || 0), 0);
    const revenueTrendPct = revenuePrevMonth > 0 ? ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : null;

    const activeDeals = quotes.filter((q) => !WON_STATUSES.has(q.status) && !LOST_STATUSES.has(q.status)).length;

    const totalQuotes = quotes.length;
    const conversionRate = totalQuotes > 0 ? (wonQuotes.length / totalQuotes) * 100 : 0;

    const newLeadsThisMonth = leads.filter((l) => isSameMonth(l.created_at, now)).length;
    const newLeadsPrevMonth = leads.filter((l) => isSameMonth(l.created_at, prevMonth)).length;
    const newLeadsTrend = newLeadsThisMonth - newLeadsPrevMonth;

    return {
      totalRevenue: revenueThisMonth,
      revenueTrendPct,
      activeDeals,
      conversionRate,
      newLeadsThisMonth,
      newLeadsTrend,
    };
  }, [quotes, leads]);

  return { loading, error, metrics, activities };
}
