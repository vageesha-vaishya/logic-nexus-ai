import React from 'react';
import { BarChart3, Zap, TrendingUp, AlertCircle } from 'lucide-react';

export function DailyOperationsSummary() {
  const operationsData = {
    shipmentsProcessed: 156,
    shipmentsDelivered: 142,
    onTimeRate: 94,
    routesActive: 12,
    driversActive: 18,
    vehiclesActive: 16,
  };

  const hourlyData = [
    { hour: '08:00', processed: 12, delivered: 8 },
    { hour: '10:00', processed: 18, delivered: 16 },
    { hour: '12:00', processed: 24, delivered: 22 },
    { hour: '14:00', processed: 32, delivered: 28 },
    { hour: '16:00', processed: 28, delivered: 26 },
    { hour: '18:00', processed: 20, delivered: 18 },
  ];

  const maxValue = 35;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Daily Operations Summary</h4>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-gray-600">Processed Today</p>
          <p className="text-2xl font-bold text-blue-700">{operationsData.shipmentsProcessed}</p>
          <p className="text-xs text-blue-600">shipments</p>
        </div>
        <div className="p-3 bg-green-50 rounded border border-green-200">
          <p className="text-xs text-gray-600">Delivered</p>
          <p className="text-2xl font-bold text-green-700">{operationsData.shipmentsDelivered}</p>
          <p className="text-xs text-green-600">{operationsData.onTimeRate}% on-time</p>
        </div>
        <div className="p-3 bg-purple-50 rounded border border-purple-200">
          <p className="text-xs text-gray-600">Active Routes</p>
          <p className="text-2xl font-bold text-purple-700">{operationsData.routesActive}</p>
          <p className="text-xs text-purple-600">{operationsData.vehiclesActive} vehicles</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-900 mb-3">Hourly Activity</p>
        <div className="space-y-2">
          {hourlyData.map((hour, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{hour.hour}</span>
                <span className="font-medium">{hour.processed} processed</span>
              </div>
              <div className="flex gap-1 h-6">
                <div
                  className="bg-blue-500 rounded"
                  style={{ width: `${(hour.processed / maxValue) * 100}%` }}
                  title={`Processed: ${hour.processed}`}
                ></div>
                <div
                  className="bg-green-500 rounded"
                  style={{ width: `${(hour.delivered / maxValue) * 100}%` }}
                  title={`Delivered: ${hour.delivered}`}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-yellow-900">Peak hours approaching at 2-4 PM</p>
          <p className="text-xs text-yellow-700 mt-1">Ensure adequate resources are available</p>
        </div>
      </div>
    </div>
  );
}
