import React from 'react';
import { BarChart3, AlertTriangle, TrendingUp } from 'lucide-react';

export function CapacityVsDemand() {
  const capacityData = [
    {
      month: 'January',
      capacity: 5000,
      demand: 3800,
      utilization: 76,
      headroom: 1200,
    },
    {
      month: 'February',
      capacity: 5000,
      demand: 4200,
      utilization: 84,
      headroom: 800,
    },
    {
      month: 'March',
      capacity: 5000,
      demand: 4500,
      utilization: 90,
      headroom: 500,
    },
    {
      month: 'April',
      capacity: 5000,
      demand: 4800,
      utilization: 96,
      headroom: 200,
    },
    {
      month: 'May',
      capacity: 6000,
      demand: 5100,
      utilization: 85,
      headroom: 900,
    },
    {
      month: 'June',
      capacity: 6500,
      demand: 5400,
      utilization: 83,
      headroom: 1100,
    },
  ];

  const currentMonth = capacityData[capacityData.length - 1];
  const maxValue = 7000;

  const getHeadroomColor = (headroom: number) => {
    if (headroom > 800) return 'bg-green-100 text-green-800';
    if (headroom > 300) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Capacity vs Demand</h4>
      </div>

      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-xs text-gray-600 mb-1">Current Utilization</p>
        <p className="text-2xl font-bold text-blue-700">{currentMonth.utilization}%</p>
        <p className="text-xs text-blue-600">
          {currentMonth.demand.toLocaleString()} / {currentMonth.capacity.toLocaleString()} units
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${(currentMonth.utilization / 100) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {capacityData.map((month, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <p className="font-medium text-gray-900 text-sm">{month.month}</p>
              <span className={`text-xs font-medium px-2 py-1 rounded ${getHeadroomColor(month.headroom)}`}>
                {month.headroom} units available
              </span>
            </div>

            <div className="space-y-1 text-xs text-gray-600 mb-2">
              <div className="flex items-center justify-between">
                <span>Capacity: {month.capacity.toLocaleString()}</span>
                <span>Demand: {month.demand.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-1 h-4 items-end">
              <div className="flex-1 flex flex-col">
                <div
                  className="bg-blue-500 rounded flex-1 relative"
                  style={{ height: `${(month.demand / maxValue) * 60}px` }}
                  title={`Demand: ${month.demand}`}
                ></div>
              </div>
              <div className="flex-1 flex flex-col">
                <div
                  className="bg-blue-300 rounded-t flex-1 relative"
                  style={{ height: `${(month.capacity / maxValue) * 60}px` }}
                  title={`Capacity: ${month.capacity}`}
                ></div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-1">Utilization: {month.utilization}%</p>
          </div>
        ))}
      </div>

      <div className="p-3 bg-yellow-50 rounded border border-yellow-200 flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-yellow-900">Capacity expansion needed</p>
          <p className="text-xs text-yellow-700 mt-1">Plan for increased fleet capacity in Q2</p>
        </div>
      </div>

      <div className="p-3 bg-green-50 rounded border border-green-200 flex items-start gap-2">
        <TrendingUp className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-green-900">Growth on track</p>
          <p className="text-xs text-green-700">Capacity expansion aligned with demand growth</p>
        </div>
      </div>
    </div>
  );
}
