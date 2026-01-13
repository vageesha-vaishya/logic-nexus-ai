import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, RefreshCw, FileArchive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface BackupFile {
  name: string;
  id: string | null;
  created_at: string | null;
  metadata: Record<string, any> | null;
  fullPath?: string;
}

export function BackupDownloader() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [userFolder, setUserFolder] = useState<string | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      // Get current user to determine their folder
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to view backups");
        setLoading(false);
        return;
      }
      
      const folder = user.id;
      setUserFolder(folder);
      
      // List files from user's backup folder (including subfolders like db-exports)
      const { data, error } = await supabase.storage
        .from("db-backups")
        .list(`${folder}/db-exports`, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) throw error;
      
      // Filter out folder placeholders and map with full path
      const files = (data || [])
        .filter(f => f.name && !f.name.endsWith('/'))
        .map(f => ({
          ...f,
          fullPath: `${folder}/db-exports/${f.name}`,
        }));
      
      setBackups(files as any);
    } catch (error: any) {
      toast.error("Failed to fetch backups", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const downloadBackup = async (backup: BackupFile) => {
    const filePath = backup.fullPath || backup.name;
    setDownloading(backup.name);
    try {
      const { data, error } = await supabase.storage
        .from("db-backups")
        .download(filePath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup downloaded successfully");
    } catch (error: any) {
      toast.error("Failed to download backup", { description: error.message });
    } finally {
      setDownloading(null);
    }
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return "Unknown";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Database Backups
          </CardTitle>
          <CardDescription>
            Download backups from cloud storage
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchBackups} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {backups.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {loading ? "Loading backups..." : "No backups found in storage"}
          </p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.id || backup.name}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{backup.name}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{formatFileSize(backup.metadata?.size)}</span>
                      {backup.created_at && (
                        <span>
                          {format(new Date(backup.created_at), "MMM d, yyyy HH:mm")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadBackup(backup)}
                    disabled={downloading === backup.name}
                  >
                    <Download className={`h-4 w-4 ${downloading === backup.name ? "animate-pulse" : ""}`} />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
