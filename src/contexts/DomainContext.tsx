import React, { createContext, useContext, useEffect, useState } from 'react';
import { DomainService, PlatformDomain } from '../services/DomainService';
import { toast } from 'sonner';

interface DomainContextType {
  currentDomain: PlatformDomain | null;
  setDomain: (code: string) => Promise<void>;
  availableDomains: PlatformDomain[];
  isLoading: boolean;
}

const DomainContext = createContext<DomainContextType | undefined>(undefined);

export function DomainContextProvider({ children }: { children: React.ReactNode }) {
  const [currentDomain, setCurrentDomainState] = useState<PlatformDomain | null>(null);
  const [availableDomains, setAvailableDomains] = useState<PlatformDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setIsLoading(true);
      const domains = await DomainService.getAllDomains();
      setAvailableDomains(domains);

      // Restore from localStorage or default to Logistics
      const savedCode = localStorage.getItem('active_domain_code');
      const targetDomain = 
        domains.find(d => d.code === savedCode) || 
        domains.find(d => d.code === 'LOGISTICS') || 
        domains[0];

      if (targetDomain) {
        setCurrentDomainState(targetDomain);
      }
    } catch (error) {
      console.error('Failed to load domains:', error);
      toast.error('Failed to load platform domains');
    } finally {
      setIsLoading(false);
    }
  };

  const setDomain = async (code: string) => {
    const domain = availableDomains.find(d => d.code === code);
    if (domain) {
      setCurrentDomainState(domain);
      localStorage.setItem('active_domain_code', code);
      toast.success(`Switched to ${domain.name}`);
      
      // Optional: Force reload to clear any stale state from other domains
      // window.location.reload(); 
    } else {
      console.warn(`Domain ${code} not found`);
    }
  };

  return (
    <DomainContext.Provider value={{ currentDomain, setDomain, availableDomains, isLoading }}>
      {children}
    </DomainContext.Provider>
  );
}

export function useDomain() {
  const context = useContext(DomainContext);
  if (context === undefined) {
    throw new Error('useDomain must be used within a DomainContextProvider');
  }
  return context;
}
