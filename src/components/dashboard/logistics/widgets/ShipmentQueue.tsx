import React from 'react';
import { Package, AlertCircle, CheckCircle } from 'lucide-react';

export function ShipmentQueue() {
  const shipments = [
    {
      id: 'SHP-2024-001',
      destination: 'New York, NY',
      priority: 'High',
      weight: '45 lbs',
      status: 'Ready for Pickup',
      timeInQueue: '2h 15m',
    },
    {
      id: 'SHP-2024-002',
      destination: 'Los Angeles, CA',
      priority: 'Normal',
      weight: '28 lbs',
      status: 'Awaiting Pickup',
      timeInQueue: '4h 30m',
    },
    {
      id: 'SHP-2024-003',
      destination: 'Chicago, IL',
      priority: 'High',
      weight: '65 lbs',
      status: 'Ready for Pickup',
      timeInQueue: '1h 45m',
    },
    {
      id: 'SHP-2024-004',
      destination: 'Houston, TX',
      priority: 'Low',
      weight: '15 lbs',
      status: 'Processing',
      timeInQueue: '30m',
    },
    {
      id: 'SHP-2024-005',
      destination: 'Phoenix, AZ',
      priority: 'Normal',
      weight: '52 lbs',
      status: 'Ready for Pickup',
      timeInQueue: '3h 10m',
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Normal':
        return 'bg-blue-100 text-blue-800';
      case 'Low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Ready for Pickup':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Awaiting Pickup':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Package className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Shipment Queue ({shipments.length})</h4>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {shipments.map((shipment) => (
          <div key={shipment.id} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1">
                {getStatusIcon(shipment.status)}
                <div>
                  <p className="font-medium text-gray-900 text-sm">{shipment.id}</p>
                  <p className="text-xs text-gray-600">{shipment.destination}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${getPriorityColor(shipment.priority)}`}>
                {shipment.priority}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{shipment.weight}</span>
              <span className="text-blue-600 font-medium">{shipment.timeInQueue}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
