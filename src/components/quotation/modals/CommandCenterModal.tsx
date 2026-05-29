import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText, 
  AlertCircle,
  Plus,
  Search,
  Zap,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useSalesDashboard } from '@/contexts/SalesDashboardContext';

export function CommandCenterModal() {
  const { showCommandCenter, setShowCommandCenter, handleNavigation } = useSalesDashboard();

  const quickActions = [
    { label: 'New Quote', icon: Plus, action: '/dashboard/quotes/new', color: 'bg-purple-100 text-purple-600' },
    { label: 'New Lead', icon: Users, action: '/dashboard/leads/new', color: 'bg-blue-100 text-blue-600' },
    { label: 'Create Order', icon: FileText, action: '/dashboard/orders/new', color: 'bg-green-100 text-green-600' },
    { label: 'Sales Report', icon: BarChart3, action: '/dashboard/reports/sales', color: 'bg-orange-100 text-orange-600' },
  ];

  const recentActivities = [
    { title: 'Quote #QT-2024-001 approved', time: '10 mins ago', type: 'success' },
    { title: 'New lead assigned: Acme Corp', time: '1 hour ago', type: 'info' },
    { title: 'Meeting with Global Logistics', time: '2 hours ago', type: 'warning' },
  ];

  return (
    <Dialog open={showCommandCenter} onOpenChange={setShowCommandCenter}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Command Center
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6 space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              placeholder="Type to search anything..."
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-500 font-medium">⌘</kbd>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-500 font-medium">K</kbd>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setShowCommandCenter(false);
                    handleNavigation(action.action);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-all group"
                >
                  <div className={`p-2 rounded-lg mb-2 ${action.color} group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Activity</h3>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-purple-600 hover:text-purple-700">
                View all
              </Button>
            </div>
            <div className="space-y-2">
              {recentActivities.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className={`h-2 w-2 rounded-full ${
                    activity.type === 'success' ? 'bg-green-500' : 
                    activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-sm text-gray-700 flex-1">{activity.title}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-purple-600">Total Revenue</span>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">$124.5k</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <ArrowRight className="h-3 w-3 rotate-45" /> +12% vs last month
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-600">Active Deals</span>
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">42</p>
                <p className="text-xs text-gray-500 mt-1">5 closing this week</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
