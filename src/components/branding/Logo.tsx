import React from 'react';
import logoImage from '@/assets/sos-logistics-logo-3d.png';
import { cn } from '@/lib/utils';

type LogoProps = {
  showWordmark?: boolean;
  size?: number;
  className?: string;
  wordmarkClassName?: string;
  imageClassName?: string;
};

export const Logo: React.FC<LogoProps> = ({ 
  showWordmark = false, 
  size = 40, 
  className, 
  wordmarkClassName,
  imageClassName,
}) => {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img 
        src={logoImage}
        alt="SOS Logistic Pro Logo"
        className={cn('aspect-square object-contain transition-[width,height] duration-300 ease-out', imageClassName)}
        style={{ width: size, height: size }}
      />

      {showWordmark && (
        <div className={wordmarkClassName || 'leading-tight'}>
          <div className="font-semibold text-foreground">SOS Logistic Pro</div>
          <div className="text-xs text-muted-foreground">Enterprise</div>
        </div>
      )}
    </div>
  );
};

export default Logo;
