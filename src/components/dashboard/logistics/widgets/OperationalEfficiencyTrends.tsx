import React from 'react';
import { LineChart, TrendingUp, Calendar } from 'lucide-react';

export function OperationalEfficiencyTrends() {
  const efficiencyTrends = [
    { week: 'Week 1', efficiency: 78, costPerDelivery: 14.2, utilization: 78 },
    { week: 'Week 2', efficiency: 81, costPerDelivery: 13.8, utilization: 81 },
    { week: 'Week 3', efficiency: 85, costPerDelivery: 13.1, utilization: 85 },
    { week: 'Week 4', efficiency: 88, costPerDelivery: 12.5, utilization: 88 },
    { week: 'Week 5', efficiency: 89, costPerDelivery: 12.3, utilization: 89 },
    { week: 'Week 6', efficiency: 91, costPerDelivery: 11.9, utilization: 91 },
  ];

  const currentEfficiency = efficiencyTrends[efficiencyTrends.length - 1].efficiency;
  const previousEfficiency = efficiencyTrends[efficiencyTrends.length - 2].efficiency;
  const efficiencyTrendDirection = currentEfficiency >= previousEfficiency ? 'up' : 'down';
  const efficiencyImprovement = Math.abs(currentEfficiency - previousEfficiency);

  const maxEfficiency = 100;
  const maxCost = 15;
  const maxUtilization = 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <LineChart className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Operational Efficiency Trends</h4>
      </div>

      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-xs text-gray-600 mb-1">Current Efficiency Score</p>
        <div className="flex items-end gap-2 mb-1">
          <p className="text-3xl font-bold text-blue-700">{currentEfficiency}%</p>
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">+{efficiencyImprovement}%</span>
          </div>
        </div>
        <p className="text-xs text-blue-600">6-week improvement trend</p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-900 mb-2">Efficiency Score Trend</p>
          <div className="space-y-1">
            {efficiencyTrends.map((week, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-16">{week.week}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(week.efficiency / maxEfficiency) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-700 w-8">{week.efficiency}%</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-900 mb-2">Cost per Delivery Trend</p>
          <div className="space-y-1">
            {efficiencyTrends.map((week, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-16">{week.week}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${((maxCost - week.costPerDelivery) / maxCost) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-700 w-12">${week.costPerDelivery}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-900 mb-2">Fleet Utilization Trend</p>
          <div className="space-y-1">
            {efficiencyTrends.map((week, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-16">{week.week}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${(week.utilization / maxUtilization) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-700 w-8">{week.utilization}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 bg-green-50 rounded border border-green-200 flex items-start gap-2">
        <Calendar className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-green-900">Strong continuous improvement</p>
          <p className="text-xs text-green-700">13% efficiency gain over 6 weeks</p>
        </div>
      </div>
    </div>
  );
}
