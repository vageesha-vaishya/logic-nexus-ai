import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { PhoneCall, Mail, MessageSquare, CheckCircle } from 'lucide-react';

interface ActivityStats {
  calls: number;
  emails: number;
  meetings: number;
  tasks: number;
}

export function TeamActivity() {
  const { scopedDb } = useCRM();
  const [stats, setStats] = useState<ActivityStats>({
    calls: 0,
    emails: 0,
    meetings: 0,
    tasks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        const { data, error } = await scopedDb
          .from('activities')
          .select('type, status');

        if (!error && data) {
          const counts = { calls: 0, emails: 0, meetings: 0, tasks: 0 };
          
          data.forEach((activity: any) => {
            const type = activity.type?.toLowerCase() || 'other';
            if (type.includes('call')) counts.calls++;
            else if (type.includes('email')) counts.emails++;
            else if (type.includes('meet')) counts.meetings++;
            else counts.tasks++;
          });

          setStats(counts);
        }
      } catch (error) {
        console.error('Failed to fetch team activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-2 mb-2">
          <PhoneCall className="h-5 w-5 text-green-600" />
          <span className="font-semibold text-green-900">Calls</span>
        </div>
        <p className="text-2xl font-bold text-green-800">{stats.calls}</p>
      </div>
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-blue-900">Emails</span>
        </div>
        <p className="text-2xl font-bold text-blue-800">{stats.emails}</p>
      </div>
      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-purple-600" />
          <span className="font-semibold text-purple-900">Meetings</span>
        </div>
        <p className="text-2xl font-bold text-purple-800">{stats.meetings}</p>
      </div>
      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-5 w-5 text-orange-600" />
          <span className="font-semibold text-orange-900">Tasks</span>
        </div>
        <p className="text-2xl font-bold text-orange-800">{stats.tasks}</p>
      </div>
    </div>
  );
}
