import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Activity, PhoneCall, Mail } from 'lucide-react';

interface Metrics {
  todayActivities: number;
  callsMade: number;
  emailsSent: number;
}

export function HeroMetrics() {
  const { scopedDb } = useCRM();
  const [metrics, setMetrics] = useState<Metrics>({
    todayActivities: 0,
    callsMade: 0,
    emailsSent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.toISOString();

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayEnd = tomorrow.toISOString();

        // Fetch today's activities
        const { count: activitiesCount, error: activitiesError } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd);

        // Fetch calls made today
        const { count: callsCount, error: callsError } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'call')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd);

        // Fetch emails sent today
        const { count: emailsCount, error: emailsError } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'email')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd);

        if (!activitiesError && !callsError && !emailsError) {
          setMetrics({
            todayActivities: activitiesCount || 0,
            callsMade: callsCount || 0,
            emailsSent: emailsCount || 0,
          });
        } else {
          console.error('Failed to fetch metrics:', {
            activitiesError,
            callsError,
            emailsError,
          });
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4 p-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-600 text-sm font-medium">Today's Activities</h3>
          <Activity className="w-4 h-4 text-blue-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{metrics.todayActivities}</p>
        <p className="text-xs text-gray-500 mt-2">Activities logged today</p>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-600 text-sm font-medium">Calls Made</h3>
          <PhoneCall className="w-4 h-4 text-green-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{metrics.callsMade}</p>
        <p className="text-xs text-gray-500 mt-2">Calls made today</p>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-600 text-sm font-medium">Emails Sent</h3>
          <Mail className="w-4 h-4 text-purple-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{metrics.emailsSent}</p>
        <p className="text-xs text-gray-500 mt-2">Emails sent today</p>
      </div>
    </div>
  );
}
