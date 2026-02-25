import React from 'react';
import { Wrench, Calendar, AlertCircle } from 'lucide-react';

export function MaintenanceSchedule() {
  const maintenanceItems = [
    {
      id: 'MNT-001',
      vehicle: 'VAN-045',
      type: 'Oil Change',
      dueDate: '2024-02-28',
      mileage: '45,230 mi',
      status: 'Overdue',
      daysOverdue: 3,
    },
    {
      id: 'MNT-002',
      vehicle: 'VAN-056',
      type: 'Tire Rotation',
      dueDate: '2024-03-05',
      mileage: '52,180 mi',
      status: 'Upcoming',
      daysOverdue: -7,
    },
    {
      id: 'MNT-003',
      vehicle: 'VAN-034',
      type: 'Brake Inspection',
      dueDate: '2024-03-12',
      mileage: '38,950 mi',
      status: 'Upcoming',
      daysOverdue: -14,
    },
    {
      id: 'MNT-004',
      vehicle: 'TRUCK-078',
      type: 'Engine Service',
      dueDate: '2024-02-25',
      mileage: '72,400 mi',
      status: 'Overdue',
      daysOverdue: 1,
    },
    {
      id: 'MNT-005',
      vehicle: 'VAN-012',
      type: 'Fluid Top-up',
      dueDate: '2024-03-20',
      mileage: '28,560 mi',
      status: 'Scheduled',
      daysOverdue: -22,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      case 'Upcoming':
        return 'bg-yellow-100 text-yellow-800';
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Overdue':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Calendar className="h-4 w-4 text-blue-600" />;
    }
  };

  const overdueCount = maintenanceItems.filter((m) => m.status === 'Overdue').length;
  const upcomingCount = maintenanceItems.filter((m) => m.status === 'Upcoming').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Maintenance Schedule</h4>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2 bg-red-50 rounded border border-red-200">
          <p className="text-xs text-gray-600">Overdue</p>
          <p className="text-lg font-bold text-red-700">{overdueCount}</p>
        </div>
        <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
          <p className="text-xs text-gray-600">Upcoming</p>
          <p className="text-lg font-bold text-yellow-700">{upcomingCount}</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {maintenanceItems.map((item) => (
          <div key={item.id} className="p-2 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start gap-2 mb-1">
              {getStatusIcon(item.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{item.vehicle}</p>
                    <p className="text-xs text-gray-600">{item.type}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600 ml-6">
              <span>{item.mileage}</span>
              <span>{item.dueDate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
