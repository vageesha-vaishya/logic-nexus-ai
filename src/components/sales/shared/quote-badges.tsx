import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  DollarSign, 
  Timer, 
  Leaf, 
  ShieldCheck, 
  Ship, 
  Plane, 
  Truck,
  Train
} from 'lucide-react';

import { normalizeModeCode } from '@/lib/mode-utils';

export const getTierBadge = (tier: string) => {
    if (!tier) return null;
    switch (tier) {
        case 'contract': return <Badge className="bg-green-600">Contract</Badge>;
        case 'spot': return <Badge className="bg-blue-600">Spot</Badge>;
        case 'best_value': return <Badge className="bg-purple-600"><Sparkles className="w-3 h-3 mr-1"/> Best Value</Badge>;
        case 'cheapest': return <Badge className="bg-emerald-600"><DollarSign className="w-3 h-3 mr-1"/> Cheapest</Badge>;
        case 'fastest': return <Badge className="bg-amber-600"><Timer className="w-3 h-3 mr-1"/> Fastest</Badge>;
        case 'greenest': return <Badge className="bg-green-500"><Leaf className="w-3 h-3 mr-1"/> Eco-Friendly</Badge>;
        case 'reliable': return <Badge className="bg-blue-500"><ShieldCheck className="w-3 h-3 mr-1"/> Most Reliable</Badge>;
        default: return <Badge variant="outline">{tier.replace('_', ' ')}</Badge>;
    }
};

export const getModeIcon = (mode: string) => {
    const normalized = normalizeModeCode(mode);
    switch (normalized) {
        case 'air': return <Plane className="h-4 w-4" />;
        case 'road': return <Truck className="h-4 w-4" />;
        case 'rail': return <Train className="h-4 w-4" />;
        case 'ocean':
        default: return <Ship className="h-4 w-4" />;
    }
};

export const getReliabilityColor = (score: number) => {
    if (score >= 9) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 7) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
};

