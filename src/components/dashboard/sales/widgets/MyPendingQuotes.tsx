import React from 'react';
import { Clock, AlertCircle, TrendingUp } from 'lucide-react';

export function MyPendingQuotes() {
  const quoteData = {
    totalPending: 12,
    daysOldest: 8,
    avgProcessTime: 3.2,
    awaitingReview: 5,
    pendingCustomerResponse: 4,
    needsRevision: 3,
    quotes: [
      { id: 'Q-2024-001', customer: 'Acme Corp', amount: '$45,000', daysPending: 5, status: 'Sent' },
      { id: 'Q-2024-002', customer: 'TechVision Inc', amount: '$78,500', daysPending: 3, status: 'In Progress' },
      { id: 'Q-2024-003', customer: 'Global Solutions', amount: '$32,000', daysPending: 8, status: 'Awaiting Review' },
      { id: 'Q-2024-004', customer: 'Enterprise Ltd', amount: '$125,000', daysPending: 2, status: 'Draft' },
    ],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-status-warning text-status-warning-foreground border-status-warning-border';
      case 'In Progress':
        return 'bg-status-info text-status-info-foreground border-status-info-border';
      case 'Sent':
        return 'bg-status-success text-status-success-foreground border-status-success-border';
      case 'Awaiting Review':
        return 'bg-status-warning text-status-warning-foreground border-status-warning-border';
      default:
        return 'bg-status-neutral text-status-neutral-foreground border-status-neutral-border';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">My Pending Quotes</h4>
        </div>
        <span className="bg-primary/10 text-primary px-2 py-1 rounded text-sm font-semibold">
          {quoteData.totalPending}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-blue-600 font-semibold">Avg Processing</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{quoteData.avgProcessTime}</p>
          <p className="text-xs text-blue-600 mt-1">days</p>
        </div>
        <div className="p-3 bg-orange-50 rounded border border-orange-200">
          <p className="text-xs text-orange-600 font-semibold">Oldest Quote</p>
          <p className="text-2xl font-bold text-orange-900 mt-1">{quoteData.daysOldest}</p>
          <p className="text-xs text-orange-600 mt-1">days old</p>
        </div>
        <div className="p-3 bg-purple-50 rounded border border-purple-200">
          <p className="text-xs text-purple-600 font-semibold">Need Review</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">{quoteData.awaitingReview}</p>
          <p className="text-xs text-purple-600 mt-1">awaiting</p>
        </div>
      </div>

      <div className="pt-3 border-t">
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {quoteData.quotes.map((quote, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{quote.customer}</p>
                <p className="text-xs text-gray-500">{quote.id} • {quote.amount}</p>
              </div>
              <div className="text-right">
                <div className={`text-xs font-semibold px-2 py-1 rounded border ${getStatusColor(quote.status)}`}>
                  {quote.daysPending}d
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
