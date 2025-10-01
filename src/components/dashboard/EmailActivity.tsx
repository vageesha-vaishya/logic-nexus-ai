import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Clock } from "lucide-react";

const emails = [
  {
    from: "customs@cbp.gov",
    subject: "AES Filing Response - SHP-2024-001",
    preview: "Your AES filing has been accepted...",
    time: "5 min ago",
    unread: true,
    type: "customs"
  },
  {
    from: "carrier@maersk.com",
    subject: "Booking Confirmation #BCK-9876",
    preview: "Your booking has been confirmed for...",
    time: "1 hour ago",
    unread: true,
    type: "carrier"
  },
  {
    from: "customer@acmecorp.com",
    subject: "Invoice Query - INV-2024-234",
    preview: "Could you please clarify the charges...",
    time: "2 hours ago",
    unread: false,
    type: "customer"
  }
];

const typeColors: Record<string, string> = {
  customs: "bg-warning/10 text-warning",
  carrier: "bg-primary/10 text-primary",
  customer: "bg-accent/10 text-accent"
};

export const EmailActivity = () => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Email Activity
        </h3>
        <Button variant="ghost" size="sm">Open Hub</Button>
      </div>

      <div className="space-y-3">
        {emails.map((email, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg border transition-colors hover:bg-accent/5 ${
              email.unread ? 'border-primary/30 bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{email.from}</span>
                  <Badge variant="outline" className={typeColors[email.type]}>
                    {email.type}
                  </Badge>
                </div>
                <div className="text-sm font-semibold mb-1 truncate">{email.subject}</div>
                <p className="text-xs text-muted-foreground truncate">{email.preview}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{email.time}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
