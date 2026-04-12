/**
 * Template API Functions
 * Centralized API calls for template management
 */

export interface TaskTemplateOption {
  id: string;
  sequence: string;
  code_form_no: string;
  ata_code: string;
  reference_amp: string;
  description: string;
  category_code: string;
  estimated_man_hours: number;
  is_mandatory: boolean;
}

export async function fetchTaskTemplates(
  accessToken: string,
  tenantId: string,
  aircraftModelId?: string
): Promise<TaskTemplateOption[]> {
  const query = new URLSearchParams({ tenant_id: tenantId });
  if (aircraftModelId) query.set('aircraft_model_id', aircraftModelId);

  const response = await fetch(`/api/v2/amro/work-package-templates/task-template-options?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return [];
  const json = await response.json();
  const records = json.data || json.output?.records || [];
  return (Array.isArray(records) ? records : []).map((r: any) => ({
    id: String(r.id || r.task_template_id || ''),
    sequence: String(r.sequence || r.tt_sequence || ''),
    code_form_no: String(r.code_form_no || r.code || ''),
    ata_code: String(r.ata_code || r.ata || ''),
    reference_amp: String(r.reference_amp || r.ref_amp || ''),
    description: String(r.description || r.desc || ''),
    category_code: String(r.category_code || r.category || ''),
    estimated_man_hours: Number(r.estimated_man_hours || r.est_hours || 0),
    is_mandatory: Boolean(r.is_mandatory ?? r.mandatory),
  }));
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  version_label: string | null;
  change_description: string;
  status: string;
  tasks_json: any[];
  materials_json: any[];
  tooling_json: any[];
  compliance_requirements_json: any[];
  estimated_labor_hours: number | null;
  created_at: string;
  updated_at: string;
}

export async function fetchTemplateVersions(
  accessToken: string,
  templateId: string
): Promise<TemplateVersion[]> {
  const response = await fetch(`/api/v2/amro/work-package-template-versions?template_id=${templateId}&page=1&page_size=50`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return [];
  const json = await response.json();
  return json.output?.records || json.output?.versions || json.data || [];
}

export async function createTemplateVersion(
  accessToken: string,
  templateId: string,
  data: {
    change_description: string;
    change_reason?: string;
    version_label?: string;
    tasks_json?: any[];
    materials_json?: any[];
    tooling_json?: any[];
    compliance_requirements_json?: any[];
  }
): Promise<TemplateVersion> {
  const response = await fetch('/api/v2/amro/work-package-template-versions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ template_id: templateId, ...data }),
  });
  if (!response.ok) throw new Error(`Failed to create version: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export async function updateTemplateVersion(
  accessToken: string,
  versionId: string,
  data: Record<string, unknown>
): Promise<TemplateVersion> {
  const response = await fetch(`/api/v2/amro/work-package-template-versions/${versionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Failed to update version: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export async function submitTemplateVersion(
  accessToken: string,
  versionId: string
): Promise<void> {
  const response = await fetch(`/api/v2/amro/work-package-template-versions/${versionId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to submit for review: ${response.status}`);
}

export async function reviewTemplateVersion(
  accessToken: string,
  versionId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string,
  setActive?: boolean
): Promise<void> {
  const response = await fetch(`/api/v2/amro/work-package-template-versions/${versionId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, rejection_reason: rejectionReason, set_active: setActive }),
  });
  if (!response.ok) throw new Error(`Failed to review version: ${response.status}`);
}

export async function deleteTemplateVersion(
  accessToken: string,
  versionId: string
): Promise<void> {
  const response = await fetch(`/api/v2/amro/work-package-template-versions/${versionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to delete version: ${response.status}`);
}

export async function cloneTemplate(
  accessToken: string,
  templateId: string,
  newCode: string,
  newName: string
): Promise<void> {
  // First get the template details
  const getResponse = await fetch(`/api/v2/amro/master-data/work_package_templates/${templateId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!getResponse.ok) throw new Error(`Failed to fetch template: ${getResponse.status}`);
  const templateData = await getResponse.json();
  const template = templateData.data || templateData.output;

  // Create new template with copied data
  const payload = {
    template_code: newCode,
    template_name: newName,
    description: template.description || `Clone of ${template.template_name}`,
    maintenance_type: template.maintenance_type,
    model_id: template.model_id,
    aircraft_model: template.aircraft_model,
    version: 1,
    active: false,
    scope_json: template.scope_json,
    tasks_json: template.tasks_json,
    materials_json: template.materials_json,
    tooling_json: template.tooling_json,
    compliance_requirements_json: template.compliance_requirements_json,
  };

  const response = await fetch('/api/v2/amro/master-data/work_package_templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Failed to clone template: ${response.status}`);
}
