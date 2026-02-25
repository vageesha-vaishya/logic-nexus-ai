import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import React from 'react';

const Tabs = TabsPrimitive.Root;
const TabsList = TabsPrimitive.List;
const TabsTrigger = TabsPrimitive.Trigger;
const TabsContent = TabsPrimitive.Content;

export function EnterpriseNotebook({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <Tabs defaultValue="tab1" className={cn("w-full flex flex-col mt-6 border-t", className)}>
            <TabsList className="flex items-center gap-6 border-b bg-muted/20 px-6 py-2">
                {React.Children.map(children, (child: any) => {
                    if (!child) return null;
                    return (
                        <TabsTrigger 
                            key={child.props.value} 
                            value={child.props.value}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-all"
                        >
                            {child.props.label}
                        </TabsTrigger>
                    );
                })}
            </TabsList>
            <div className="p-6">
                {children}
            </div>
        </Tabs>
    );
}

export function EnterpriseTab({ children, value }: { children: React.ReactNode, label: string, value: string }) {
    return (
        <TabsContent value={value} className="focus:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
        </TabsContent>
    );
}
