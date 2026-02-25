import React from 'react';
import { Star, CheckCircle, AlertCircle } from 'lucide-react';

export function ServiceQualityScorecard() {
  const qualityMetrics = [
    {
      metric: 'On-Time Delivery',
      score: 94,
      benchmark: 95,
      trend: 'up',
      detail: '94% of deliveries met SLA',
    },
    {
      metric: 'Damage Rate',
      score: 98,
      benchmark: 97,
      trend: 'up',
      detail: '0.2% damaged shipments',
    },
    {
      metric: 'Customer Satisfaction',
      score: 4.6,
      benchmark: 4.5,
      trend: 'up',
      detail: '4.6/5.0 stars',
    },
    {
      metric: 'Exception Rate',
      score: 1.8,
      benchmark: 2.0,
      trend: 'up',
      detail: '1.8% of shipments with issues',
    },
    {
      metric: 'Accuracy Score',
      score: 99.5,
      benchmark: 99.0,
      trend: 'stable',
      detail: '99.5% pick/pack accuracy',
    },
  ];

  const overallScore = (
    (qualityMetrics[0].score +
      qualityMetrics[1].score +
      (qualityMetrics[2].score * 20) +
      (100 - qualityMetrics[3].score) +
      qualityMetrics[4].score) /
    5
  ).toFixed(1);

  const getScoreColor = (score: number, benchmark: number) => {
    if (score >= benchmark) {
      return 'bg-green-100 text-green-800';
    } else if (score >= benchmark * 0.95) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-red-100 text-red-800';
  };

  const getScoreIcon = (score: number, benchmark: number) => {
    if (score >= benchmark) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Service Quality Scorecard</h4>
      </div>

      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded border border-blue-200">
        <p className="text-xs text-gray-600 mb-1">Overall Quality Score</p>
        <p className="text-3xl font-bold text-blue-700">{overallScore}</p>
        <p className="text-xs text-blue-600 mt-1">Based on 5 key metrics</p>
      </div>

      <div className="space-y-2">
        {qualityMetrics.map((metric, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{metric.metric}</p>
                <p className="text-xs text-gray-600 mt-0.5">{metric.detail}</p>
              </div>
              <div className="flex items-center gap-2">
                {getScoreIcon(metric.score, metric.benchmark)}
                <span className={`text-sm font-bold px-2 py-1 rounded ${getScoreColor(metric.score, metric.benchmark)}`}>
                  {typeof metric.score === 'number' && metric.score > 10 ? metric.score.toFixed(1) : metric.score}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Target: {metric.benchmark}</span>
              <span className={metric.score >= metric.benchmark ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                {metric.score >= metric.benchmark ? '+' : ''}{(metric.score - metric.benchmark).toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-green-50 rounded border border-green-200">
        <p className="text-sm font-medium text-green-900">Excellent service quality</p>
        <p className="text-xs text-green-700 mt-1">All metrics meeting or exceeding benchmarks</p>
      </div>
    </div>
  );
}
