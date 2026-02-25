import React, { useState } from 'react';
import { Zap, Plus, Copy, Clock } from 'lucide-react';

export function QuickQuoteGenerator() {
  const [selectedBundle, setSelectedBundle] = useState<string>('basic');

  const bundles = [
    {
      id: 'basic',
      name: 'Basic Package',
      description: 'Essential service bundle',
      price: 5000,
      items: ['Setup', 'Support', 'Training'],
      estimatedTime: '2 days',
      color: 'bg-blue-100 border-blue-300',
      textColor: 'text-blue-700',
    },
    {
      id: 'standard',
      name: 'Standard Package',
      description: 'Popular choice',
      price: 12500,
      items: ['Setup', 'Support', 'Training', 'Customization'],
      estimatedTime: '5 days',
      color: 'bg-green-100 border-green-300',
      textColor: 'text-green-700',
    },
    {
      id: 'enterprise',
      name: 'Enterprise Package',
      description: 'Full suite solution',
      price: 28000,
      items: ['Setup', 'Support', 'Training', 'Customization', 'Integration', 'Dedicated Manager'],
      estimatedTime: '10 days',
      color: 'bg-purple-100 border-purple-300',
      textColor: 'text-purple-700',
    },
    {
      id: 'custom',
      name: 'Custom Package',
      description: 'Build your own',
      price: 0,
      items: ['Flexible components', 'Tailored pricing', 'Custom timeline'],
      estimatedTime: 'Varies',
      color: 'bg-gray-100 border-gray-300',
      textColor: 'text-gray-700',
    },
  ];

  const selectedBundleData = bundles.find(b => b.id === selectedBundle);
  const recentQuotes = [
    { id: 'QG-001', bundle: 'Standard Package', customer: 'Quick Quote', created: '2 min ago' },
    { id: 'QG-002', bundle: 'Basic Package', customer: 'Quick Quote', created: '1 hour ago' },
    { id: 'QG-003', bundle: 'Enterprise Package', customer: 'Quick Quote', created: '3 hours ago' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-600" />
          <h4 className="font-semibold text-gray-900">Quick Quote Generator</h4>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Select Template Bundle</p>
        <div className="grid grid-cols-2 gap-2">
          {bundles.slice(0, 3).map((bundle) => (
            <button
              key={bundle.id}
              onClick={() => setSelectedBundle(bundle.id)}
              className={`p-3 rounded border-2 cursor-pointer transition-all text-left ${
                selectedBundle === bundle.id
                  ? `${bundle.color} border-opacity-100 ring-2 ring-offset-1`
                  : `${bundle.color} border-opacity-50 hover:border-opacity-75`
              }`}
            >
              <p className={`text-sm font-semibold ${bundle.textColor}`}>{bundle.name}</p>
              <p className="text-xs text-gray-600 mt-1">${(bundle.price / 1000).toFixed(1)}k</p>
            </button>
          ))}
        </div>
      </div>

      {selectedBundleData && (
        <div className={`p-4 rounded border-2 ${selectedBundleData.color}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className={`font-semibold text-lg ${selectedBundleData.textColor}`}>
                {selectedBundleData.name}
              </p>
              <p className="text-sm text-gray-600">{selectedBundleData.description}</p>
            </div>
            <p className={`text-2xl font-bold ${selectedBundleData.textColor}`}>
              ${(selectedBundleData.price / 1000).toFixed(1)}k
            </p>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">{selectedBundleData.estimatedTime} processing</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedBundleData.items.map((item, idx) => (
                <span key={idx} className="text-xs bg-white bg-opacity-60 px-2 py-1 rounded text-gray-700">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 bg-white bg-opacity-70 hover:bg-opacity-100 px-3 py-2 rounded text-sm font-semibold text-gray-700 transition-all">
              <Plus className="h-4 w-4" />
              Create Quote
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-white bg-opacity-70 hover:bg-opacity-100 px-3 py-2 rounded text-sm font-semibold text-gray-700 transition-all">
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
          </div>
        </div>
      )}

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Recently Generated</p>
        <div className="space-y-2">
          {recentQuotes.map((quote, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
              <div>
                <p className="font-medium text-gray-900">{quote.id}</p>
                <p className="text-xs text-gray-500">{quote.bundle}</p>
              </div>
              <p className="text-xs text-gray-500">{quote.created}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
