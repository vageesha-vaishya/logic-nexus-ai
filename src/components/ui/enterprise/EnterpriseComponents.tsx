import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface EnterpriseSheetProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  actions?: React.ReactNode;
  smartButtons?: React.ReactNode;
}

export function EnterpriseSheet({ children, className, header, actions, smartButtons }: EnterpriseSheetProps) {
  return (
    <div className="flex-1 flex flex-col gap-0 w-full min-h-full">
      {/* Smart Buttons Row (Above Sheet) */}
      {smartButtons && (
         <div className="flex items-center justify-end gap-2 mb-[-1px] z-10 relative px-2">
             {smartButtons}
         </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
            "bg-card border border-border rounded-sm shadow-[0_1px_4px_rgba(0,0,0,0.05)] flex flex-col relative overflow-visible",
            "min-h-[600px]",
            className
        )}
      >
        {/* Main Content */}
        <div className="flex flex-col h-full">
            {/* Header Section */}
            {header && (
                <div className="p-6 md:p-8 pb-4 border-b border-border">
                    <div className="flex flex-col md:flex-row gap-8">
                        {header}
                    </div>
                </div>
            )}

            {/* Body */}
            <div className="flex-1 p-0">
                {children}
            </div>
        </div>
      </motion.div>
    </div>
  );
}

interface EnterpriseFieldProps {
    label: string;
    value?: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
    colSpan?: number; // 1 or 2
}

export function EnterpriseField({ label, value, icon, className, colSpan = 1 }: EnterpriseFieldProps) {
    return (
        <div className={cn("flex flex-col gap-0.5 mb-3", className, colSpan === 2 ? "col-span-2" : "")}>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                {icon && <span className="text-muted-foreground">{icon}</span>}
                {label}
            </div>
            <div className="text-[13px] text-foreground min-h-[20px] leading-snug">
                {value || <span className="text-muted-foreground italic">Empty</span>}
            </div>
        </div>
    );
}

interface EnterpriseStatButtonProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    to?: string;
    onClick?: () => void;
}

export function EnterpriseStatButton({ icon, label, value, to, onClick }: EnterpriseStatButtonProps) {
    const content = (
        <button 
            onClick={onClick}
            className="flex flex-col items-center justify-center min-w-[100px] h-[60px] bg-card border border-border border-b-0 rounded-t-md hover:bg-muted/50 transition-all relative top-[1px] shadow-[0_-1px_2px_rgba(0,0,0,0.02)]"
        >
            <div className="flex items-center gap-2 text-muted-foreground mb-0.5">
                <span className="text-muted-foreground scale-90">{icon}</span>
                <span className="text-[11px] font-semibold uppercase tracking-tight">{label}</span>
            </div>
            <span className="text-lg font-bold text-primary leading-none">{value}</span>
        </button>
    );

    if (to) {
        return <Link to={to}>{content}</Link>;
    }
    return content;
}
