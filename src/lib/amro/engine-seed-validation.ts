export type FlightPhase = 'takeoff' | 'climb' | 'cruise' | 'descent' | 'landing';

export type EngineParameterName =
  | 'egt_c'
  | 'n1_pct'
  | 'n2_pct'
  | 'fuel_flow_lbh'
  | 'vibration_ips'
  | 'thrust_takeoff_lbf'
  | 'thrust_cruise_lbf'
  | 'sfc_lbf_per_lbf_hr'
  | 'oil_pressure_psi'
  | 'efficiency_pct';

const parameterRanges: Record<EngineParameterName, { min: number; max: number }> = {
  egt_c: { min: 350, max: 980 },
  n1_pct: { min: 18, max: 110 },
  n2_pct: { min: 45, max: 110 },
  fuel_flow_lbh: { min: 1200, max: 9200 },
  vibration_ips: { min: 0, max: 4.5 },
  thrust_takeoff_lbf: { min: 25000, max: 35000 },
  thrust_cruise_lbf: { min: 5000, max: 8000 },
  sfc_lbf_per_lbf_hr: { min: 0.35, max: 0.55 },
  oil_pressure_psi: { min: 40, max: 120 },
  efficiency_pct: { min: 70, max: 100 },
};

export const isEngineParameterName = (value: string): value is EngineParameterName =>
  value in parameterRanges;

export const validateEngineParameterRange = (parameterName: string, value: number): boolean => {
  if (!isEngineParameterName(parameterName)) {
    return true;
  }

  const range = parameterRanges[parameterName];
  return value >= range.min && value <= range.max;
};

export const validateAviationIdentifiers = (
  partNumber: string | null,
  serialNumber: string | null,
  regulatoryReference: string | null
): boolean => {
  const partPattern = /^[A-Z0-9]{2,10}(?:-[A-Z0-9]{1,10}){1,5}$/;
  const serialPattern = /^[A-Z0-9]{2,12}(?:-[A-Z0-9]{1,12}){2,6}$/;
  const regulatoryPattern = /^(AD|SB)-[A-Z0-9]{2,12}-[0-9]{2,6}$/;

  if (partNumber && !partPattern.test(partNumber)) {
    return false;
  }
  if (serialNumber && !serialPattern.test(serialNumber)) {
    return false;
  }
  if (regulatoryReference && !regulatoryPattern.test(regulatoryReference)) {
    return false;
  }

  return true;
};

export const validateMaintenanceChronology = (orderedIsoTimestamps: string[]): boolean => {
  for (let index = 1; index < orderedIsoTimestamps.length; index += 1) {
    const prev = new Date(orderedIsoTimestamps[index - 1]).getTime();
    const current = new Date(orderedIsoTimestamps[index]).getTime();
    if (Number.isNaN(prev) || Number.isNaN(current) || current < prev) {
      return false;
    }
  }
  return true;
};

export const validateFlightPhase = (value: string): value is FlightPhase =>
  value === 'takeoff' ||
  value === 'climb' ||
  value === 'cruise' ||
  value === 'descent' ||
  value === 'landing';

export type ComponentNode = {
  id: string;
  parentId: string | null;
};

export const validateComponentHierarchy = (nodes: ComponentNode[]): boolean => {
  const ids = new Set(nodes.map((node) => node.id));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const childrenByParent = new Map<string | null, string[]>();

  for (const node of nodes) {
    if (node.parentId && !ids.has(node.parentId)) {
      return false;
    }
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }

  const hasCycle = (id: string): boolean => {
    if (inStack.has(id)) {
      return true;
    }
    if (visited.has(id)) {
      return false;
    }

    visited.add(id);
    inStack.add(id);

    const children = childrenByParent.get(id) ?? [];
    for (const childId of children) {
      if (hasCycle(childId)) {
        return true;
      }
    }

    inStack.delete(id);
    return false;
  };

  for (const node of nodes) {
    if (hasCycle(node.id)) {
      return false;
    }
  }

  return true;
};
