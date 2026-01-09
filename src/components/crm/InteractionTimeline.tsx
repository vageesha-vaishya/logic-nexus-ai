import React from 'react';
import { 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  MessageSquare,
  Plus,
  MoreVertical
} from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'status_change';
  title: string;
  description: string;
  date: string;
  user: {
    name: string;
    avatar?: string;
  };
  outcome?: string;
}

interface InteractionTimelineProps {
  activities: Activity[];
  onAddActivity?: () => void;
  className?: string;
}

const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'call': return <Phone className="h-4 w-4" />;
    case 'email': return <Mail className="h-4 w-4" />;
    case 'meeting': return <Calendar className="h-4 w-4" />;
    case 'note': return <FileText className="h-4 w-4" />;
    case 'status_change': return <CheckCircle2 className="h-4 w-4" />;
    default: return <MessageSquare className="h-4 w-4" />;
  }
};

const getActivityColor = (type: Activity['type']) => {
  switch (type) {
    case 'call': return 'bg-blue-100 text-blue-600';
    case 'email': return 'bg-yellow-100 text-yellow-600';
    case 'meeting': return 'bg-purple-100 text-purple-600';
    case 'note': return 'bg-gray-100 text-gray-600';
    case 'status_change': return 'bg-green-100 text-green-600';
    default: return 'bg-slate-100 text-slate-600';
  }
};

export function InteractionTimeline({ activities, onAddActivity, className }: InteractionTimelineProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
        <CardTitle className="text-base font-semibold">Interaction History</CardTitle>
        <Button size="sm" onClick={onAddActivity}>
          <Plus className="h-4 w-4 mr-2" />
          Log Activity
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {activities.map((activity) => (
              <div key={activity.id} className="relative flex items-start group">
                <div className={`absolute left-0 flex items-center justify-center w-10 h-10 rounded-full ring-8 ring-white ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="ml-16 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {activity.title}
                    </span>
                    <time className="text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(activity.date), 'MMM d, yyyy h:mm a')}
                    </time>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 group-hover:border-slate-200 transition-colors">
                    <p className="text-sm text-slate-600 mb-2">
                      {activity.description}
                    </p>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={activity.user.avatar} />
                          <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-slate-500">
                          {activity.user.name}
                        </span>
                      </div>
                      
                      {activity.outcome && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600">
                          {activity.outcome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open menu">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit Details</DropdownMenuItem>
                      <DropdownMenuItem>Delete Activity</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
