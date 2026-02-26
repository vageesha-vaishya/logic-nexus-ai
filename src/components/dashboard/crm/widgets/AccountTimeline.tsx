import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Calendar, PhoneCall, Mail, FileText, User } from 'lucide-react';

interface TimelineItem {
  id: string;
  date: string;
  activity: string;
  type: string;
  contact: string;
}

export function AccountTimeline() {
  const { scopedDb } = useCRM();
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        // Fetch recent activities linked to accounts
        const { data, error } = await scopedDb
          .from('activities')
          .select(`
            id, 
            subject, 
            type, 
            created_at, 
            contacts:contact_id (first_name, last_name)
          `)
          .not('account_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!error && data) {
          const items = data.map((item: any) => ({
            id: item.id,
            date: new Date(item.created_at).toLocaleDateString(),
            activity: item.subject || 'Unknown Activity',
            type: item.type || 'other',
            contact: item.contacts ? `${item.contacts.first_name} ${item.contacts.last_name}` : 'Unknown Contact',
          }));
          setTimeline(items);
        }
      } catch (error) {
        console.error('Failed to fetch account timeline:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [scopedDb]);

  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'call':
        return <PhoneCall className="h-4 w-4 text-green-600" />;
      case 'email':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'proposal':
        return <FileText className="h-4 w-4 text-purple-600" />;
      case 'meeting':
        return <Calendar className="h-4 w-4 text-amber-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-amber-600" />
          <h4 className="font-semibold text-gray-900">Recent Activities</h4>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-amber-600" />
        <h4 className="font-semibold text-gray-900">Recent Activities</h4>
      </div>
      <div className="space-y-3">
        {timeline.length > 0 ? timeline.map((item) => (
          <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex-shrink-0 mt-1">
              {getIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.activity}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{item.date}</span>
                <span className="text-xs text-gray-400">•</span>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <User className="h-3 w-3" />
                  {item.contact}
                </div>
              </div>
            </div>
          </div>
        )) : (
          <p className="text-sm text-gray-500 text-center py-4">No recent activities</p>
        )}
      </div>
    </div>
  );
}
