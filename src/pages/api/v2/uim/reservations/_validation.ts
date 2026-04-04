export class ReservationValidationError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown> | null;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ReservationValidationError';
    this.code = code;
    this.details = details || null;
  }
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function assertRequiredString(value: unknown, field: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new ReservationValidationError(`${field} is required`, 'UIM_VALIDATION_REQUIRED_FIELD', {
      field,
    });
  }
  return normalized;
}

function assertPositiveQuantity(value: unknown): number {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ReservationValidationError('quantity must be a positive number', 'UIM_VALIDATION_INVALID_QUANTITY', {
      field: 'quantity',
      received: value ?? null,
    });
  }
  return quantity;
}

function assertIsoDate(value: unknown, field: string): string {
  const normalized = assertRequiredString(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new ReservationValidationError(`${field} must be a valid ISO date`, 'UIM_VALIDATION_INVALID_DATE', {
      field,
      received: normalized,
    });
  }
  return normalized;
}

export function validateSoftReservationPayload(body: unknown): {
  catalogItemId: string;
  quantity: number;
  expectedUseDate: string;
  referencedModule: string | null;
  referencedRecordId: string | null;
} {
  const payload = parseBody(body);
  const catalogItemId = assertRequiredString(payload.catalog_item_id, 'catalog_item_id');
  const quantity = assertPositiveQuantity(payload.quantity);
  const expectedUseDate = assertIsoDate(payload.expected_use_date, 'expected_use_date');
  const referencedModule = String(payload.referenced_module || '').trim() || null;
  const referencedRecordId = String(payload.referenced_record_id || '').trim() || null;
  return {
    catalogItemId,
    quantity,
    expectedUseDate,
    referencedModule,
    referencedRecordId,
  };
}

export function validateReservationStatusPayload(body: unknown): 'fulfilled' | 'cancelled' {
  const payload = parseBody(body);
  const normalized = String(payload.status || '').trim().toLowerCase();
  if (normalized === 'fulfilled' || normalized === 'cancelled') return normalized;
  throw new ReservationValidationError('status must be fulfilled or cancelled', 'UIM_VALIDATION_INVALID_STATUS', {
    field: 'status',
    allowed: ['fulfilled', 'cancelled'],
    received: payload.status ?? null,
  });
}
