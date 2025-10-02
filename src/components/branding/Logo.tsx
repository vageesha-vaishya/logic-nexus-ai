import { Plane, Ship, Truck } from 'lucide-react';
import React from 'react';

type LogoProps = {
  showWordmark?: boolean;
  size?: number; // pixel size of the mark square
  className?: string;
  wordmarkClassName?: string;
  variant?: 'default' | 'golden';
  iconTone?: 'default' | 'gold';
};

// Logistics-themed brand mark combining air, ocean, and trucking.
// Uses the app gradient token and foreground colors for clear contrast across themes.
export const Logo: React.FC<LogoProps> = ({ showWordmark = false, size = 40, className, wordmarkClassName, variant = 'default', iconTone = 'gold' }) => {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <div
        aria-label="SOS Logistic Pro Logo"
        role="img"
        className="rounded-lg shadow-sm flex items-center justify-center border border-border"
        style={{
          width: size,
          height: size,
          backgroundImage: variant === 'golden' ? 'var(--gradient-brand-golden)' : 'var(--gradient-primary)',
        }}
      >
        {/* icon trio */}
        <div
          className="grid grid-cols-2 gap-0.5 p-1"
          style={{
            color: iconTone === 'gold' ? 'hsl(var(--brand-gold))' : 'hsl(var(--primary-foreground))',
            filter: iconTone === 'gold' ? 'drop-shadow(0 1px 1px hsl(var(--brand-gold-dark) / 0.4))' : undefined,
          }}
        >
          <Plane className="w-3.5 h-3.5" />
          <Ship className="w-3.5 h-3.5" />
          <Truck className="w-3.5 h-3.5 col-span-2" />
        </div>
      </div>

      {showWordmark && (
        <div className={wordmarkClassName || 'leading-tight'}>
          <div className="font-semibold text-card-foreground">SOS Logistic Pro</div>
          <div className="text-xs text-muted-foreground">Enterprise</div>
        </div>
      )}
    </div>
  );
};

export default Logo;