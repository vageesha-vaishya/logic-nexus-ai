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
}

export function BackupDownloader() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("db-backups")
        .list("", {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) throw error;
      setBackups(data as BackupFile[]);
    } catch (error: any) {
      toast.error("Failed to fetch backups", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const downloadBackup = async (fileName: string) => {
    setDownloading(fileName);
    try {
      const { data, error } = await supabase.storage
        .from("db-backups")
        .download(fileName);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
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
                    onClick={() => downloadBackup(backup.name)}
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
