import { WidgetSize } from '@/types/dashboardTemplates';
import React from 'react';

export interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  defaultSize: WidgetSize;
  module: 'crm' | 'logistics' | 'sales' | 'shared';
  icon?: React.ReactNode;
  component: React.ComponentType<{ settings?: Record<string, any> }>;
}

const widgetRegistry: Map<string, WidgetDefinition> = new Map();

export function registerWidget(definition: WidgetDefinition) {
  widgetRegistry.set(definition.type, definition);
}

export function getWidget(type: string): WidgetDefinition | undefined {
  return widgetRegistry.get(type);
}

export function getAllWidgets(): WidgetDefinition[] {
  return Array.from(widgetRegistry.values());
}

export function getWidgetsByModule(module: string): WidgetDefinition[] {
  return Array.from(widgetRegistry.values()).filter(
    w => w.module === module || w.module === 'shared'
  );
}
