import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText, 
  Plus, 
  ArrowRight,
  Clock,
  Zap,
  Target,
  DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SalesCommandCenter() {
  const navigate = useNavigate();

  const metrics = [
    { title: 'Total Revenue', value: '$124.5k', trend: '+12%', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Active Deals', value: '42', trend: '+5', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Conversion Rate', value: '24%', trend: '+2.1%', icon: Target, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'New Leads', value: '18', trend: '+4', icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const quickActions = [
    { label: 'New Quote', icon: Plus, action: '/dashboard/quotes/new', desc: 'Create a new quotation' },
    { label: 'New Lead', icon: Users, action: '/dashboard/leads/new', desc: 'Register a new prospect' },
    { label: 'Create Order', icon: FileText, action: '/dashboard/orders/new', desc: 'Convert quote to order' },
    { label: 'Sales Report', icon: BarChart3, action: '/dashboard/reports/sales', desc: 'View performance analytics' },
  ];

  const recentActivities = [
    { title: 'Quote #QT-2024-001 approved', time: '10 mins ago', type: 'success', desc: 'Approved by Manager' },
    { title: 'New lead assigned: Acme Corp', time: '1 hour ago', type: 'info', desc: 'Assigned to Vimal Bahuguna' },
    { title: 'Meeting with Global Logistics', time: '2 hours ago', type: 'warning', desc: 'Discussing Q3 contract' },
    { title: 'Order #ORD-2024-055 shipped', time: '4 hours ago', type: 'success', desc: 'Carrier: Maersk Line' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-500 fill-yellow-500" />
            Sales Command Center
          </h1>
          <p className="text-gray-500 mt-1">Overview of your sales performance and daily tasks</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Customize Dashboard</Button>
          <Button className="bg-[#714B67] hover:bg-[#5e3d55]">
            <Plus className="mr-2 h-4 w-4" /> New Activity
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, idx) => (
          <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${metric.bg}`}>
                  <metric.icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  metric.trend.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {metric.trend}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-500">{metric.title}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => navigate(action.action)}
                className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-gray-100 group-hover:bg-white group-hover:shadow-sm transition-all">
                  <action.icon className="h-6 w-6 text-gray-600 group-hover:text-[#714B67]" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 group-hover:text-[#714B67] transition-colors">{action.label}</h4>
                  <p className="text-sm text-gray-500 mt-1">{action.desc}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-800">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-purple-600">View All</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {recentActivities.map((activity, idx) => (
              <div key={idx} className="flex gap-4 relative">
                {idx !== recentActivities.length - 1 && (
                  <div className="absolute left-[11px] top-8 bottom-[-24px] w-px bg-gray-100" />
                )}
                <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white shadow-sm flex-shrink-0 ${
                  activity.type === 'success' ? 'bg-green-500' : 
                  activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{activity.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{activity.desc}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
