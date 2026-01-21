# AI Quick Quote Module Architecture

## Overview
The **AI Quick Quote Module** is a high-performance, intelligent quotation system designed to provide instant, multi-modal transport quotes with detailed cost breakdowns. It leverages Large Language Models (LLMs) to analyze route data, predict dynamic pricing, and ensure regulatory compliance.

## Architecture

### High-Level Design
The system follows a microservices-based architecture using **Supabase Edge Functions** as the compute layer.

```mermaid
graph TD
    Client[Client UI (React)] -->|Request Quote| Gateway[Supabase Gateway]
    Gateway -->|Auth & Rate Limit| EdgeFn[Edge Function: ai-advisor]
    EdgeFn -->|Check Cache| Cache[(Supabase DB: ai_quote_cache)]
    EdgeFn -->|Generate Quote| LLM[OpenAI GPT-4o]
    EdgeFn -->|Fetch Rates| RateEngine[Legacy Rate Engine]
    EdgeFn -->|Store Result| Cache
    Client -->|View Details| UI_Components[QuoteDetailView & Visualizer]
```

### Components

1.  **Frontend (React)**:
    *   `QuickQuoteModal`: Main entry point and form state management.
    *   `QuoteResultsList`: Displays list of quotes with "Expand Details" capability.
    *   `QuoteDetailView`: Detailed breakdown of costs (Pie Chart), legs, and compliance info.
    *   `QuoteLegsVisualizer`: Visual representation of transport legs with border crossing alerts.

2.  **Backend (Edge Functions)**:
    *   `ai-advisor`: Core logic for:
        *   **Smart Quote Generation**: Generates 5 distinct options (Best Value, Cheapest, Fastest, Greenest, Reliable).
        *   **Dynamic Pricing**: Applies real-time surcharges (Fuel, Security) and currency buffers.
        *   **Route Segmentation**: Breaks down routes into specific legs (e.g., Truck -> Ocean -> Truck).
        *   **Caching**: Implements a 24-hour TTL cache to minimize LLM costs and latency.
    *   `rate-engine`: Legacy system for contract rates (fallback).

3.  **Database (PostgreSQL)**:
    *   `ai_quote_cache`: Stores generated quotes for rapid retrieval.
        *   Columns: `id`, `request_hash`, `response_payload`, `expires_at`.
        *   RLS: Secure access policies.

## API Reference

### Endpoint: `ai-advisor`

**POST** `/functions/v1/ai-advisor`

**Headers**:
*   `Authorization`: `Bearer <USER_TOKEN>`
*   `Content-Type`: `application/json`

**Body**:
```json
{
  "action": "generate_smart_quotes",
  "payload": {
    "origin": "USLAX",
    "destination": "CNSHA",
    "mode": "ocean",
    "commodity": "Electronics",
    "weight": "500",
    "unit": "kg"
  }
}
```

**Response**:
```json
{
  "options": [
    {
      "id": "uuid",
      "tier": "best_value",
      "price_breakdown": {
        "base_fare": 1200,
        "surcharges": { "fuel": 150 },
        "taxes": 50,
        "total": 1400
      },
      "legs": [
        { "from": "USLAX", "to": "CNSHA", "mode": "ocean", "border_crossing": true }
      ],
      "reliability": { "score": 9, "on_time_performance": "98%" }
    }
  ]
}
```

## Model Selection & Logic
The system uses **GPT-4o** for its balance of reasoning capability and speed.
*   **Prompt Engineering**: The system prompt enforces strict JSON output and includes logic for "Border Crossing" detection.
*   **Latency target**: < 3s per request (achieved via caching and parallel execution).
*   **Precision**: Validated via strict Zod schemas on the client side.

## Compliance & Security
*   **Audit Logging**: All quote generations are implicitly logged via the `ai_quote_cache` creation timestamp. For strict audit trails, a trigger can be added to archive expired cache entries to a `quote_history` table.
*   **GDPR**: No PII is sent to the LLM; only location codes and commodity names.
*   **WCAG 2.1 AA**: UI components use high-contrast colors and ARIA labels (via `recharts` and `radix-ui` primitives).

## Setup & Testing
1.  **Environment Variables**:
    *   `OPENAI_API_KEY`: Required for `ai-advisor`.
    *   `SUPABASE_URL` / `SUPABASE_ANON_KEY`: For client connection.

2.  **Running Tests**:
    *   Use `scripts/test-ai-advisor.cjs` to verify Edge Function output.
    *   Run `npm test` for frontend component tests (if configured).

## Future Improvements
*   **Redis Caching**: Replace Postgres cache with Redis for sub-millisecond access.
*   **Multi-Model Fallback**: Implement fallback to GPT-3.5-turbo or Claude if GPT-4o is unavailable.
