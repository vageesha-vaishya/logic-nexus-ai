import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export const EmailActivity = () => {
  const [emails, setEmails] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecentEmails();
  }, []);

  const fetchRecentEmails = async () => {
    try {
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("folder", "inbox")
        .order("received_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  const getEmailType = (fromEmail: string) => {
    if (fromEmail.includes("gov")) return "customs";
    if (fromEmail.includes("carrier")) return "carrier";
    return "customer";
  };

  const typeColors: Record<string, string> = {
    customs: "bg-warning/10 text-warning",
    carrier: "bg-primary/10 text-primary",
    customer: "bg-accent/10 text-accent"
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Email Activity
        </h3>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate("/dashboard/email-management")}
        >
          Open Hub
        </Button>
      </div>

      <div className="space-y-3">
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent emails
          </p>
        ) : (
          emails.map((email) => {
            const emailType = getEmailType(email.from_email);
            return (
              <div 
                key={email.id}
                className={`p-4 rounded-lg border transition-colors hover:bg-accent/5 cursor-pointer ${
                  !email.is_read ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
                onClick={() => navigate("/dashboard/email-management")}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        {email.from_name || email.from_email}
                      </span>
                      <Badge variant="outline" className={typeColors[emailType]}>
                        {emailType}
                      </Badge>
                    </div>
                    <div className="text-sm font-semibold mb-1 truncate">{email.subject}</div>
                    <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
