import React from 'react';
import { Funnel, ArrowDown } from 'lucide-react';

export function SalesPipelineWaterfall() {
  const waterfallData = {
    stages: [
      { name: 'Leads', count: 250, value: 2500000, color: 'bg-blue-500', percentage: 100 },
      { name: 'Qualified', count: 85, value: 1275000, color: 'bg-cyan-500', percentage: 34 },
      { name: 'Proposals', count: 28, value: 700000, color: 'bg-purple-500', percentage: 11.2 },
      { name: 'Negotiating', count: 12, value: 420000, color: 'bg-orange-500', percentage: 4.8 },
      { name: 'Closed Won', count: 7, value: 315000, color: 'bg-green-500', percentage: 2.8 },
    ],
    conversionPath: [
      { from: 'Leads', to: 'Qualified', rate: '34%', loss: 165 },
      { from: 'Qualified', to: 'Proposals', rate: '33%', loss: 57 },
      { from: 'Proposals', to: 'Negotiating', rate: '43%', loss: 16 },
      { from: 'Negotiating', to: 'Closed Won', rate: '58%', loss: 5 },
    ],
  };

  const maxValue = waterfallData.stages[0].value;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Funnel className="h-5 w-5 text-purple-600" />
          <h4 className="font-semibold text-gray-900">Pipeline Waterfall</h4>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Stage Progression</p>
        {waterfallData.stages.map((stage, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{stage.name}</p>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  {stage.count} deals
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">${(stage.value / 1000000).toFixed(2)}M</p>
                <p className="text-xs text-gray-500">{stage.percentage.toFixed(1)}% of leads</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${stage.color}`}
                  style={{
                    width: `${(stage.value / maxValue) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Conversion Analysis</p>
        <div className="space-y-2">
          {waterfallData.conversionPath.map((conversion, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{conversion.from} → {conversion.to}</p>
                <p className="text-xs text-gray-500">Lost: {conversion.loss} deals</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-green-700">{conversion.rate}</span>
                <ArrowDown className="h-4 w-4 text-gray-400 mt-1 mx-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs text-blue-700 font-semibold">Lead to Deal</p>
            <p className="text-lg font-bold text-blue-900">2.8%</p>
            <p className="text-xs text-blue-600">conversion rate</p>
          </div>
          <div className="p-2 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-green-700 font-semibold">Pipeline Health</p>
            <p className="text-lg font-bold text-green-900">Strong</p>
            <p className="text-xs text-green-600">well-balanced</p>
          </div>
        </div>
      </div>
    </div>
  );
}
