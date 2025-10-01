import { Card } from "@/components/ui/card";
import { 
  Brain, 
  Mail, 
  FileText, 
  DollarSign, 
  Ship, 
  BarChart3,
  Shield,
  Zap
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Echo AI Assistant",
    description: "LLM-powered assistant that guides operations, summarizes communications, and predicts risks."
  },
  {
    icon: Mail,
    title: "Unified Email Hub",
    description: "Centralized communication with auto-linking to customers, shipments, and context-aware tagging."
  },
  {
    icon: FileText,
    title: "Contract Intelligence",
    description: "OCR-powered contract repository with automated rate extraction and renewal alerts."
  },
  {
    icon: DollarSign,
    title: "QuickBooks Sync",
    description: "Bi-directional integration for invoices, billing, payments, and expense tracking."
  },
  {
    icon: Ship,
    title: "Freight Operations",
    description: "End-to-end shipment lifecycle with document automation, RFID tracking, and QR workflows."
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Predictive insights on ETA, carrier performance, lane profitability, and risk assessment."
  },
  {
    icon: Shield,
    title: "AES Compliance",
    description: "Full AESTIR implementation with automated filing, error parsing, and HTS database."
  },
  {
    icon: Zap,
    title: "Multi-Tenant Architecture",
    description: "Platform → Tenant → Franchise hierarchy with isolated data and custom branding."
  }
];

export const FeaturesSection = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Enterprise Features Built for Scale
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to run a modern logistics operation in one intelligent platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="p-6 hover:shadow-primary transition-all duration-300 hover:-translate-y-1 border-border"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
