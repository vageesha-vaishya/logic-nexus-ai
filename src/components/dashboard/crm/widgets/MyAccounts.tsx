import React from 'react';
import { Building2, Globe, DollarSign } from 'lucide-react';

export function MyAccounts() {
  // Mock account data for demonstration
  const accounts = [
    { name: 'Acme Corporation', industry: 'Technology', status: 'Active', revenue: '$125,000' },
    { name: 'Global Enterprises', industry: 'Finance', status: 'Active', revenue: '$98,500' },
    { name: 'Tech Solutions Inc', industry: 'Software', status: 'At Risk', revenue: '$75,000' },
    { name: 'Innovation Labs', industry: 'Manufacturing', status: 'Active', revenue: '$150,000' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'At Risk':
        return 'bg-red-100 text-red-800';
      case 'Inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">My Accounts</h4>
      </div>
      <div className="space-y-2">
        {accounts.map((account, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-900">{account.name}</p>
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                  <Globe className="h-3 w-3" />
                  {account.industry}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(account.status)}`}>
                {account.status}
              </span>
            </div>
            <div className="flex items-center gap-1 text-green-600 font-semibold text-sm">
              <DollarSign className="h-4 w-4" />
              {account.revenue}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
