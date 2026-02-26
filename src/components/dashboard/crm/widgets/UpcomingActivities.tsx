import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';

interface Activity {
  id: string;
  subject: string;
  type: string;
  due_date: string;
  status: string;
}

export function UpcomingActivities() {
  const { scopedDb } = useCRM();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString();
        
        const { data, error } = await scopedDb
          .from('activities')
          .select('id, subject, type, due_date, status')
          .gte('due_date', today)
          .order('due_date', { ascending: true })
          .limit(5);

        if (!error && data) {
          setActivities(data);
        }
      } catch (error) {
        console.error('Failed to fetch upcoming activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.length > 0 ? activities.map((activity) => (
        <div key={activity.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${activity.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
              {activity.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </div>
            <div>
              <p className="font-medium text-gray-900">{activity.subject}</p>
              <p className="text-xs text-gray-500 capitalize">{activity.type} • Due: {new Date(activity.due_date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )) : (
        <p className="text-center py-4 text-gray-500">No upcoming activities</p>
      )}
    </div>
  );
}
