import { ReactNode } from 'react';

export type WidgetType = 
  | 'stats' 
  | 'leads' 
  | 'activities' 
  | 'accounts' 
  | 'contacts' 
  | 'quotes' 
  | 'opportunities' 
  | 'shipments'
  | 'transfers'
  | 'custom_chart'
  | 'insights';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  order: number;
  settings?: Record<string, any>; // Specific settings per widget type (e.g., limit, filter)
}

export interface WidgetProps {
  config: WidgetConfig;
  onRemove: (id: string) => void;
  onEdit: (id: string, newConfig: Partial<WidgetConfig>) => void;
  isEditMode: boolean;
}

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  description: string;
  defaultSize: WidgetSize;
  component: React.ComponentType<WidgetProps>;
  defaultSettings?: Record<string, any>;
}
