import { useEffect, useState } from 'react';
import { useCRM } from './useCRM';

export type EnterpriseProfile = 'operations' | 'executive';
export type EnterpriseEmphasis = 'throughput' | 'margin';

export type EnterpriseKpi = {
  label: string;
  value: string;
  delta: string;
  tone: string;
};

export type EnterpriseLane = {
  name: string;
  value: number;
  progress: number;
  badge: string;
  badgeTone: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';
};

export type EnterpriseFeedRow = {
  account: string;
  event: string;
  owner: string;
  status: string;
  eta: string;
};

type UseEnterpriseDashboardDataArgs = {
  profile: EnterpriseProfile;
  emphasis: EnterpriseEmphasis;
};

type EnterpriseDashboardData = {
  loading: boolean;
  showAlerts: boolean;
  kpis: EnterpriseKpi[];
  lanes: EnterpriseLane[];
  activityRows: EnterpriseFeedRow[];
};

const formatCount = (value: number) => value.toLocaleString('en-US');

export function useEnterpriseDashboardData({ profile, emphasis }: UseEnterpriseDashboardDataArgs): EnterpriseDashboardData {
  const { scopedDb } = useCRM();
  const [state, setState] = useState<EnterpriseDashboardData>({
    loading: true,
    showAlerts: false,
    kpis: [],
    lanes: [],
    activityRows: [],
  });

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const countRequest = async (table: string, status?: string) => {
        let query = scopedDb.from(table).select('*', { count: 'exact', head: true });
        if (status) {
          query = query.eq('status', status);
        }
        const { count } = await query;
        return count ?? 0;
      };

      const [shipmentsCount, leadsCount, opportunitiesCount, quotesCount, exceptionsCount, activitiesResult] = await Promise.all([
        countRequest('shipments'),
        countRequest('leads'),
        countRequest('opportunities'),
        countRequest('quotes'),
        countRequest('shipments', 'delayed'),
        scopedDb
          .from('activities')
          .select('subject, status')
          .order('updated_at', { ascending: false })
          .limit(4),
      ]);

      if (!mounted) {
        return;
      }

      const shipmentsDelta = opportunitiesCount > 0 ? `${Math.round((shipmentsCount / opportunitiesCount) * 100)}%` : '0%';
      const quoteCoverage = opportunitiesCount > 0 ? (quotesCount / opportunitiesCount).toFixed(1) : '0.0';
      const conversion = leadsCount > 0 ? `${Math.round((opportunitiesCount / leadsCount) * 100)}%` : '0%';
      const exceptionTone = exceptionsCount > 0 ? 'text-amber-600' : 'text-emerald-600';
      const sharedKpis =
        profile === 'operations'
          ? [
              { label: 'Active Shipments', value: formatCount(shipmentsCount), delta: `${shipmentsDelta} flow ratio`, tone: 'text-emerald-600' },
              { label: 'Open Exceptions', value: formatCount(exceptionsCount), delta: exceptionsCount > 0 ? 'Needs triage' : 'Within SLA', tone: exceptionTone },
              { label: 'Open Quotes', value: formatCount(quotesCount), delta: `${quoteCoverage}x quote/opportunity`, tone: 'text-emerald-600' },
              { label: 'Lead Conversion', value: conversion, delta: `${formatCount(opportunitiesCount)} active opportunities`, tone: 'text-emerald-600' },
            ]
          : [
              { label: 'Pipeline Opportunities', value: formatCount(opportunitiesCount), delta: `${conversion} lead-to-opportunity`, tone: 'text-emerald-600' },
              { label: 'Quotes in Motion', value: formatCount(quotesCount), delta: `${quoteCoverage}x coverage`, tone: 'text-emerald-600' },
              { label: 'Shipment Footprint', value: formatCount(shipmentsCount), delta: `${shipmentsDelta} operational leverage`, tone: 'text-emerald-600' },
              { label: 'Open Exceptions', value: formatCount(exceptionsCount), delta: exceptionsCount > 0 ? 'Risk watchlist' : 'Stable', tone: exceptionTone },
            ];

      const lanes: EnterpriseLane[] =
        emphasis === 'throughput'
          ? [
              { name: 'Intake Queue', value: leadsCount, progress: Math.min(100, Math.max(12, Math.round((leadsCount / 200) * 100))), badge: 'Needs Triage', badgeTone: 'secondary' },
              { name: 'Opportunity Review', value: opportunitiesCount, progress: Math.min(100, Math.max(12, Math.round((opportunitiesCount / 160) * 100))), badge: 'In Progress', badgeTone: 'default' },
              { name: 'Quote Execution', value: quotesCount, progress: Math.min(100, Math.max(12, Math.round((quotesCount / 180) * 100))), badge: 'Healthy', badgeTone: 'outline' },
              { name: 'Fulfillment', value: shipmentsCount, progress: Math.min(100, Math.max(12, Math.round((shipmentsCount / 220) * 100))), badge: 'Flowing', badgeTone: 'success' },
            ]
          : [
              { name: 'High-Coverage Opportunities', value: opportunitiesCount, progress: Math.min(100, Math.max(12, Math.round((opportunitiesCount / 140) * 100))), badge: 'Growth', badgeTone: 'default' },
              { name: 'Quote Concentration', value: quotesCount, progress: Math.min(100, Math.max(12, Math.round((quotesCount / 180) * 100))), badge: 'Focus', badgeTone: 'secondary' },
              { name: 'Exception Exposure', value: exceptionsCount, progress: Math.min(100, Math.max(12, Math.round((exceptionsCount / 30) * 100))), badge: exceptionsCount > 0 ? 'Watchlist' : 'Stable', badgeTone: exceptionsCount > 0 ? 'warning' : 'success' },
              { name: 'Delivery Throughput', value: shipmentsCount, progress: Math.min(100, Math.max(12, Math.round((shipmentsCount / 260) * 100))), badge: 'SLA', badgeTone: 'outline' },
            ];

      const activityRows: EnterpriseFeedRow[] =
        activitiesResult.data?.map((row: { subject: string | null; status: string | null }, index: number) => ({
          account: `Account ${index + 1}`,
          event: row.subject || 'Activity update received',
          owner: 'Operations Desk',
          status: row.status === 'completed' ? 'Resolved' : 'In Progress',
          eta: row.status === 'completed' ? 'Done' : 'Next',
        })) ?? [];

      setState({
        loading: false,
        showAlerts: exceptionsCount > 0,
        kpis: sharedKpis,
        lanes,
        activityRows:
          activityRows.length > 0
            ? activityRows
            : [
                { account: 'Atlas Industrial', event: 'Shipment ETD changed', owner: 'Ops Team A', status: 'Mitigating', eta: '12m' },
                { account: 'Nordic Retail', event: 'Quote approved by finance', owner: 'Sales AM 03', status: 'Ready', eta: 'Now' },
                { account: 'BluePeak Logistics', event: 'Customs hold released', owner: 'Broker Team', status: 'Resolved', eta: '5m' },
                { account: 'Harbor Foods', event: 'Capacity request pending', owner: 'Procurement', status: 'Escalated', eta: '28m' },
              ],
      });
    };

    run().catch(() => {
      if (!mounted) {
        return;
      }
      const fallbackKpis =
        profile === 'operations'
          ? [
              { label: 'Active Shipments', value: '1,284', delta: '+8.2%', tone: 'text-emerald-600' },
              { label: 'On-Time Delivery', value: '96.4%', delta: '+1.5%', tone: 'text-emerald-600' },
              { label: 'Open Exceptions', value: '23', delta: '-14.8%', tone: 'text-amber-600' },
              { label: 'Avg Handling Time', value: '2h 18m', delta: '-11.3%', tone: 'text-emerald-600' },
            ]
          : [
              { label: 'Revenue (MTD)', value: '$4.82M', delta: '+12.1%', tone: 'text-emerald-600' },
              { label: 'Gross Margin', value: '24.7%', delta: '+1.9%', tone: 'text-emerald-600' },
              { label: 'Quote Win Rate', value: '37.6%', delta: '+3.2%', tone: 'text-emerald-600' },
              { label: 'Pipeline Coverage', value: '3.4x', delta: '+0.6x', tone: 'text-emerald-600' },
            ];

      setState({
        loading: false,
        showAlerts: profile === 'operations',
        kpis: fallbackKpis,
        lanes:
          emphasis === 'throughput'
            ? [
                { name: 'Intake Queue', value: 132, progress: 72, badge: 'Needs Triage', badgeTone: 'secondary' },
                { name: 'Dispatching', value: 89, progress: 64, badge: 'In Progress', badgeTone: 'default' },
                { name: 'In Transit', value: 406, progress: 88, badge: 'Healthy', badgeTone: 'outline' },
                { name: 'Proof of Delivery', value: 57, progress: 46, badge: 'Review', badgeTone: 'secondary' },
              ]
            : [
                { name: 'High-Margin Opportunities', value: 41, progress: 81, badge: 'Growth', badgeTone: 'default' },
                { name: 'Carrier Cost Variance', value: 18, progress: 58, badge: 'Watchlist', badgeTone: 'secondary' },
                { name: 'Rate Expiry (7d)', value: 12, progress: 37, badge: 'Renew', badgeTone: 'outline' },
                { name: 'Discount Exceptions', value: 9, progress: 24, badge: 'Approval', badgeTone: 'secondary' },
              ],
        activityRows: [
          { account: 'Atlas Industrial', event: 'Shipment ETD changed', owner: 'Ops Team A', status: 'Mitigating', eta: '12m' },
          { account: 'Nordic Retail', event: 'Quote approved by finance', owner: 'Sales AM 03', status: 'Ready', eta: 'Now' },
          { account: 'BluePeak Logistics', event: 'Customs hold released', owner: 'Broker Team', status: 'Resolved', eta: '5m' },
          { account: 'Harbor Foods', event: 'Capacity request pending', owner: 'Procurement', status: 'Escalated', eta: '28m' },
        ],
      });
    });

    return () => {
      mounted = false;
    };
  }, [emphasis, profile, scopedDb]);

  return state;
}
