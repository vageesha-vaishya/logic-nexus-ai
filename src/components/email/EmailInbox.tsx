import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, Search, RefreshCw, Star, Archive, Trash2, 
  Plus, Reply, Forward, MoreVertical, Paperclip 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmailComposeDialog } from "./EmailComposeDialog";
import { EmailDetailDialog } from "./EmailDetailDialog";
import { format } from "date-fns";

interface Email {
  id: string;
  subject: string;
  from_email: string;
  from_name: string;
  snippet: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  folder: string;
  labels: any;
}

export function EmailInbox() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const { toast } = useToast();

  const fetchEmails = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("emails")
        .select("*")
        .eq("folder", selectedFolder)
        .order("received_at", { ascending: false })
        .limit(50);

      if (searchQuery) {
        query = query.or(`subject.ilike.%${searchQuery}%,from_email.ilike.%${searchQuery}%,snippet.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmails(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [selectedFolder, searchQuery]);

  const markAsRead = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from("emails")
        .update({ is_read: true })
        .eq("id", emailId);

      if (error) throw error;
      fetchEmails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleStar = async (emailId: string, isStarred: boolean) => {
    try {
      const { error } = await supabase
        .from("emails")
        .update({ is_starred: !isStarred })
        .eq("id", emailId);

      if (error) throw error;
      fetchEmails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const moveToFolder = async (emailId: string, folder: string) => {
    try {
      const { error } = await supabase
        .from("emails")
        .update({ folder })
        .eq("id", emailId);

      if (error) throw error;
      toast({
        title: "Success",
        description: `Email moved to ${folder}`,
      });
      fetchEmails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setShowDetail(true);
    if (!email.is_read) {
      markAsRead(email.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={selectedFolder} onValueChange={setSelectedFolder}>
            <TabsList>
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="archive">Archive</TabsTrigger>
              <TabsTrigger value="trash">Trash</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchEmails}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCompose(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading emails...
          </div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No emails found</p>
          </div>
        ) : (
          <div className="divide-y">
            {emails.map((email) => (
              <div
                key={email.id}
                className={`p-4 hover:bg-accent/5 cursor-pointer transition-colors ${
                  !email.is_read ? "bg-primary/5" : ""
                }`}
                onClick={() => handleEmailClick(email)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(email.id, email.is_starred);
                      }}
                      className="text-muted-foreground hover:text-warning transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          email.is_starred ? "fill-warning text-warning" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${!email.is_read ? "font-bold" : ""}`}>
                          {email.from_name || email.from_email}
                        </span>
                        {email.has_attachments && (
                          <Paperclip className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(email.received_at), "MMM d, h:mm a")}
                      </span>
                    </div>

                    <div className={`text-sm mb-1 ${!email.is_read ? "font-semibold" : ""}`}>
                      {email.subject}
                    </div>

                    <div className="text-sm text-muted-foreground truncate">
                      {email.snippet}
                    </div>

                    {email.labels && email.labels.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {email.labels.map((label, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToFolder(email.id, "archive");
                      }}
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToFolder(email.id, "trash");
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <EmailComposeDialog open={showCompose} onOpenChange={setShowCompose} />
      
      {selectedEmail && (
        <EmailDetailDialog
          open={showDetail}
          onOpenChange={setShowDetail}
          email={selectedEmail}
          onRefresh={fetchEmails}
        />
      )}
    </div>
  );
}
