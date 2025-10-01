import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RecentShipments } from "@/components/dashboard/RecentShipments";
import { EmailActivity } from "@/components/dashboard/EmailActivity";

const Dashboard = () => {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Welcome Section */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Welcome back, John</h1>
              <p className="text-muted-foreground">Here's what's happening with your logistics operations today.</p>
            </div>

            {/* Stats */}
            <StatsCards />

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-2 gap-6">
              <RecentShipments />
              <EmailActivity />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
