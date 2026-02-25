import React from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export function AlertsIssues() {
  const alerts = [
    {
      id: 'ALR-001',
      type: 'Critical',
      title: 'Vehicle VAN-045 Mechanical Issue',
      description: 'Engine warning light activated',
      timestamp: '14 minutes ago',
      route: 'RT-001',
    },
    {
      id: 'ALR-002',
      type: 'Warning',
      title: 'Shipment SHP-2024-002 Delayed',
      description: 'Awaiting pickup for 4+ hours',
      timestamp: '22 minutes ago',
      route: 'N/A',
    },
    {
      id: 'ALR-003',
      type: 'Info',
      title: 'Driver John Smith On Break',
      description: 'Break time: 1h 15m remaining',
      timestamp: '1 hour ago',
      route: 'RT-001',
    },
    {
      id: 'ALR-004',
      type: 'Warning',
      title: 'Warehouse Capacity Alert',
      description: 'Storage utilization at 85%',
      timestamp: '2 hours ago',
      route: 'N/A',
    },
    {
      id: 'ALR-005',
      type: 'Critical',
      title: 'Delivery Exception SHP-2024-005',
      description: 'Customer not available for delivery',
      timestamp: '3 hours ago',
      route: 'RT-003',
    },
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'Critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'Warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'Info':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'Critical':
        return 'bg-red-50 border-red-200';
      case 'Warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'Info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h4 className="font-semibold text-gray-900">Active Alerts ({alerts.length})</h4>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {alerts.map((alert) => (
          <div key={alert.id} className={`p-3 rounded border ${getAlertColor(alert.type)}`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{getAlertIcon(alert.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{alert.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{alert.description}</p>
                  </div>
                  <button className="flex-shrink-0 text-gray-400 hover:text-gray-600 -mr-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                  <span>{alert.route}</span>
                  <span className="text-gray-500">{alert.timestamp}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
