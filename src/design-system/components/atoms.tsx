import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Info, Link2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CRMVariant = 'primary' | 'secondary' | 'danger';
export type CRMViewport = 'mobile' | 'tablet' | 'desktop';

const viewportClassMap: Record<CRMViewport, string> = {
  mobile: 'text-xs px-2 py-1',
  tablet: 'text-sm px-3 py-1.5',
  desktop: 'text-sm px-4 py-2'
};

const variantClassMap: Record<CRMVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/85',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
};

const iconMap: Record<string, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  danger: AlertTriangle,
  link: Link2
};

export interface CRMButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMButton = forwardRef<HTMLButtonElement, CRMButtonProps>(
  ({ variant = 'primary', viewport = 'desktop', className, type = 'button', ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      className={cn(variantClassMap[variant], viewportClassMap[viewport], className)}
      aria-label={props['aria-label'] || props.title}
      {...props}
    />
  )
);

CRMButton.displayName = 'CRMButton';

export interface CRMIconProps extends HTMLAttributes<HTMLSpanElement> {
  name?: keyof typeof iconMap;
  size?: number;
  variant?: CRMVariant;
}

export const CRMIcon = forwardRef<HTMLSpanElement, CRMIconProps>(
  ({ name = 'info', size = 16, variant = 'primary', className, ...props }, ref) => {
    const IconComponent = iconMap[name] || Info;
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md',
          variant === 'primary' && 'text-primary',
          variant === 'secondary' && 'text-muted-foreground',
          variant === 'danger' && 'text-destructive',
          className
        )}
        role="img"
        aria-label={props['aria-label'] || `${name} icon`}
        {...props}
      >
        <IconComponent size={size} />
      </span>
    );
  }
);

CRMIcon.displayName = 'CRMIcon';

export interface CRMLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMLink = forwardRef<HTMLAnchorElement, CRMLinkProps>(
  ({ variant = 'primary', viewport = 'desktop', className, onKeyDown, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'primary' && 'text-primary hover:text-primary/80',
        variant === 'secondary' && 'text-muted-foreground hover:text-foreground',
        variant === 'danger' && 'text-destructive hover:text-destructive/80',
        viewport === 'mobile' && 'text-xs',
        viewport === 'tablet' && 'text-sm',
        viewport === 'desktop' && 'text-base',
        className
      )}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.preventDefault();
          (event.currentTarget as HTMLAnchorElement).click();
        }
        onKeyDown?.(event);
      }}
      {...props}
    />
  )
);

CRMLink.displayName = 'CRMLink';

export interface CRMBadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMBadge = forwardRef<HTMLDivElement, CRMBadgeProps>(
  ({ variant = 'primary', viewport = 'desktop', className, ...props }, ref) => (
    <Badge
      ref={ref}
      className={cn(
        variant === 'primary' && 'bg-primary text-primary-foreground',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground',
        variant === 'danger' && 'bg-destructive text-destructive-foreground',
        viewport === 'mobile' && 'text-[10px]',
        viewport === 'tablet' && 'text-xs',
        viewport === 'desktop' && 'text-sm',
        className
      )}
      aria-label={props['aria-label'] || 'status badge'}
      {...props}
    />
  )
);

CRMBadge.displayName = 'CRMBadge';
