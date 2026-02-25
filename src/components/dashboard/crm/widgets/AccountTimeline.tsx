import React from 'react';
import { Calendar, PhoneCall, Mail, FileText, User } from 'lucide-react';

export function AccountTimeline() {
  // Mock timeline data for demonstration
  const timeline = [
    { date: '2 days ago', activity: 'Call with Acme Corp', type: 'call', contact: 'John Smith' },
    { date: '4 days ago', activity: 'Proposal sent to Global Enterprises', type: 'proposal', contact: 'Sarah Chen' },
    { date: '1 week ago', activity: 'Email follow-up sent', type: 'email', contact: 'Mike Johnson' },
    { date: '2 weeks ago', activity: 'Contract signed with Innovation Labs', type: 'file', contact: 'Lisa Brown' },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <PhoneCall className="h-4 w-4 text-green-600" />;
      case 'email':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'proposal':
        return <FileText className="h-4 w-4 text-purple-600" />;
      case 'file':
        return <FileText className="h-4 w-4 text-orange-600" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-amber-600" />
        <h4 className="font-semibold text-gray-900">Recent Activities</h4>
      </div>
      <div className="space-y-3">
        {timeline.map((item, idx) => (
          <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex-shrink-0 mt-1">
              {getIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.activity}</p>
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
        ))}
      </div>
    </div>
  );
}
