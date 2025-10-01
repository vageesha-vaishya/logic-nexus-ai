import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ship, MapPin, Calendar } from "lucide-react";

const shipments = [
  {
    id: "SHP-2024-001",
    origin: "Shanghai, CN",
    destination: "Los Angeles, US",
    status: "in-transit",
    eta: "2024-02-15",
    customer: "Acme Corp"
  },
  {
    id: "SHP-2024-002",
    origin: "Rotterdam, NL",
    destination: "New York, US",
    status: "customs",
    eta: "2024-02-12",
    customer: "Global Trade Inc"
  },
  {
    id: "SHP-2024-003",
    origin: "Singapore, SG",
    destination: "Seattle, US",
    status: "delivered",
    eta: "2024-02-10",
    customer: "Pacific Imports"
  }
];

const statusVariants: Record<string, "default" | "secondary" | "success" | "warning"> = {
  "in-transit": "default",
  "customs": "warning",
  "delivered": "success"
};

export const RecentShipments = () => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Ship className="w-5 h-5 text-primary" />
          Recent Shipments
        </h3>
        <Button variant="ghost" size="sm">View All</Button>
      </div>

      <div className="space-y-4">
        {shipments.map((shipment) => (
          <div 
            key={shipment.id}
            className="p-4 rounded-lg border border-border hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold mb-1">{shipment.id}</div>
                <div className="text-sm text-muted-foreground">{shipment.customer}</div>
              </div>
              <Badge variant={statusVariants[shipment.status]}>
                {shipment.status}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{shipment.origin}</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{shipment.destination}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
              <Calendar className="w-4 h-4" />
              <span>ETA: {shipment.eta}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
