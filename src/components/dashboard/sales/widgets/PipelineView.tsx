import React from 'react';
import { Pipelines, ArrowRight } from 'lucide-react';

export function PipelineView() {
  const pipelineData = {
    total: 1250000,
    stages: [
      { name: 'Lead', count: 45, value: 450000, percentage: 36, color: 'bg-blue-500', winRate: '8%' },
      { name: 'Qualified', count: 32, value: 320000, percentage: 25.6, color: 'bg-cyan-500', winRate: '15%' },
      { name: 'Proposal', count: 18, value: 300000, percentage: 24, color: 'bg-purple-500', winRate: '35%' },
      { name: 'Negotiation', count: 8, value: 180000, percentage: 14.4, color: 'bg-orange-500', winRate: '55%' },
    ],
    conversionRates: [
      { from: 'Lead', to: 'Qualified', rate: '71%' },
      { from: 'Qualified', to: 'Proposal', rate: '56%' },
      { from: 'Proposal', to: 'Negotiation', rate: '44%' },
    ],
  };

  const maxValue = Math.max(...pipelineData.stages.map(s => s.value));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pipelines className="h-5 w-5 text-purple-600" />
          <h4 className="font-semibold text-gray-900">Pipeline View</h4>
        </div>
        <span className="text-sm font-semibold text-gray-700">${(pipelineData.total / 1000000).toFixed(2)}M</span>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-700">Pipeline Stages</p>
        {pipelineData.stages.map((stage, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{stage.name}</p>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {stage.count} deals
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">${(stage.value / 1000).toFixed(0)}k</p>
                <p className="text-xs text-gray-500">Win rate: {stage.winRate}</p>
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
              <span className="text-xs font-semibold text-gray-600 w-8 text-right">
                {stage.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Stage Conversion Rates</p>
        <div className="space-y-2">
          {pipelineData.conversionRates.map((conversion, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 font-medium">{conversion.from}</span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700 font-medium">{conversion.to}</span>
              </div>
              <span className="text-sm font-semibold text-green-700">{conversion.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
