export type ContainerCategory = 'Standard' | 'Reefer' | 'Specialized' | 'Tank' | 'Flat Rack' | 'Open Top';

export interface ContainerType {
  id: string;
  tenant_id?: string; // Null for global types
  code: string; // ISO 6346 Code (e.g., 22G1)
  name: string; // e.g., 20' General Purpose
  category: ContainerCategory;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContainerSize {
  id: string;
  container_type_id: string; // Foreign Key
  length_ft: number; // e.g., 20, 40, 45
  height_ft?: number; // e.g., 8.5, 9.5 (High Cube)
  width_ft?: number; // Standard is usually 8
  
  // Internal Dimensions (mm)
  internal_length_mm: number;
  internal_width_mm: number;
  internal_height_mm: number;
  
  // Door Opening (mm)
  door_width_mm: number;
  door_height_mm: number;
  
  // Capacity
  capacity_cbm: number;
  max_payload_kg: number;
  tare_weight_kg: number;
  
  // Stacking
  max_stack_weight_kg?: number;
  
  // Attributes
  is_high_cube: boolean;
  is_pallet_wide: boolean;
  
  created_at?: string;
  updated_at?: string;
}

// Composite type for UI display
export interface ContainerConfiguration extends ContainerType {
  specifications: ContainerSize;
}
