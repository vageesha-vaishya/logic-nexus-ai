import { useEffect, useState } from 'react';
import { MapPin, Calendar, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/hooks/useCRM';
import { format } from 'date-fns';

interface TrackingEvent {
  id: string;
  event_type: string;
  event_date: string;
  location_name: string | null;
  description: string | null;
  is_milestone: boolean;
}

interface TrackingTimelineProps {
  shipmentId: string;
}

export function TrackingTimeline({ shipmentId }: TrackingTimelineProps) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { supabase } = useCRM();

  useEffect(() => {
    fetchEvents();
  }, [shipmentId]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('tracking_events')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching tracking events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (eventType: string) => {
    const colors: Record<string, string> = {
      created: 'bg-blue-500',
      confirmed: 'bg-green-500',
      picked_up: 'bg-purple-500',
      in_transit: 'bg-cyan-500',
      customs_clearance: 'bg-yellow-500',
      customs_released: 'bg-teal-500',
      arrived_at_hub: 'bg-indigo-500',
      out_for_delivery: 'bg-orange-500',
      delivered: 'bg-green-600',
      delayed: 'bg-red-500',
      exception: 'bg-red-600',
      returned: 'bg-gray-500',
    };
    return colors[eventType] || 'bg-gray-400';
  };

  const formatEventType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return <div className="text-center py-8">Loading tracking information...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracking Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tracking events yet
            </div>
          ) : (
            events.map((event, index) => (
              <div key={event.id} className="relative flex gap-4">
                {index < events.length - 1 && (
                  <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
                )}
                
                <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getEventColor(event.event_type)}`}>
                  {event.is_milestone ? (
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  ) : (
                    <MapPin className="h-5 w-5 text-white" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{formatEventType(event.event_type)}</h4>
                      {event.is_milestone && (
                        <Badge variant="outline" className="text-xs">Milestone</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(event.event_date), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                  
                  {event.location_name && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {event.location_name}
                    </div>
                  )}
                  
                  {event.description && (
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}