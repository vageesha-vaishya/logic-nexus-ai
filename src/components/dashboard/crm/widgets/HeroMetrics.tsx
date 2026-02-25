import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Activity, Mail, Phone } from 'lucide-react';

export function HeroMetrics() {
  const { scopedDb } = useCRM();
  const [metrics, setMetrics] = useState({
    todayActivities: 0,
    callsMade: 0,
    emailsSent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch today's activities count
        const today = new Date().toISOString().split('T')[0];
        const { count: activitiesCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);

        const { count: callsCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'call')
          .gte('created_at', `${today}T00:00:00`);

        const { count: emailsCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'email')
          .gte('created_at', `${today}T00:00:00`);

        setMetrics({
          todayActivities: activitiesCount || 0,
          callsMade: callsCount || 0,
          emailsSent: emailsCount || 0,
        });
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [scopedDb]);

  const metricCards = [
    { label: "Today's Activities", value: metrics.todayActivities, icon: Activity, color: 'bg-blue-100 text-blue-600' },
    { label: 'Calls Made', value: metrics.callsMade, icon: Phone, color: 'bg-green-100 text-green-600' },
    { label: 'Emails Sent', value: metrics.emailsSent, icon: Mail, color: 'bg-purple-100 text-purple-600' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-32">Loading metrics...</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {metricCards.map((metric) => (
        <div key={metric.label} className={`${metric.color} rounded-lg p-4 text-center`}>
          <metric.icon className="h-6 w-6 mx-auto mb-2" />
          <div className="text-2xl font-bold mb-1">{metric.value}</div>
          <div className="text-xs font-medium">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}
