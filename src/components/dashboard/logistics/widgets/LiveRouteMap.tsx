import React from 'react';
import { MapPin, Navigation, Clock } from 'lucide-react';

export function LiveRouteMap() {
  const routes = [
    {
      id: 'RT-001',
      driver: 'John Smith',
      status: 'In Progress',
      stops: 8,
      completedStops: 5,
      nextStop: 'Downtown Distribution Center',
      eta: '2:45 PM',
      distance: '12.5 km',
    },
    {
      id: 'RT-002',
      driver: 'Maria Garcia',
      status: 'In Progress',
      stops: 6,
      completedStops: 3,
      nextStop: 'West Mall Branch',
      eta: '3:15 PM',
      distance: '8.2 km',
    },
    {
      id: 'RT-003',
      driver: 'David Chen',
      status: 'Planning',
      stops: 7,
      completedStops: 0,
      nextStop: 'East Terminal Hub',
      eta: '4:00 PM',
      distance: '15.3 km',
    },
    {
      id: 'RT-004',
      driver: 'Sarah Wilson',
      status: 'Completed',
      stops: 9,
      completedStops: 9,
      nextStop: 'N/A',
      eta: '2:20 PM',
      distance: '20.1 km',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Planning':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Active Routes (4)</h4>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {routes.map((route) => (
          <div key={route.id} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{route.driver}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(route.status)}`}>
                    {route.status}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{route.id}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-green-600" />
                <span>{route.nextStop}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span>ETA: {route.eta}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{route.distance}</span>
                <span>{route.completedStops}/{route.stops} stops</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${(route.completedStops / route.stops) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
