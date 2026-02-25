import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, LayoutGrid, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface EnterpriseFormLayoutProps {
  breadcrumbs: Breadcrumb[];
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  status?: string;
}

export function EnterpriseFormLayout({ breadcrumbs, title, actions, children, className, status }: EnterpriseFormLayoutProps) {
  return (
    <div className={cn("flex flex-col h-full bg-[#f9fafb]", className)}>
      {/* Top Navigation Bar (Purple Header in screenshot) */}
      <div className="bg-[#714B67] text-white px-4 h-12 flex items-center justify-between shadow-md shrink-0 z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-medium cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors">
            <LayoutGrid className="h-5 w-5" />
            <span>{breadcrumbs[0]?.label || 'App'}</span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <span className="opacity-90 hover:opacity-100 cursor-pointer">Contacts</span>
            <span className="opacity-70 hover:opacity-100 cursor-pointer">Configuration</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
           {/* Placeholder for user/chat/activities */}
           <div className="flex items-center gap-3 text-sm">
             <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">7</span>
             <span className="bg-gray-500 text-white text-xs px-1.5 py-0.5 rounded-full">14</span>
             <div className="w-8 h-8 bg-purple-800 rounded-full flex items-center justify-center text-xs">US</div>
           </div>
        </div>
      </div>

      {/* Action Bar (White sub-header) */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between sticky top-0 z-20 shadow-sm h-14 shrink-0">
        <div className="flex items-center gap-4">
          <Button className="bg-[#714B67] hover:bg-[#5d3d54] text-white shadow-sm h-8 px-4 text-sm font-medium rounded-md">
            New
          </Button>
          <div className="h-6 w-px bg-gray-300 mx-2" />
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-primary transition-colors text-gray-900 font-medium">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-500">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
           {/* Search Box Placeholder */}
           <div className="relative w-64 hidden md:block">
             <input 
               type="text" 
               placeholder="Search..." 
               className="w-full pl-8 pr-3 py-1 text-sm border-b border-gray-300 focus:border-[#714B67] focus:outline-none bg-transparent"
             />
             <Search className="h-4 w-4 absolute left-0 top-1.5 text-gray-400" />
           </div>

           {/* Pagination Controls */}
           <div className="flex items-center gap-2 text-sm text-gray-600 border-l pl-4 ml-2">
             <span>1 / 1</span>
             <div className="flex items-center">
               <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100" disabled>
                 <ChevronLeft className="h-4 w-4" />
               </Button>
               <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100" disabled>
                 <ChevronRight className="h-4 w-4" />
               </Button>
             </div>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50/50">
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-6 h-full items-stretch">
            {children}
        </div>
      </div>
    </div>
  );
}
