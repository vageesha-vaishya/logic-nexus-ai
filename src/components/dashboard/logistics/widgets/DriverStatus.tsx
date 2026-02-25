import React from 'react';
import { User, Clock, Truck } from 'lucide-react';

export function DriverStatus() {
  const drivers = [
    {
      id: 'DRV-001',
      name: 'John Smith',
      status: 'On Duty',
      hoursWorked: '8.5',
      shipmentsCompleted: 12,
      currentVehicle: 'VAN-045',
    },
    {
      id: 'DRV-002',
      name: 'Maria Garcia',
      status: 'On Duty',
      hoursWorked: '6.2',
      shipmentsCompleted: 8,
      currentVehicle: 'VAN-012',
    },
    {
      id: 'DRV-003',
      name: 'David Chen',
      status: 'On Break',
      hoursWorked: '5.0',
      shipmentsCompleted: 7,
      currentVehicle: 'VAN-034',
    },
    {
      id: 'DRV-004',
      name: 'Sarah Wilson',
      status: 'Off Duty',
      hoursWorked: '0',
      shipmentsCompleted: 0,
      currentVehicle: 'N/A',
    },
    {
      id: 'DRV-005',
      name: 'James Brown',
      status: 'On Duty',
      hoursWorked: '7.8',
      shipmentsCompleted: 10,
      currentVehicle: 'VAN-078',
    },
    {
      id: 'DRV-006',
      name: 'Lisa Anderson',
      status: 'On Duty',
      hoursWorked: '9.1',
      shipmentsCompleted: 15,
      currentVehicle: 'VAN-056',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'On Duty':
        return 'bg-green-100 text-green-800';
      case 'On Break':
        return 'bg-yellow-100 text-yellow-800';
      case 'Off Duty':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const onDutyCount = drivers.filter((d) => d.status === 'On Duty').length;
  const totalShipments = drivers.reduce((sum, d) => sum + d.shipmentsCompleted, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Driver Status</h4>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2 bg-green-50 rounded border border-green-200">
          <p className="text-xs text-gray-600">On Duty</p>
          <p className="text-lg font-bold text-green-700">{onDutyCount}</p>
        </div>
        <div className="p-2 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-gray-600">Shipments Today</p>
          <p className="text-lg font-bold text-blue-700">{totalShipments}</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {drivers.map((driver) => (
          <div key={driver.id} className="p-2 bg-gray-50 rounded border border-gray-200 text-sm">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-medium text-gray-900">{driver.name}</p>
                <p className="text-xs text-gray-600">{driver.id}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(driver.status)}`}>
                {driver.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{driver.hoursWorked}h</span>
              </div>
              <div className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                <span>{driver.currentVehicle}</span>
              </div>
              <span className="text-blue-600 font-medium">{driver.shipmentsCompleted}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
