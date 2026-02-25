import React from 'react';
import { Route, Zap, Clock, Target } from 'lucide-react';

export function RouteEfficiency() {
  const routeMetrics = [
    {
      route: 'RT-001',
      distance: '45.2 mi',
      time: '3h 45m',
      stops: '8',
      efficiency: 92,
      fuelUsed: '8.1 gal',
    },
    {
      route: 'RT-002',
      distance: '38.5 mi',
      time: '3h 20m',
      stops: '6',
      efficiency: 85,
      fuelUsed: '7.2 gal',
    },
    {
      route: 'RT-003',
      distance: '52.1 mi',
      time: '4h 10m',
      stops: '9',
      efficiency: 88,
      fuelUsed: '9.8 gal',
    },
    {
      route: 'RT-004',
      distance: '41.8 mi',
      time: '3h 35m',
      stops: '7',
      efficiency: 91,
      fuelUsed: '7.9 gal',
    },
  ];

  const avgEfficiency = Math.round(routeMetrics.reduce((sum, r) => sum + r.efficiency, 0) / routeMetrics.length);
  const totalDistance = routeMetrics.reduce((sum, r) => sum + parseFloat(r.distance), 0);
  const totalFuel = routeMetrics.reduce((sum, r) => sum + parseFloat(r.fuelUsed), 0);

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'bg-green-100 text-green-800';
    if (efficiency >= 85) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Route className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Route Efficiency</h4>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-gray-600">Avg Efficiency</p>
          <p className="text-2xl font-bold text-blue-700">{avgEfficiency}%</p>
        </div>
        <div className="p-3 bg-green-50 rounded border border-green-200">
          <p className="text-xs text-gray-600">Total Distance</p>
          <p className="text-2xl font-bold text-green-700">{totalDistance.toFixed(1)}</p>
          <p className="text-xs text-green-600">miles</p>
        </div>
        <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
          <p className="text-xs text-gray-600">Fuel Used</p>
          <p className="text-2xl font-bold text-yellow-700">{totalFuel.toFixed(1)}</p>
          <p className="text-xs text-yellow-600">gallons</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {routeMetrics.map((route, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <p className="font-medium text-gray-900">{route.route}</p>
              <span className={`text-xs font-medium px-2 py-1 rounded ${getEfficiencyColor(route.efficiency)}`}>
                {route.efficiency}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                <span>{route.distance}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{route.time}</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>{route.fuelUsed}</span>
              </div>
              <span>{route.stops} stops</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
