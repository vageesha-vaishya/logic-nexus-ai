import type { WorkPackageTemplateOption } from './useWorkPackageTemplates';

export type AircraftTemplateFilterInput = {
  aircraftTenantId: string | null | undefined;
  aircraftModelId: string | null | undefined;
  aircraftModelName: string | null | undefined;
  templates: Array<WorkPackageTemplateOption & { value: string; label: string }>;
};

function token(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function filterTemplatesByAircraft(input: AircraftTemplateFilterInput): Array<WorkPackageTemplateOption & { value: string; label: string }> {
  const tenantToken = token(input.aircraftTenantId);
  const aircraftModelIdToken = token(input.aircraftModelId);
  const aircraftModelNameToken = token(input.aircraftModelName);
  if (!tenantToken || (!aircraftModelIdToken && !aircraftModelNameToken)) {
    return [];
  }

  return input.templates.filter((template) => {
    const templateTenantToken = token(template.tenant_id);
    if (!templateTenantToken || templateTenantToken !== tenantToken) {
      return false;
    }

    const templateModelIdToken = token(template.model_id);
    const templateModelNameToken = token(template.aircraft_model);

    if (aircraftModelIdToken && templateModelIdToken) {
      return templateModelIdToken === aircraftModelIdToken;
    }

    if (aircraftModelNameToken && templateModelNameToken) {
      return templateModelNameToken === aircraftModelNameToken;
    }

    if (aircraftModelIdToken && templateModelNameToken) {
      return templateModelNameToken === aircraftModelIdToken;
    }

    if (aircraftModelNameToken && templateModelIdToken) {
      return templateModelIdToken === aircraftModelNameToken;
    }

    return false;
  });
}

