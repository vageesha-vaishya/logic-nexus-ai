import { z } from "zod"

export const EventNameSchema = z.enum(["QuoteCreated", "OptionAdded", "PdfGenerated", "EmailSent"])

export const EventPayloadSchema = z.object({
  trace_id: z.string().min(8).optional(),
  idempotency_key: z.string().min(8).optional(),
  schema_id: z.number().optional(),
  quote_id: z.string().min(1).optional(),
  version_id: z.string().min(1).optional(),
  option_id: z.string().min(1).optional(),
  email_id: z.string().min(1).optional(),
  meta: z.record(z.any()).optional()
}).passthrough()

export const EmitEventSchema = z.object({
  eventName: EventNameSchema,
  payload: EventPayloadSchema
})

export type EventName = z.infer<typeof EventNameSchema>
export type EventPayload = z.infer<typeof EventPayloadSchema>
