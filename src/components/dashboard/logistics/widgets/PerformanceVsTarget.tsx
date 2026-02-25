import React from 'react';
import { Target, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

export function PerformanceVsTarget() {
  const kpis = [
    {
      metric: 'On-Time Delivery Rate',
      actual: 94,
      target: 95,
      unit: '%',
      status: 'Close',
      trend: 2,
    },
    {
      metric: 'Fleet Utilization',
      actual: 85,
      target: 80,
      unit: '%',
      status: 'Exceeding',
      trend: 3,
    },
    {
      metric: 'Cost per Delivery',
      actual: 12.5,
      target: 12.0,
      unit: '$',
      status: 'Slight Over',
      trend: -5,
    },
    {
      metric: 'Shipments per Vehicle',
      actual: 9.8,
      target: 9.5,
      unit: 'count',
      status: 'Exceeding',
      trend: 1.2,
    },
    {
      metric: 'Driver Safety Score',
      actual: 96,
      target: 95,
      unit: '%',
      status: 'Exceeding',
      trend: 2,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Exceeding':
        return 'bg-green-100 text-green-800';
      case 'Close':
        return 'bg-yellow-100 text-yellow-800';
      case 'Slight Over':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Exceeding':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Performance vs Target</h4>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {kpis.map((kpi, idx) => {
          const percentOfTarget = (kpi.actual / kpi.target) * 100;
          const isMeetsTarget = kpi.actual >= kpi.target;

          return (
            <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{kpi.metric}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 ${getStatusColor(kpi.status)}`}>
                  {getStatusIcon(kpi.status)}
                  {kpi.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2 text-sm">
                <div className="p-2 bg-white rounded border border-gray-200">
                  <p className="text-xs text-gray-600">Actual</p>
                  <p className="font-semibold text-gray-900">
                    {kpi.actual}
                    <span className="text-xs text-gray-600 ml-1">{kpi.unit}</span>
                  </p>
                </div>
                <div className="p-2 bg-white rounded border border-gray-200">
                  <p className="text-xs text-gray-600">Target</p>
                  <p className="font-semibold text-gray-900">
                    {kpi.target}
                    <span className="text-xs text-gray-600 ml-1">{kpi.unit}</span>
                  </p>
                </div>
                <div className="p-2 bg-white rounded border border-gray-200">
                  <p className="text-xs text-gray-600">Variance</p>
                  <p className={`font-semibold ${isMeetsTarget ? 'text-green-600' : 'text-red-600'}`}>
                    {isMeetsTarget ? '+' : ''}{(kpi.actual - kpi.target).toFixed(1)}
                  </p>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={isMeetsTarget ? 'bg-green-500' : 'bg-yellow-500'}
                  style={{ width: `${Math.min(percentOfTarget, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{percentOfTarget.toFixed(0)}% of target</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
