import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityLogs } from "./audit/ActivityLogs";
import { SystemLogs } from "./audit/SystemLogs";

export default function AuditLogs() {
  return (
    <div className="flex flex-col gap-6 p-8 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit & Logs</h1>
          <p className="text-muted-foreground mt-2">
            Monitor system activity, security events, and error logs.
          </p>
        </div>
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="activity">Activity Audit</TabsTrigger>
          <TabsTrigger value="system">System Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <ActivityLogs />
        </TabsContent>
        <TabsContent value="system">
          <SystemLogs />
        </TabsContent>
      </Tabs>
    </div>
  )
}
