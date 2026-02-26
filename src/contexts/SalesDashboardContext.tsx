import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { CommandCenterModal } from '@/components/sales/modals/CommandCenterModal';
import { AIQuotationModal } from '@/components/sales/modals/AIQuotationModal';

interface SalesDashboardContextType {
  activeView: string;
  setActiveView: (view: string) => void;
  showConfig: boolean;
  setShowConfig: (show: boolean) => void;
  showCommandCenter: boolean;
  setShowCommandCenter: (show: boolean) => void;
  showAIQuote: boolean;
  setShowAIQuote: (show: boolean) => void;
  unreadMessages: number;
  dueActivities: number;
  companyName: string;
  userRole: string;
  handleNavigation: (path: string) => void;
  handleAction: (action: string) => void;
}

const SalesDashboardContext = createContext<SalesDashboardContextType | undefined>(undefined);

export function SalesDashboardProvider({ children }: { children: ReactNode }) {
  const { context } = useCRM();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('quotations');
  const [showConfig, setShowConfig] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [showAIQuote, setShowAIQuote] = useState(false);
  
  // Mock data for initial implementation - replace with real queries later
  const unreadMessages = 3;
  const dueActivities = 5;
  const companyName = context?.franchiseId ? 'Franchise A' : 'SOS Logistics Global';
  const userRole = profile?.role || 'Sales Representative';

  const handleNavigation = (path: string) => {
    navigate(path);
    setActiveView(path);
  };

  const handleAction = (action: string) => {
    console.log(`Action triggered: ${action}`);
    switch (action) {
      case 'config':
        setShowConfig(true);
        break;
      case 'command_center':
        setShowCommandCenter(true);
        break;
      case 'ai_quote':
        setShowAIQuote(true);
        break;
      case 'messages':
        toast.info('Opening Messages Center...');
        break;
      case 'activities':
        toast.info('Opening Activity Dashboard...');
        break;
      default:
        toast.info(`Action: ${action}`);
    }
  };

  return (
    <SalesDashboardContext.Provider value={{
      activeView,
      setActiveView,
      showConfig,
      setShowConfig,
      showCommandCenter,
      setShowCommandCenter,
      showAIQuote,
      setShowAIQuote,
      unreadMessages,
      dueActivities,
      companyName,
      userRole,
      handleNavigation,
      handleAction,
    }}>
      {children}
      <CommandCenterModal />
      <AIQuotationModal />
    </SalesDashboardContext.Provider>
  );
}

export function useSalesDashboard() {
  const context = useContext(SalesDashboardContext);
  if (context === undefined) {
    throw new Error('useSalesDashboard must be used within a SalesDashboardProvider');
  }
  return context;
}
