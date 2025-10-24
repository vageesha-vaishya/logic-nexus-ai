import { Badge } from "@/components/ui/badge";
import { Cloud, HardDrive } from "lucide-react";

export function EnvironmentIndicator() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  // Detect if using local environment (localhost or 127.0.0.1)
  const isLocal = supabaseUrl?.includes('localhost') || supabaseUrl?.includes('127.0.0.1');
  
  if (!supabaseUrl) {
    return null;
  }

  return (
    <Badge 
      variant={isLocal ? "outline" : "secondary"}
      className="gap-1.5 font-normal"
    >
      {isLocal ? (
        <>
          <HardDrive className="h-3 w-3" />
          Local Dev
        </>
      ) : (
        <>
          <Cloud className="h-3 w-3" />
          Cloud
        </>
      )}
    </Badge>
  );
}
