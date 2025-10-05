import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price_monthly: number;
    price_annual: number | null;
    tier: string | null;
    features: any;
    billing_period: string;
    is_active: boolean;
  };
  isCurrentPlan?: boolean;
  onSelect?: (planId: string) => void;
  showActions?: boolean;
}

export function PlanCard({ plan, isCurrentPlan, onSelect, showActions = true }: PlanCardProps) {
  const features = Array.isArray(plan.features) ? plan.features : [];
  const displayPrice = plan.billing_period === 'annual' && plan.price_annual 
    ? plan.price_annual 
    : plan.price_monthly;

  const getTierColor = (tier: string | null) => {
    const colors: Record<string, string> = {
      starter: 'bg-blue-500/10 text-blue-500',
      professional: 'bg-purple-500/10 text-purple-500',
      business: 'bg-orange-500/10 text-orange-500',
      enterprise: 'bg-green-500/10 text-green-500',
    };
    return tier ? colors[tier.toLowerCase()] || 'bg-gray-500/10 text-gray-500' : 'bg-gray-500/10 text-gray-500';
  };

  return (
    <Card className={`relative ${isCurrentPlan ? 'border-primary shadow-lg' : ''}`}>
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-primary">Current Plan</Badge>
        </div>
      )}
      
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{plan.name}</CardTitle>
            {plan.tier && (
              <Badge variant="outline" className={getTierColor(plan.tier)}>
                {plan.tier}
              </Badge>
            )}
          </div>
        </div>
        {plan.description && (
          <CardDescription className="mt-2">{plan.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">${displayPrice}</span>
          <span className="text-muted-foreground">
            /{plan.billing_period === 'annual' ? 'year' : 'month'}
          </span>
        </div>

        {plan.price_annual && plan.billing_period === 'monthly' && (
          <p className="text-sm text-muted-foreground">
            Save 20% with annual billing (${plan.price_annual}/year)
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Features:</p>
          {features.length > 0 ? (
            <ul className="space-y-2">
              {features.slice(0, 5).map((feature: any, index: number) => {
                const featureName = typeof feature === 'string' ? feature : feature.name || feature.key;
                return (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{featureName}</span>
                  </li>
                );
              })}
              {features.length > 5 && (
                <li className="text-sm text-muted-foreground">
                  +{features.length - 5} more features
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No features listed</p>
          )}
        </div>
      </CardContent>

      {showActions && (
        <CardFooter>
          {isCurrentPlan ? (
            <Button variant="outline" className="w-full" disabled>
              Current Plan
            </Button>
          ) : (
            <Button 
              className="w-full" 
              onClick={() => onSelect?.(plan.id)}
              disabled={!plan.is_active}
            >
              {plan.is_active ? 'Select Plan' : 'Unavailable'}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}