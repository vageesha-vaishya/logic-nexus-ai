export type Conflict = { code: string; message: string };

export function buildShipmentsMatrix(perms: string[]) {
  const has = (p: string) => perms.includes(p);
  const matrix = {
    core: {
      view: has('shipments.view'),
      create: has('shipments.create'),
      edit: has('shipments.edit'),
      delete: has('shipments.delete'),
    },
    approvals: {
      view: has('shipments.approvals.view'),
      manage: has('shipments.approvals.manage'),
    },
    reports: {
      view: has('shipments.reports.view'),
      manage: has('shipments.reports.manage'),
    },
    config: {
      manage: has('shipments.config.manage'),
    },
    audit: {
      view: has('shipments.audit.view'),
      manage: has('shipments.audit.manage'),
    },
  };
  return matrix;
}

export function detectConflicts(perms: string[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const has = (p: string) => perms.includes(p);
  if (has('shipments.delete') && !has('shipments.view')) {
    conflicts.push({ code: 'DELETE_WITHOUT_VIEW', message: 'Delete requires view for shipments.' });
  }
  if (has('shipments.edit') && !has('shipments.view')) {
    conflicts.push({ code: 'EDIT_WITHOUT_VIEW', message: 'Edit requires view for shipments.' });
  }
  if (has('shipments.approvals.manage') && has('shipments.create')) {
    conflicts.push({ code: 'SOD_CREATE_APPROVE', message: 'Separation of duties: cannot both create and approve shipments.' });
  }
  if (has('shipments.config.manage') && has('shipments.audit.manage')) {
    conflicts.push({ code: 'SOD_CONFIG_AUDIT', message: 'Separation of duties: config and audit should not be combined.' });
  }
  return conflicts;
}

export function isSensitiveChange(permsBefore: string[], permsAfter: string[]) {
  const sensitive = [
    'shipments.approvals.manage',
    'shipments.reports.manage',
    'shipments.config.manage',
    'shipments.audit.manage',
  ];
  const before = new Set(permsBefore);
  return permsAfter.some(p => sensitive.includes(p) && !before.has(p));
}
