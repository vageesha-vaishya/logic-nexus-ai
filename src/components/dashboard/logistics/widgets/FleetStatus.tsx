import React from 'react';
import { Truck, Gauge, AlertTriangle, Zap } from 'lucide-react';

export function FleetStatus() {
  const fleetData = {
    totalVehicles: 24,
    activeVehicles: 18,
    maintenanceVehicles: 3,
    availableVehicles: 3,
    utilization: 85,
    fuelCostPerMile: 0.45,
  };

  const vehicleTypes = [
    { type: 'Delivery Vans', count: 12, utilization: 88 },
    { type: 'Box Trucks', count: 8, utilization: 82 },
    { type: 'Flatbeds', count: 3, utilization: 78 },
    { type: 'Sprinter Vans', count: 1, utilization: 95 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Fleet Overview</h4>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-gray-600">Total Fleet</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{fleetData.totalVehicles}</p>
          <p className="text-xs text-blue-600">{fleetData.activeVehicles} Active</p>
        </div>

        <div className="p-3 bg-green-50 rounded border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="h-4 w-4 text-green-600" />
            <p className="text-xs text-gray-600">Utilization</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{fleetData.utilization}%</p>
          <p className="text-xs text-green-600">${fleetData.fuelCostPerMile}/mi</p>
        </div>

        <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <p className="text-xs text-gray-600">Maintenance</p>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{fleetData.maintenanceVehicles}</p>
          <p className="text-xs text-yellow-600">In Service</p>
        </div>

        <div className="p-3 bg-purple-50 rounded border border-purple-200">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-purple-600" />
            <p className="text-xs text-gray-600">Available</p>
          </div>
          <p className="text-2xl font-bold text-purple-700">{fleetData.availableVehicles}</p>
          <p className="text-xs text-purple-600">Ready to Deploy</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-900 mb-3">By Vehicle Type</p>
        <div className="space-y-2">
          {vehicleTypes.map((vehicle, idx) => (
            <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700">{vehicle.type}</span>
                <span className="font-medium text-gray-900">{vehicle.count}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${vehicle.utilization}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{vehicle.utilization}% utilization</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
