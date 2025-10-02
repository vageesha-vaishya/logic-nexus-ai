import React from 'react';
import { Truck } from 'lucide-react';

type ShieldLogoProps = {
  showWordmark?: boolean;
  size?: number; // pixel size of the mark square
  className?: string;
  wordmarkClassName?: string;
  // Controls stroke style and background tile
  variant?: 'golden' | 'golden-subtle' | 'monochrome';
  tile?: 'navy' | 'primary' | 'none';
  hoverGlow?: boolean;
  glowStrength?: 'subtle' | 'strong';
};

// Shield badge logo: navy tile with golden shield boundary and truck icon.
// Uses CSS variables for brand gold tones to match provided screenshot.
const ShieldLogo: React.FC<ShieldLogoProps> = ({ showWordmark = false, size = 40, className, wordmarkClassName, variant = 'golden', tile = 'navy', hoverGlow = true, glowStrength = 'subtle' }) => {
  const svgSize = Math.round(size * 0.78);
  const truckSize = Math.round(size * 0.46);
  const isMono = variant === 'monochrome';
  const strokeWidth = variant === 'golden-subtle' ? 2 : 3;
  const glowColorVar = isMono ? 'var(--foreground)' : 'var(--brand-gold)';
  const bgImage = tile === 'navy' ? 'var(--gradient-hero)' : tile === 'primary' ? 'var(--gradient-primary)' : 'none';

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <div
        aria-label="SOS Logistic Pro Shield Logo"
        role="img"
        className="shield-logo group relative rounded-lg shadow-sm flex items-center justify-center border border-border"
        style={{
          width: size,
          height: size,
          backgroundImage: bgImage,
          boxShadow: '0 6px 14px hsl(222 47% 11% / 0.35)',
          // Pass glow color to CSS animation via variable
          ['--glow-color' as any]: glowColorVar,
        }}
      >
        {/* Golden shield boundary */}
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 64 64"
          fill="none"
          className="absolute"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        >
          {!isMono && (
            <defs>
              <linearGradient id="goldStroke" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="hsl(var(--brand-gold-light))" />
                <stop offset="40%" stopColor="hsl(var(--brand-gold))" />
                <stop offset="100%" stopColor="hsl(var(--brand-gold-dark))" />
              </linearGradient>
            </defs>
          )}
          {/* Shield path */}
          <path
            d="M32 6 L52 16 V28 C52 44 42 52 32 58 C22 52 12 44 12 28 V16 Z"
            stroke={isMono ? 'hsl(var(--foreground))' : 'url(#goldStroke)'}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            className={hoverGlow ? (glowStrength === 'strong' ? 'glow-stroke--strong' : 'glow-stroke--subtle') : ''}
            style={{ filter: isMono ? undefined : 'drop-shadow(0 2px 2px hsl(var(--brand-gold-dark) / 0.4))' }}
          />
        </svg>

        {/* Truck glyph inside the shield */}
        <Truck
          style={{
            width: truckSize,
            height: truckSize,
            color: isMono ? 'hsl(var(--foreground))' : 'hsl(var(--brand-gold))',
            filter: isMono ? undefined : 'drop-shadow(0 1px 1px hsl(var(--brand-gold-dark) / 0.6))',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -45%)',
            position: 'absolute',
          }}
        />
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

export default ShieldLogo;