import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { validateStage } from './PipelineValidator';

export type PipelineStage = 
  | 'QuickQuote' 
  | 'QuoteNew' 
  | 'DetailedQuote' 
  | 'Composer' 
  | 'PDFGen'
  | 'Custom';

export interface DataSnapshot {
  id: string;
  stage: PipelineStage;
  timestamp: number;
  data: any;
  metadata?: Record<string, any>;
  diff?: any; // To be computed against previous snapshot
  validation?: { valid: boolean; errors: any[] };
}

interface PipelineContextType {
  snapshots: DataSnapshot[];
  capture: (stage: PipelineStage, data: any, metadata?: any) => void;
  updateSnapshot: (id: string, data: any) => void;
  clear: () => void;
  isOpen: boolean;
  toggleDashboard: () => void;
  exportData: () => string;
}

const PipelineContext = createContext<PipelineContextType | undefined>(undefined);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<DataSnapshot[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const capture = useCallback((stage: PipelineStage, data: any, metadata?: any) => {
    const validation = validateStage(stage, data);
    setSnapshots(prev => {
      const newSnapshot: DataSnapshot = {
        id: uuidv4(),
        stage,
        timestamp: Date.now(),
        data: JSON.parse(JSON.stringify(data)), // Deep copy to prevent reference issues
        metadata,
        validation
      };
      return [...prev, newSnapshot];
    });
  }, []);

  const updateSnapshot = useCallback((id: string, newData: any) => {
    setSnapshots(prev => prev.map(s => {
      if (s.id === id) {
        // Re-validate on update
        const validation = validateStage(s.stage, newData);
        return {
          ...s,
          data: JSON.parse(JSON.stringify(newData)),
          validation,
          metadata: { ...s.metadata, modified: true, modifiedAt: Date.now() }
        };
      }
      return s;
    }));
  }, []);

  const clear = useCallback(() => {
    setSnapshots([]);
  }, []);

  const toggleDashboard = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const exportData = useCallback(() => {
    return JSON.stringify(snapshots, null, 2);
  }, [snapshots]);

  return (
    <PipelineContext.Provider value={{ snapshots, capture, updateSnapshot, clear, isOpen, toggleDashboard, exportData }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  const context = useContext(PipelineContext);
  if (context === undefined) {
    throw new Error('usePipeline must be used within a PipelineProvider');
  }
  return context;
}
