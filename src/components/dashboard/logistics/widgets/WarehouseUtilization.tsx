import React from 'react';
import { Building2, Package, AlertTriangle } from 'lucide-react';

export function WarehouseUtilization() {
  const warehouseData = [
    {
      zone: 'Zone A - Cold Storage',
      utilized: 340,
      capacity: 400,
      utilization: 85,
      status: 'Near Capacity',
    },
    {
      zone: 'Zone B - General Warehouse',
      utilized: 620,
      capacity: 800,
      utilization: 78,
      status: 'Normal',
    },
    {
      zone: 'Zone C - Bulk Storage',
      utilized: 180,
      capacity: 300,
      utilization: 60,
      status: 'Normal',
    },
    {
      zone: 'Zone D - Returns Area',
      utilized: 95,
      capacity: 150,
      utilization: 63,
      status: 'Normal',
    },
  ];

  const totalUtilized = warehouseData.reduce((sum, z) => sum + z.utilized, 0);
  const totalCapacity = warehouseData.reduce((sum, z) => sum + z.capacity, 0);
  const overallUtilization = Math.round((totalUtilized / totalCapacity) * 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Near Capacity':
        return 'bg-red-100 text-red-800';
      case 'Normal':
        return 'bg-green-100 text-green-800';
      case 'Low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (utilization: number) => {
    if (utilization >= 85) return 'bg-red-500';
    if (utilization >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Warehouse Utilization</h4>
      </div>

      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-xs text-gray-600 mb-1">Overall Capacity</p>
        <p className="text-2xl font-bold text-blue-700">{overallUtilization}%</p>
        <p className="text-xs text-blue-600">
          {totalUtilized.toLocaleString()} / {totalCapacity.toLocaleString()} units
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${overallUtilization}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-2">
        {warehouseData.map((zone, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{zone.zone}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {zone.utilized} / {zone.capacity} units
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${getStatusColor(zone.status)}`}>
                {zone.status}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(zone.utilization)}`}
                style={{ width: `${zone.utilization}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{zone.utilization}% utilized</p>
          </div>
        ))}
      </div>

      <div className="p-3 bg-yellow-50 rounded border border-yellow-200 flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-yellow-900">Zone A approaching capacity</p>
          <p className="text-xs text-yellow-700 mt-1">Plan inventory transfers soon</p>
        </div>
      </div>
    </div>
  );
}
