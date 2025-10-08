import { DashboardLayout } from '@/components/layout/DashboardLayout';
export default function DataManagement() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Data Management Options</h1>
        <p className="text-muted-foreground">Manage quote numbering configurations</p>
      </div>
    </DashboardLayout>
  );
}