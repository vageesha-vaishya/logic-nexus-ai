# SOS Logic Nexus AI — Comprehensive AI/LLM/RAG Implementation Specification

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Implementation Specification (Draft)
**Classification:** Internal — Technical Architecture Document
**Author:** AI Architecture Team
**Companion Document:** `docs/NEXT_GEN_PLATFORM_STRATEGY.md` (Strategic Roadmap v1.0)

---

## Document Revision History

| Version | Date       | Author       | Changes                                    |
|---------|------------|--------------|--------------------------------------------|
| 1.0     | 2026-02-07 | AI Arch Team | Initial comprehensive specification        |

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
  - [1.1 Purpose & Scope](#11-purpose--scope)
  - [1.2 Current AI Maturity Assessment](#12-current-ai-maturity-assessment)
  - [1.3 Target State Vision](#13-target-state-vision)
  - [1.4 Key Metrics Summary](#14-key-metrics-summary)
- [2. Current State: AI Capabilities Inventory](#2-current-state-ai-capabilities-inventory)
  - [2.1 Production AI Edge Functions (9 Functions)](#21-production-ai-edge-functions-9-functions)
  - [2.2 Frontend AI Integration Points](#22-frontend-ai-integration-points)
  - [2.3 AI Database Tables](#23-ai-database-tables)
  - [2.4 Models Currently Deployed](#24-models-currently-deployed)
  - [2.5 Known Limitations & Gaps](#25-known-limitations--gaps)
- [3. Technical Architecture](#3-technical-architecture)
  - [3.1 RAG Architecture Design](#31-rag-architecture-design)
  - [3.2 Vector Database Strategy (pgvector)](#32-vector-database-strategy-pgvector)
  - [3.3 Embedding Model Selection](#33-embedding-model-selection)
  - [3.4 LLM Provider Strategy & Model Routing](#34-llm-provider-strategy--model-routing)
  - [3.5 Function Calling & Tool Use Architecture](#35-function-calling--tool-use-architecture)
  - [3.6 Chunking Strategies by Document Type](#36-chunking-strategies-by-document-type)
  - [3.7 Caching & Performance Architecture](#37-caching--performance-architecture)
  - [3.8 Multi-Tenant AI Isolation](#38-multi-tenant-ai-isolation)
- [4. Logistics Platform — AI Implementation Strategies](#4-logistics-platform--ai-implementation-strategies)
  - [4.1 Shipment Management AI](#41-shipment-management-ai)
  - [4.2 Warehouse Management AI](#42-warehouse-management-ai)
  - [4.3 Inventory & Container Tracking AI](#43-inventory--container-tracking-ai)
  - [4.4 Route Optimization & Transport Mode AI](#44-route-optimization--transport-mode-ai)
  - [4.5 Supply Chain Visibility & Predictive Analytics](#45-supply-chain-visibility--predictive-analytics)
  - [4.6 Fleet Management AI](#46-fleet-management-ai)
  - [4.7 Order Fulfillment & Quote-to-Cash AI](#47-order-fulfillment--quote-to-cash-ai)
  - [4.8 Demand Forecasting AI](#48-demand-forecasting-ai)
  - [4.9 Compliance & Customs AI](#49-compliance--customs-ai)
  - [4.10 Dynamic Pricing & Rate Intelligence](#410-dynamic-pricing--rate-intelligence)
- [5. CRM Platform — AI Implementation Strategies](#5-crm-platform--ai-implementation-strategies)
  - [5.1 Predictive Lead Scoring](#51-predictive-lead-scoring)
  - [5.2 Intelligent Email Classification & NLP](#52-intelligent-email-classification--nlp)
  - [5.3 Smart Lead Assignment & Routing](#53-smart-lead-assignment--routing)
  - [5.4 Deal Health & Pipeline Forecasting](#54-deal-health--pipeline-forecasting)
  - [5.5 Customer Portal Intelligence](#55-customer-portal-intelligence)
  - [5.6 Dynamic Customer Segmentation](#56-dynamic-customer-segmentation)
  - [5.7 Activity Intelligence & Auto-Logging](#57-activity-intelligence--auto-logging)
- [6. Platform-Wide AI Features](#6-platform-wide-ai-features)
  - [6.1 RAG-Powered Decision Support ("Nexus Copilot")](#61-rag-powered-decision-support-nexus-copilot)
  - [6.2 Document Automation & OCR Pipeline](#62-document-automation--ocr-pipeline)
  - [6.3 Anomaly Detection & Fraud Prevention](#63-anomaly-detection--fraud-prevention)
  - [6.4 Smart Notifications & Alert Intelligence](#64-smart-notifications--alert-intelligence)
  - [6.5 Semantic Search Upgrade (HTS, Emails, Documents)](#65-semantic-search-upgrade-hts-emails-documents)
  - [6.6 AI-Powered Reporting & Analytics](#66-ai-powered-reporting--analytics)
- [7. Data Flow Diagrams](#7-data-flow-diagrams)
  - [7.1 RAG Query Pipeline](#71-rag-query-pipeline)
  - [7.2 Email Classification Pipeline](#72-email-classification-pipeline)
  - [7.3 Smart Quote Generation Pipeline](#73-smart-quote-generation-pipeline)
  - [7.4 Lead Scoring ML Pipeline](#74-lead-scoring-ml-pipeline)
  - [7.5 Demand Forecasting Pipeline](#75-demand-forecasting-pipeline)
  - [7.6 Document Processing Pipeline](#76-document-processing-pipeline)
- [8. Performance Metrics & Success Criteria](#8-performance-metrics--success-criteria)
  - [8.1 Accuracy Targets by Feature](#81-accuracy-targets-by-feature)
  - [8.2 Latency Requirements](#82-latency-requirements)
  - [8.3 Business Impact KPIs](#83-business-impact-kpis)
- [9. Security, Privacy & Governance](#9-security-privacy--governance)
  - [9.1 PII Handling in LLM Prompts](#91-pii-handling-in-llm-prompts)
  - [9.2 GDPR/CCPA Compliance for AI Features](#92-gdprccpa-compliance-for-ai-features)
  - [9.3 Prompt Injection Prevention](#93-prompt-injection-prevention)
  - [9.4 AI Audit Trail & Model Governance](#94-ai-audit-trail--model-governance)
- [10. Implementation Timeline & Phases](#10-implementation-timeline--phases)
  - [10.1 Phase 1: Foundations (Weeks 1–3)](#101-phase-1-foundations-weeks-13)
  - [10.2 Phase 2: Core AI Features (Weeks 4–10)](#102-phase-2-core-ai-features-weeks-410)
  - [10.3 Phase 3: Advanced Intelligence (Weeks 11–18)](#103-phase-3-advanced-intelligence-weeks-1118)
  - [10.4 Phase 4: Autonomous Operations (Weeks 19–26)](#104-phase-4-autonomous-operations-weeks-1926)
  - [10.5 Gantt Chart Overview](#105-gantt-chart-overview)
- [11. Resource Requirements](#11-resource-requirements)
  - [11.1 Team Composition](#111-team-composition)
  - [11.2 Infrastructure Costs](#112-infrastructure-costs)
  - [11.3 API Cost Projections](#113-api-cost-projections)
- [12. Risk Assessment & Mitigation](#12-risk-assessment--mitigation)
  - [12.1 Technical Risks](#121-technical-risks)
  - [12.2 Operational Risks](#122-operational-risks)
  - [12.3 Compliance Risks](#123-compliance-risks)
  - [12.4 Risk Mitigation Matrix](#124-risk-mitigation-matrix)
- [13. Appendices](#13-appendices)
  - [13.1 Existing Codebase Integration Points](#131-existing-codebase-integration-points)
  - [13.2 Database Migration Templates](#132-database-migration-templates)
  - [13.3 Edge Function Patterns](#133-edge-function-patterns)
  - [13.4 Glossary](#134-glossary)

---

## 1. Executive Summary

### 1.1 Purpose & Scope

This document provides a comprehensive, implementation-ready specification for integrating AI, Large Language Models (LLMs), and Retrieval-Augmented Generation (RAG) across every functional module of the SOS Logic Nexus AI platform. It translates the strategic vision from `NEXT_GEN_PLATFORM_STRATEGY.md` (5 pillars) into concrete technical implementations with code patterns, database schemas, data flows, and deployment strategies.

**Scope covers:**
- All 8 logistics platform modules (shipment, warehouse, container, routing, carrier, compliance, invoicing, forecasting)
- All 7 CRM modules (leads, email, portal, opportunities, accounts, activities, reports)
- 6 platform-wide AI capabilities (RAG copilot, document automation, anomaly detection, smart notifications, semantic search, AI analytics)
- Technical architecture for RAG, vector stores, LLM routing, and multi-tenant AI isolation
- Implementation timelines, resource plans, cost projections, and risk mitigation

### 1.2 Current AI Maturity Assessment

| Dimension                | Current State                          | Score |
|--------------------------|----------------------------------------|-------|
| LLM Integration          | 3 models deployed (GPT-4o, Gemini 2.0, GPT-4o-mini) | 35/100 |
| Vision AI                | 2 functions (cargo damage, invoice extraction) | 40/100 |
| Predictive Analytics     | LLM-based demand forecast (not statistical) | 15/100 |
| Classification           | Keyword-based email, rule-based scoring | 10/100 |
| RAG / Semantic Search    | Zero pgvector, zero embeddings         | 0/100 |
| Autonomous Agents        | None                                   | 0/100 |
| ML Training Pipelines    | None                                   | 0/100 |
| **Overall AI Maturity**  |                                        | **14/100** |

**Current AI assets (verified from codebase):**
- 9 AI-related edge functions (3 with real LLM calls, 3 rule-based, 2 vision, 1 stub)
- 4 AI database tables (`ai_quote_cache`, `ai_quote_requests`, `demand_predictions`, `quote_audit_logs`)
- 1 frontend AI hook (`useAiAdvisor`)
- 2 AI-integrated UI components (`QuickQuoteModal`, `MultiModalQuoteComposer`)
- Existing rate engine with Monte Carlo simulation (not ML)
- HTS smart search using `pg_trgm` + FTS (not vector/semantic)

### 1.3 Target State Vision

Transform Logic Nexus AI from a **"Digitized Logistics Platform"** to an **"AI-Native Cognitive Supply Chain Operating System"** through:

1. **RAG-Powered Decision Support** — Natural language queries against shipments, rates, regulations, SOPs
2. **Predictive Intelligence** — Statistical + ML forecasting replacing LLM-guesswork for demand, ETA, pricing
3. **Autonomous Workflows** — AI agents that classify, route, score, and escalate without human intervention
4. **Semantic Understanding** — Vector search across HTS codes, documents, emails, and knowledge bases
5. **Computer Vision** — Automated cargo inspection, document extraction, and quality control

### 1.4 Key Metrics Summary

| Metric | Current | Phase 1 Target | Phase 4 Target |
|--------|---------|----------------|----------------|
| AI Maturity Score | 14/100 | 40/100 | 85/100 |
| Automated Workflows | ~32% | 55% | 80% |
| API Cost / Month | ~$15 (limited usage) | ~$53 | ~$120 |
| Prediction Accuracy (Demand) | N/A (LLM guess) | 15% MAPE | 10% MAPE |
| Email Classification Accuracy | ~40% (keywords) | 88% | 93% |
| Lead Score Accuracy | N/A (rules) | 75% AUROC | 85% AUROC |
| RAG Query Response Time | N/A | <3s (streaming) | <2s (streaming) |
| Documents with Embeddings | 0 | 50,000+ | 200,000+ |

---

## 2. Current State: AI Capabilities Inventory

### 2.1 Production AI Edge Functions (9 Functions)

#### a) `ai-advisor` — Smart Quote Generation
- **File:** `supabase/functions/ai-advisor/index.ts`
- **Status:** Production (v2.1)
- **Model:** GPT-4o (JSON mode)
- **Actions:** `suggest_unit`, `classify_commodity`, `predict_price`, `lookup_codes`, `validate_compliance`, `generate_smart_quotes`
- **Key Feature:** `generate_smart_quotes` generates 5 quote options (Best Value, Cheapest, Fastest, Greenest, Reliable) with multi-leg breakdowns
- **Caching:** `ai_quote_cache` table with 24-hour TTL
- **Audit:** `quote_audit_logs` table
- **Fallback:** Hardcoded knowledge base (6 commodity types, ports, airports, rail terminals)

#### b) `suggest-transport-mode` — Mode Recommendation
- **File:** `supabase/functions/suggest-transport-mode/index.ts`
- **Status:** Production with multi-tier fallback
- **Models:** Gemini 2.0 Flash (primary) → GPT-4o-mini (secondary) → Keyword heuristic (fallback)
- **Pattern:** Excellent cost-optimization model — cheapest AI first, expensive only if needed

#### c) `forecast-demand` — Demand Prediction
- **File:** `supabase/functions/forecast-demand/index.ts`
- **Status:** Production (needs statistical model upgrade)
- **Model:** GPT-4o (JSON mode, temperature 0.2)
- **Issue:** Uses LLM for statistical prediction — unreliable. Should use proper time-series models.
- **Data Source:** Aggregates `cargo_details` table by month

#### d) `analyze-cargo-damage` — Vision Inspection
- **File:** `supabase/functions/analyze-cargo-damage/index.ts`
- **Status:** Production
- **Model:** GPT-4o Vision API
- **Output:** `damage_detected`, `damage_type`, `severity`, `recommendation`, `confidence`

#### e) `extract-invoice-items` — Document Extraction
- **File:** `supabase/functions/extract-invoice-items/index.ts`
- **Status:** Production + Master Data Enrichment
- **Model:** GPT-4o Vision API
- **Post-processing:** Calls `search_hts_codes_smart` RPC for HTS code enrichment

#### f) `classify-email` — Email Classification
- **File:** `supabase/functions/classify-email/index.ts`
- **Status:** STUB — Returns hardcoded `{ category: "crm", sentiment: "neutral", intent: "support" }`
- **Real Logic:** `_shared/classification-logic.ts` has keyword-based classification (14 keywords total)
- **Priority:** CRITICAL — Must be replaced with LLM classification

#### g) `calculate-lead-score` — Lead Scoring
- **File:** `supabase/functions/calculate-lead-score/index.ts`
- **Status:** Production (Rule-Based, NOT ML)
- **Components:** Demographic (+20 max) + Behavioral (+20 max) + Logistics Value (+20 max) - Decay (10%/week)
- **Data:** `leads`, `lead_activities`, `lead_score_config`, `lead_score_logs`

#### h) `anomaly-detector` — Error Monitoring
- **File:** `supabase/functions/anomaly-detector/index.ts`
- **Status:** Production (Rule-Based, NOT ML)
- **Logic:** Threshold detection on `system_logs` (10+ errors or 1+ critical in 5 minutes)
- **Action:** Triggers `alert-notifier` (Slack + Email)

#### i) `rate-engine` — Freight Rate Calculation
- **File:** `supabase/functions/rate-engine/index.ts`
- **Status:** Production (DB Lookup + Monte Carlo Simulation)
- **3-Tier Logic:** Contract rates → Spot rates → Simulated rates
- **Guarantees:** Always returns 10+ carrier options
- **CO2 Estimates:** Mode-specific emission factors included

### 2.2 Frontend AI Integration Points

| Component | File | AI Feature |
|-----------|------|------------|
| `useAiAdvisor` | `src/hooks/useAiAdvisor.ts` | Generic hook calling `ai-advisor` edge function with action/payload pattern |
| `QuickQuoteModal` | `src/components/sales/quick-quote/QuickQuoteModal.tsx` | `suggest_unit` + `classify_commodity` (parallel AI calls) |
| `MultiModalQuoteComposer` | `src/components/sales/MultiModalQuoteComposer.tsx` | `generate_smart_quotes` with market analysis, confidence scores |

### 2.3 AI Database Tables

| Table | Created | Purpose | RLS |
|-------|---------|---------|-----|
| `ai_quote_cache` | 20240523 | Cache GPT-4o smart quote responses (24h TTL) | Yes |
| `ai_quote_requests` | 20260126 | Audit trail for AI quote generation requests | Yes (user sees own) |
| `demand_predictions` | 20260213 | Store demand forecast outputs with confidence scores | Yes (tenant-scoped) |
| `quote_audit_logs` | 20260121 | Audit trail for all quote-related AI actions | Yes (admins see all) |

### 2.4 Models Currently Deployed

| Function | Model | API | Cost Tier |
|----------|-------|-----|-----------|
| ai-advisor | gpt-4o | OpenAI | High ($2.50/$10.00 per 1M tokens) |
| suggest-transport-mode | gemini-2.0-flash | Google | Low ($0.10/$0.40) |
| forecast-demand | gpt-4o | OpenAI | High (overpowered for task) |
| analyze-cargo-damage | gpt-4o (Vision) | OpenAI | High |
| extract-invoice-items | gpt-4o (Vision) | OpenAI | High |
| calculate-lead-score | N/A | Rule-based | Free |
| rate-engine | N/A | Simulation | Free |
| anomaly-detector | N/A | Rule-based | Free |
| classify-email | N/A | Stub | Free |

### 2.5 Known Limitations & Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 1 | Zero pgvector / Zero embeddings | CRITICAL | No semantic search, no RAG possible |
| 2 | `classify-email` is a stub | HIGH | No real email AI, keyword fallback only |
| 3 | Demand forecasting uses LLM not statistical models | HIGH | Unreliable predictions, expensive |
| 4 | Lead scoring is purely rule-based | MEDIUM | No predictive power, no learning |
| 5 | No PII sanitization before LLM calls | HIGH | Privacy risk in AI functions |
| 6 | No AI audit logging (cost, tokens, latency) | MEDIUM | No observability into AI spend |
| 7 | No streaming responses | MEDIUM | Poor UX for long AI generations |
| 8 | No fine-tuned models | LOW | Generic models, not domain-optimized |
| 9 | No Anthropic/Claude integration | LOW | Single-vendor dependency (OpenAI + Google) |
| 10 | `ai-advisor` embeds entire knowledge base in prompt | MEDIUM | Expensive, should use RAG retrieval |

---

## 3. Technical Architecture

### 3.1 RAG Architecture Design

```
┌──────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (React)                     │
│   Vercel AI SDK v4 — Streaming responses, tool use UI        │
└───────────────┬──────────────────────────┬───────────────────┘
                │ Query                    │ Stream Response
                ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Deno)                   │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ RAG Query   │  │ Embedding    │  │ AI Agent           │  │
│  │ Function    │  │ Generator    │  │ (Tool Calling)     │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────▼──────────────────────────────────────▼──────────┐  │
│  │              ORCHESTRATION LAYER                        │  │
│  │  - PII Sanitization (_shared/pii-guard.ts)             │  │
│  │  - Model Router (tier-based selection)                  │  │
│  │  - Cache Check (semantic + hash-based)                  │  │
│  │  - Audit Logger (ai_audit_logs)                        │  │
│  │  - Tenant Scope Injection (ScopedDataAccess)           │  │
│  └────────┬─────────────────────┬────────────────────────┘  │
└───────────┼─────────────────────┼────────────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────┐  ┌──────────────────────────────────────┐
│   LLM PROVIDERS   │  │     SUPABASE POSTGRES (pgvector)      │
│                   │  │                                      │
│ ┌───────────────┐ │  │ ┌──────────────┐  ┌──────────────┐  │
│ │ OpenAI GPT-4o │ │  │ │ documents    │  │ aes_hts_codes│  │
│ │ (Complex)     │ │  │ │ + embedding  │  │ + embedding  │  │
│ ├───────────────┤ │  │ ├──────────────┤  ├──────────────┤  │
│ │ GPT-4o-mini   │ │  │ │ emails       │  │ knowledge_   │  │
│ │ (Moderate)    │ │  │ │ + embedding  │  │ base         │  │
│ ├───────────────┤ │  │ ├──────────────┤  │ + embedding  │  │
│ │ Gemini Flash  │ │  │ │ leads        │  └──────────────┘  │
│ │ (High-volume) │ │  │ │ + embedding  │                    │
│ ├───────────────┤ │  │ └──────────────┘                    │
│ │ Claude Sonnet │ │  │                                      │
│ │ (Safety-crit.)│ │  │ match_documents_scoped() — RLS-aware │
│ └───────────────┘ │  │ HNSW indexes on all embedding cols   │
└───────────────────┘  └──────────────────────────────────────┘
```

**Framework Selection:**
- **Frontend:** Vercel AI SDK v4 (streaming, tool use, React-first, edge-compatible)
- **Backend RAG:** LangChain.js in Edge Functions (native `SupabaseVectorStore` class)
- **Vector Store:** pgvector on Supabase Postgres (zero infrastructure cost, RLS-compatible)

### 3.2 Vector Database Strategy (pgvector)

**Why pgvector over Pinecone/Weaviate/Qdrant:**
- Zero incremental infrastructure cost (already on Supabase Postgres)
- Co-located with relational data — no cross-service latency
- RLS-compatible — tenant isolation enforced at vector query level
- HNSW + IVFFlat indexes for production performance
- Capacity: Handles up to ~5M vectors per index efficiently

**Migration to enable pgvector:**

```sql
-- Migration: 20260208000000_enable_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add embedding columns to target tables
ALTER TABLE public.aes_hts_codes
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- New table: General-purpose knowledge base for RAG
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id uuid REFERENCES public.franchises(id),
  title text NOT NULL,
  content text NOT NULL,
  content_type text NOT NULL DEFAULT 'sop',  -- sop, faq, regulation, rate_sheet, contract
  metadata jsonb DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- HNSW indexes (faster queries, preferred for production)
CREATE INDEX idx_hts_embedding ON public.aes_hts_codes
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_emails_embedding ON public.emails
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_leads_embedding ON public.leads
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_kb_embedding ON public.knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- RLS-aware vector search function
CREATE OR REPLACE FUNCTION match_documents_scoped(
  query_embedding vector(1536),
  p_tenant_id uuid,
  p_franchise_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10
)
RETURNS TABLE (id uuid, title text, content text, content_type text, metadata jsonb, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT d.id, d.title, d.content, d.content_type, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  FROM public.knowledge_base d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
    AND d.tenant_id = p_tenant_id
    AND (p_franchise_id IS NULL OR d.franchise_id = p_franchise_id)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### 3.3 Embedding Model Selection

| Model | Dimensions | Cost/1M Tokens | Use Case |
|-------|-----------|----------------|----------|
| **text-embedding-3-small** (OpenAI) | 1536 | $0.02 | Default for documents, emails, CRM notes |
| **text-embedding-3-large** (OpenAI) | 3072 | $0.13 | High-precision HTS code matching |
| **Cohere embed-v3** | 1024 | $0.10 | Multilingual logistics docs (CN, AR shipping instructions) |

**Recommendation:** Use `text-embedding-3-small` (1536 dims) as the standard embedding model. It balances cost ($0.02/1M tokens) and quality for Bills of Lading, customs forms, CRM emails, and SOPs. The existing `search_hts_codes_smart` trigram + FTS search should be augmented (not replaced) with vector similarity for hybrid search.

### 3.4 LLM Provider Strategy & Model Routing

**Three-tier model routing:**

```
┌─────────────────────────────────────────────────────────────┐
│                    MODEL ROUTING STRATEGY                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TIER 1 — Complex / High-Value  ($2.50–$3.00 / 1M input)   │
│  Models: GPT-4o, Claude Sonnet 4                            │
│  Tasks:                                                     │
│    - Smart quote generation (ai-advisor)                    │
│    - Compliance validation (sanctions, DGR, export)         │
│    - Complex multi-step rate negotiation                    │
│    - Document extraction from images (Vision API)           │
│    - Cargo damage analysis (Vision API)                     │
│                                                             │
│  TIER 2 — Moderate  ($0.15–$0.80 / 1M input)               │
│  Models: GPT-4o-mini, Claude Haiku 3.5                      │
│  Tasks:                                                     │
│    - Demand forecasting narrative generation                │
│    - Email summarization & action extraction                │
│    - Lead score enrichment with context                     │
│    - RAG query completion (customer portal chatbot)         │
│    - Shipment ETA explanation generation                    │
│                                                             │
│  TIER 3 — High-Volume / Classification  ($0.10 / 1M input) │
│  Models: Gemini 2.0 Flash                                   │
│  Tasks:                                                     │
│    - Email classification & sentiment analysis              │
│    - Transport mode suggestion                              │
│    - Simple entity extraction                               │
│    - Document categorization                                │
│    - Commodity classification (non-complex)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Model routing implementation:**

```typescript
// _shared/model-router.ts
type ModelTier = 'complex' | 'moderate' | 'classification';

const MODEL_CONFIG: Record<ModelTier, { model: string; provider: string; fallback?: string }> = {
  complex: {
    model: 'gpt-4o',
    provider: 'openai',
    fallback: 'claude-sonnet-4-20250514'
  },
  moderate: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    fallback: 'claude-haiku-3-5-20241022'
  },
  classification: {
    model: 'gemini-2.0-flash',
    provider: 'google',
    fallback: 'gpt-4o-mini'
  }
};

export function getModelConfig(tier: ModelTier) {
  return MODEL_CONFIG[tier];
}
```

### 3.5 Function Calling & Tool Use Architecture

The current `ai-advisor` implements a switch-based action router. The next evolution is **LLM-native tool calling**, where the model decides which tools to invoke based on the user's natural language query.

**Logistics AI Agent Tool Registry:**

| Tool Name | Description | Input Schema | Integration Point |
|-----------|-------------|--------------|-------------------|
| `lookup_rate` | Query freight rates for route/mode/cargo | origin, destination, mode, weight, container_type | `rate-engine` edge fn |
| `classify_hs_code` | Classify commodity into HTS code | commodity_description, destination_country | `search_hts_codes_smart` RPC |
| `check_compliance` | Check sanctions, DGR, export controls | destination_country, commodity, hs_code | `screen_restricted_party` RPC |
| `search_knowledge_base` | RAG search across SOPs, regulations | query, document_type | `match_documents_scoped` fn |
| `get_shipment_status` | Look up current shipment status | tracking_ref or shipment_id | `shipments` table query |
| `calculate_landed_cost` | Calculate duties, fees, total landed cost | items[], destination_country | `calculate_landed_cost` RPC |
| `forecast_demand` | Predict demand for commodity/route | hs_code, horizon_months | `forecast-demand` edge fn |
| `send_notification` | Send email/slack notification | recipient, message, channel | `send-email` / `alert-notifier` |

### 3.6 Chunking Strategies by Document Type

| Document Type | Strategy | Chunk Size | Overlap | Rationale |
|--------------|----------|-----------|---------|-----------|
| Bills of Lading | Structured extraction (key-value) | N/A | N/A | Highly structured; extract fields, don't chunk |
| Customs Forms | Section-based (header, commodities, declarations) | 500–800 tokens | 50 tokens | Preserve section integrity |
| Rate Sheets (Excel) | Row-as-document, column headers as context | 1 row = 1 chunk | Include header in each | Each rate is an independent fact |
| Shipping Instructions | Recursive character text splitter | 1000 tokens | 200 tokens | Mixed structure |
| Emails | Semantic splitting (by topic), thread-aware | 500 tokens | 100 tokens | Topics shift within threads |
| Contracts/SOPs | Section-based (by clause/heading) | 800 tokens | 150 tokens | Preserve legal clause boundaries |
| HTS Code Descriptions | Whole entry as single chunk | ~100–200 tokens | N/A | Each code is atomic |

### 3.7 Caching & Performance Architecture

```
┌───────────────────────────────────────────────────┐
│                 CACHING LAYERS                     │
├───────────────────────────────────────────────────┤
│                                                   │
│  L1: Semantic Cache (ai_quote_cache table)        │
│  ├─ Hash normalized request params                │
│  ├─ TTL by route volatility:                      │
│  │   Ocean: 24h, Air: 4h, Road: 1h               │
│  ├─ Expected savings: 40-60% API call reduction   │
│  └─ Already implemented, extend to all AI fns     │
│                                                   │
│  L2: Embedding Cache                              │
│  ├─ Store embeddings in table columns             │
│  ├─ Only regenerate when source text changes      │
│  └─ Hash source text to detect changes            │
│                                                   │
│  L3: Response Cache (per-tenant, per-function)    │
│  ├─ Cache RAG responses for common queries        │
│  ├─ TTL: 15 min for factual, 1h for analytical    │
│  └─ Invalidate on source data update              │
│                                                   │
│  L4: OpenAI Prompt Caching (server-side)          │
│  ├─ Static system prompts cached by provider      │
│  ├─ 50% cost reduction on repeated prompts        │
│  └─ Effective for ai-advisor 2000-token prompt    │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 3.8 Multi-Tenant AI Isolation

All AI features must respect the platform's 3-tier multi-tenancy (Super Admin → Tenant → Franchise).

**Isolation mechanisms:**
1. **Vector search:** `match_documents_scoped()` requires `p_tenant_id` parameter — results filtered at SQL level
2. **Embedding storage:** All embedding tables include `tenant_id` column with RLS policies
3. **AI audit logs:** `ai_audit_logs.tenant_id` tracks per-tenant AI usage for cost allocation
4. **Cache isolation:** Cache keys include `tenant_id` hash — no cross-tenant cache hits
5. **Model access:** Tenant-level configuration for API key overrides (bring-your-own-key)
6. **Knowledge base:** `knowledge_base.tenant_id` ensures tenant SOPs/docs are isolated

---

## 4. Logistics Platform — AI Implementation Strategies

### 4.1 Shipment Management AI

**Current State:** Live multi-modal CRUD (ocean/air/road/rail/courier). Manual event tracking. No predictive capabilities.

**Existing Integration Points:**
- `ShipmentNew.tsx`, `Shipments.tsx`, `ShipmentForm.tsx`
- `create_shipment_from_quote()` RPC
- `shipment_delays` table (tracks reasons and impact)
- `shipment_containers` (container execution details)

#### AI Enhancements

**4.1.1 ETA Prediction Engine**

| Attribute | Specification |
|-----------|--------------|
| **Model** | LightGBM or XGBoost regression |
| **Training Data** | Historical `shipments` (pickup_date, estimated_delivery_date, actual_delivery vs estimated) |
| **Features** | Transit mode, origin/destination, carrier, day-of-week, season, port congestion (external API), weather |
| **Target** | Predicted transit days with confidence interval |
| **Accuracy Target** | +/- 1–2 days (ocean), +/- 0.5 days (air) |
| **Deployment** | Python microservice (FastAPI) or ONNX model in Edge Function |
| **Integration** | New field `shipments.ai_predicted_eta`, update on status changes |
| **Trigger** | On shipment creation + hourly refresh for in-transit shipments |

**Data Flow:**
```
Shipment Created/Updated
  ↓
Collect features: mode, carrier, route, weight, season, day-of-week
  ↓
Query external APIs: port congestion, weather
  ↓
Run LightGBM prediction model
  ↓
Output: predicted_eta, confidence_interval, delay_risk_score
  ↓
Update shipments.ai_predicted_eta, shipments.delay_risk_score
  ↓
If delay_risk_score > 0.7 → trigger alert-notifier
```

**4.1.2 Shipment Event Prediction (Milestone Forecasting)**

Predict the likelihood and timing of key milestones (customs clearance, port discharge, delivery):
- **Model:** Sequential pattern mining on historical shipment event logs
- **Output:** Predicted timestamps for each remaining milestone with confidence
- **Display:** Timeline visualization with predicted vs actual milestones
- **New Table:** `shipment_milestone_predictions` (shipment_id, milestone_type, predicted_at, confidence, actual_at)

**4.1.3 Damage Risk Assessment**

Pre-shipment prediction of cargo damage probability:
- **Model:** Logistic regression on historical damage claims
- **Features:** Commodity type, container type, route, season, carrier history
- **Output:** Risk score (0–100), recommended precautions
- **Integration:** Display in `ShipmentForm.tsx` during creation, alert if risk > 60

### 4.2 Warehouse Management AI

**Current State:** Functional CRUD only (`warehouses` table with name, code, type, capacity, utilization). No inventory tracking, no optimization.

**Existing Integration Points:**
- `Warehouses.tsx`, `WarehouseNew.tsx`, `WarehouseForm.tsx`
- `warehouses.capacity_sqft`, `warehouses.current_utilization`

#### AI Enhancements

**4.2.1 Capacity Utilization Forecasting**

| Attribute | Specification |
|-----------|--------------|
| **Model** | Prophet (additive decomposition with seasonality) |
| **Training Data** | Historical utilization records (new time-series table) |
| **Features** | Current utilization, seasonal patterns, upcoming bookings, demand forecasts |
| **Target** | Predicted utilization % for next 4 weeks |
| **Trigger** | Daily batch job via pg_cron |
| **New Table** | `warehouse_utilization_history` (warehouse_id, date, utilization_pct, inbound_count, outbound_count) |
| **Alert** | If predicted utilization > 85% within 2 weeks → capacity warning |

**4.2.2 Cross-Dock Optimization**

Recommend optimal cross-dock assignments to minimize dwell time:
- **Model:** Constraint satisfaction (Google OR-Tools)
- **Input:** Inbound shipments with ETAs, outbound shipments with cutoff times, warehouse layouts
- **Output:** Assignment matrix: inbound → dock → outbound with timing
- **Integration:** New `cross_dock_recommendations` table, UI widget in warehouse dashboard

**4.2.3 Inventory Placement Intelligence**

Recommend optimal warehouse for new inventory based on demand proximity:
- **Model:** Weighted scoring: demand_proximity × 0.4 + cost × 0.3 + capacity × 0.3
- **Data:** `demand_predictions` + `warehouses` + `carrier_rates` (for transport cost)
- **Display:** Dropdown suggestion in shipment creation: "Recommended Warehouse: [X] (Score: 87)"

### 4.3 Inventory & Container Tracking AI

**Current State:** Live container tracking with TEU calculation. 4-level hierarchy (types → sizes → inventory → shipment containers). `view_container_inventory_summary` database view. Vessel class capacity matching in `ContainerAnalytics.tsx`.

**Existing Integration Points:**
- `ContainerTracking.tsx`, `ContainerAnalytics.tsx`
- `container_tracking` table (size, quantity, status, location)
- `shipment_containers` table (actual execution)
- `container_type_attributes` (dynamic attribute tracking)

#### AI Enhancements

**4.3.1 Container Demand Prediction**

| Attribute | Specification |
|-----------|--------------|
| **Model** | SARIMA / NeuralProphet per container type |
| **Training Data** | Historical `container_tracking` snapshots + `shipment_containers` |
| **Features** | Container type, season, trade lane volumes, bookings pipeline |
| **Target** | Predicted container demand by type (20GP, 40HC, Reefer) for next 4 weeks |
| **Action** | If predicted demand > available inventory → trigger procurement alert |
| **New Table** | `container_demand_forecasts` (container_type_id, forecast_date, predicted_qty, confidence) |

**4.3.2 Automated Container-to-Shipment Matching**

Recommend optimal container assignment for new shipments:
- **Input:** Shipment cargo configs (weight, volume, commodity type, temperature requirements)
- **Logic:** Score available containers by: capacity match, special requirements (reefer, ventilation), location proximity, cost
- **Model:** Rule-based scoring with ML refinement from historical selections
- **Integration:** Auto-suggest in `ShipmentForm.tsx` when assigning containers

**4.3.3 Container Repositioning Intelligence**

Identify empty container repositioning opportunities:
- **Model:** Network flow optimization (OR-Tools min-cost flow)
- **Input:** Empty container locations, upcoming demand by location, repositioning costs
- **Output:** Repositioning recommendations: move X containers from Location A to Location B by Date C
- **Display:** Map visualization in `ContainerAnalytics.tsx`

### 4.4 Route Optimization & Transport Mode AI

**Current State:**
- `suggest-transport-mode`: Gemini 2.0 Flash + GPT-4o-mini + keyword fallback (live)
- `rate-engine`: DB lookup + Monte Carlo simulation, 10+ options guaranteed (live)
- `LogisticsQuotationEngine.ts`: Hardcoded mock rates for chargeable weight calculation

**Existing Integration Points:**
- `transport_modes` table, `TransportModeSelector.tsx`
- `carrier_rates` table (3-tier: contract/spot/market)
- `margin_rules` table (tenant-specific markup)
- `ports_locations` table (location code resolution)

#### AI Enhancements

**4.4.1 ML-Powered Transport Mode Selection**

Upgrade from keyword heuristic to ML classification:

| Attribute | Specification |
|-----------|--------------|
| **Model** | Gradient Boosting Classifier (XGBoost) |
| **Training Data** | Historical quote → shipment conversions with actual mode chosen |
| **Features** | Weight, volume, commodity, urgency, origin/destination distance, customer preference history, cost sensitivity |
| **Output** | Recommended mode with confidence + explanation |
| **Fallback** | Current Gemini + keyword cascade (preserved) |
| **Integration** | Replace `suggest-transport-mode` edge function internals |

**4.4.2 Multi-Leg Route Optimization**

Currently, multi-leg routing in `LegsConfigurationStep.tsx` is fully manual. Add AI-suggested optimal legs:

- **Model:** VROOM (open source, C++ with REST API) for road segments; carrier schedule APIs for ocean/air
- **Input:** Origin, destination, cargo spec, time constraints, cost budget
- **Output:** Optimal leg sequence with mode per leg, estimated transit/cost per leg
- **Display:** "AI-Suggested Route" tab in `LegsConfigurationStep.tsx`
- **Deployment:** VROOM as Docker sidecar service

**4.4.3 Dynamic Margin Optimization**

Replace static `margin_rules` with demand-responsive pricing:
- **Model:** Reinforcement Learning agent or simpler: regression on historical margin vs. win rate
- **Input:** Current demand (from `demand_predictions`), competitor pricing signals, carrier capacity
- **Output:** Optimal margin per route/mode to maximize revenue while maintaining win rate
- **Integration:** Override `margin_rules` dynamically when AI confidence > 80%

### 4.5 Supply Chain Visibility & Predictive Analytics

**Current State:** Limited to shipment status tracking. No external data feeds. `dashboardAnalytics.ts` uses RPCs for basic metrics (revenue, shipments, profit).

#### AI Enhancements

**4.5.1 Supply Chain Risk Scoring**

| Attribute | Specification |
|-----------|--------------|
| **Model** | Ensemble: LightGBM risk classifier + LLM narrative |
| **Features** | Route (geopolitical risk), carrier reliability, port congestion, weather, sanctions, season |
| **External Data** | Port congestion (MarineTraffic API), weather (OpenWeatherMap), geopolitical risk (custom feed) |
| **Output** | Risk score (0–100) per shipment/route + risk factors explanation |
| **Display** | Risk badge on shipment cards, risk heatmap on dashboard |
| **New Table** | `supply_chain_risk_assessments` (entity_type, entity_id, risk_score, risk_factors, assessed_at) |

**4.5.2 Proactive Disruption Alerts**

- Monitor external feeds for port closures, weather events, carrier disruptions
- Cross-reference with active shipments to identify affected cargo
- Auto-generate impact assessments and mitigation recommendations
- **Trigger:** Scheduled check every 15 minutes (pg_cron → Edge Function)
- **Notification:** Slack/email via `alert-notifier` with affected shipment list

**4.5.3 Carbon Footprint Intelligence**

Extend current CO2 estimates (mode-specific factors in `rate-engine`) with:
- Route-specific emission calculations (distance × mode factor × load factor)
- Carbon offset recommendations
- Sustainability scoring per carrier
- Green route alternatives in quote generation

### 4.6 Fleet Management AI

**Current State:** Master data CRUD for carriers, vehicles, and vessels. `vessel_operational_metrics` table tracks transit time, fuel efficiency, port calls, average speed. Vessel class capacity matching exists in `ContainerAnalytics.tsx`.

**Existing Integration Points:**
- `carriers` table (SCAC codes, service types)
- `vehicles` table (capacity_kg, capacity_cbm, status)
- `vessels` table (IMO number, capacity_teu, current_status)
- `vessel_classes` (min_teu, max_teu, draft/beam limits)
- `vessel_operational_metrics` (transit, fuel, speed per voyage)

#### AI Enhancements

**4.6.1 Carrier Performance Scoring (ML)**

| Attribute | Specification |
|-----------|--------------|
| **Model** | Weighted scoring with ML calibration |
| **Features** | On-time delivery %, damage claim rate, pricing competitiveness, communication responsiveness, documentation accuracy |
| **Training Data** | Historical shipments with carrier + outcome (delays, claims, cost variance) |
| **Output** | Carrier score (0–100) per route/mode, performance trend |
| **Integration** | `carriers.ai_performance_score` column, display in `Carriers.tsx` and rate selection |
| **Update Frequency** | Weekly batch recalculation |

**4.6.2 Fleet Utilization Optimization**

- **Model:** Linear programming (OR-Tools) for vehicle/vessel assignment
- **Input:** Available fleet, upcoming shipments, capacity constraints, geographic positions
- **Output:** Optimal fleet assignment: Vehicle/Vessel X → Shipment Y
- **Dead-leg detection:** Identify empty return trips, suggest backhaul cargo matching
- **Display:** Fleet utilization dashboard with AI recommendations

**4.6.3 Predictive Maintenance Alerting**

For road fleet (`vehicles` table):
- **Model:** Time-to-failure prediction based on mileage, last maintenance, vehicle age
- **Data:** New `vehicle_maintenance_log` table
- **Alert:** If predicted days-to-maintenance < 7 → alert fleet manager
- **Integration:** Badge on `Vehicles.tsx` list view

### 4.7 Order Fulfillment & Quote-to-Cash AI

**Current State:** Full quote-to-cash pipeline exists: Quote → Booking → Shipment → Invoice. Multi-leg, multi-mode quotes with versioning. Rate engine with 10+ guaranteed options. Quotation selection events tracked.

**Existing Integration Points:**
- `MultiModalQuoteComposer.tsx` (4-step wizard)
- `quotation_versions`, `quotation_version_options`, `quotation_selection_events`
- `create_shipment_from_quote()`, `create_invoice_from_shipment()` RPCs
- `QuotePortal.tsx` (token-based customer acceptance)
- `LogisticsQuotationEngine.ts` (chargeable weight + surcharges)

#### AI Enhancements

**4.7.1 Smart Quote Option Ranking**

Enhance `generate_smart_quotes` with historical conversion data:
- **Model:** Learn from `quotation_selection_events` which option types win by customer profile
- **Feature:** Customer's historical preferences (fastest vs cheapest), industry, shipment urgency
- **Output:** Re-rank the 5 AI-generated options with "Recommended for this customer" tag
- **Integration:** Add `recommended_confidence` score to `quotation_version_options`

**4.7.2 Quote Acceptance Prediction**

| Attribute | Specification |
|-----------|--------------|
| **Model** | Logistic regression on historical quote acceptance data |
| **Features** | Quote amount vs. historical avg, customer segment, competitive pressure, days since sent |
| **Output** | Probability of acceptance (0–100%), suggested action if < 40% |
| **Display** | Badge in quote detail view: "72% likely to accept" |
| **Action:** | If < 30% and >3 days old → auto-suggest follow-up email via `send-email` |

**4.7.3 Automated Invoice Reconciliation**

- **Model:** LLM comparison of `invoice_line_items` vs. `quote_items` + `shipment_containers`
- **Detection:** Flag discrepancies: overcharge, missing items, wrong quantities
- **Integration:** New `invoice_reconciliation_results` table with flags and explanations
- **Display:** Reconciliation status badge on invoice list view

### 4.8 Demand Forecasting AI

**Current State:** `forecast-demand` edge function uses GPT-4o to "guess" future demand. Historical data from `cargo_details` aggregated by month. `demand_predictions` table exists but not actively populated (storage logic incomplete).

**Critical Issue:** Using an LLM for statistical forecasting is fundamentally unreliable. LLMs generate plausible-sounding numbers but are not statistical models.

#### Recommended Architecture

**4.8.1 Replace LLM with Statistical + ML Ensemble**

```
┌─────────────────────────────────────────────────────────┐
│              DEMAND FORECASTING PIPELINE                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  DATA COLLECTION                                        │
│  ├─ cargo_details (volume_cbm, weight_kg by month)      │
│  ├─ quotes created (leading indicator)                  │
│  ├─ External: commodity price indices, economic data    │
│  └─ External: shipping index (BDI, SCFI)               │
│                                                         │
│  MODEL ENSEMBLE                                         │
│  ├─ Prophet/NeuralProphet (seasonality + holidays)      │
│  ├─ LightGBM (external features: oil, indices)          │
│  └─ TimesFM (zero-shot foundation model, no training)   │
│                                                         │
│  ENSEMBLE COMBINATION                                   │
│  ├─ Weighted average based on recent accuracy           │
│  └─ Confidence interval from model disagreement         │
│                                                         │
│  LLM NARRATIVE (GPT-4o-mini)                            │
│  ├─ Generate human-readable explanation                 │
│  └─ Market context and risk factor narrative            │
│                                                         │
│  OUTPUT                                                 │
│  ├─ demand_predictions table (predictions + confidence) │
│  ├─ Dashboard visualization (time series chart)         │
│  └─ Alert if predicted demand exceeds capacity          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Phase | Model | Role | Infrastructure |
|-------|-------|------|----------------|
| Phase 1 | TimesFM (Google) | Zero-shot forecasting (no training needed) | API call or Python microservice |
| Phase 2 | Prophet | Seasonal decomposition with holiday effects | Python microservice (FastAPI) |
| Phase 3 | LightGBM | Feature-rich prediction (external data) | Python microservice |
| All | GPT-4o-mini | Narrative generation only | Edge Function |

**Success Metrics:**
- Phase 1: MAPE < 20% (immediate improvement over LLM guessing)
- Phase 2: MAPE < 15% with seasonality modeling
- Phase 3: MAPE < 10% with ensemble + external features

### 4.9 Compliance & Customs AI

**Current State:**
- Restricted party screening: Live (`screen_restricted_party` RPC with 60% similarity threshold)
- Quote screening: Live with 24h caching (`ComplianceScreeningService.ts`)
- Customs clearance: 8-stage Kanban pipeline (`CustomsClearancePipeline.tsx`)
- HTS management: `master_commodities` + `duty_rates` + `search_hts_codes_smart` (trigram + FTS)
- Landed cost calculation: Live (`LandedCostService.ts`)

#### AI Enhancements

**4.9.1 AI-Powered HS Code Classification**

| Attribute | Specification |
|-----------|--------------|
| **Model** | GPT-4o + RAG (vector search against embedded HTS descriptions) |
| **Current:** | `search_hts_codes_smart` uses trigram similarity + full-text search |
| **Upgrade:** | Hybrid search: trigram (exact match) + FTS (keyword) + vector (semantic) |
| **Accuracy Target** | 85–92% at 6-digit level, 78–85% at 10-digit level |
| **Integration** | Enhance `search_hts_codes_smart` RPC, display confidence scores |
| **Feedback Loop** | User corrections stored in `classification_corrections` table for prompt refinement |

**Hybrid Search Implementation:**
```sql
-- Upgraded search function combining trigram + FTS + vector
CREATE OR REPLACE FUNCTION search_hts_codes_hybrid(
  p_query text,
  p_query_embedding vector(1536) DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid, hts_code text, description text,
  trigram_score float, fts_score float, vector_score float,
  combined_score float
)
LANGUAGE sql STABLE
AS $$
  SELECT h.id, h.hts_code, h.description,
    similarity(h.description, p_query) as trigram_score,
    ts_rank(to_tsvector('english', h.description), plainto_tsquery('english', p_query)) as fts_score,
    CASE WHEN p_query_embedding IS NOT NULL AND h.embedding IS NOT NULL
      THEN 1 - (h.embedding <=> p_query_embedding)
      ELSE 0
    END as vector_score,
    (similarity(h.description, p_query) * 2.0 +
     ts_rank(to_tsvector('english', h.description), plainto_tsquery('english', p_query)) * 1.5 +
     CASE WHEN p_query_embedding IS NOT NULL AND h.embedding IS NOT NULL
       THEN (1 - (h.embedding <=> p_query_embedding)) * 3.0
       ELSE 0
     END) as combined_score
  FROM public.aes_hts_codes h
  WHERE similarity(h.description, p_query) > 0.1
     OR to_tsvector('english', h.description) @@ plainto_tsquery('english', p_query)
     OR (p_query_embedding IS NOT NULL AND h.embedding IS NOT NULL
         AND 1 - (h.embedding <=> p_query_embedding) > 0.7)
  ORDER BY combined_score DESC
  LIMIT p_limit;
$$;
```

**4.9.2 Customs Risk Scoring**

Pre-screen shipments for customs examination likelihood:
- **Model:** Logistic regression on historical customs outcomes
- **Features:** HS code category, origin country, declared value vs. statistical average, shipper history, commodity + origin combination risk
- **Output:** Examination probability (0–100%), risk factors
- **Integration:** Display in `CustomsClearancePipeline.tsx` as risk badge per shipment

**4.9.3 Automated Document Compliance Check**

- **Model:** GPT-4o with structured output (Zod schema)
- **Input:** Uploaded Bill of Lading / Commercial Invoice images
- **Output:** Completeness check against requirements checklist, missing fields flagged
- **Integration:** Trigger on document upload to `shipments/` storage bucket

### 4.10 Dynamic Pricing & Rate Intelligence

**Current State:** `rate-engine` uses 3-tier DB lookup + Monte Carlo simulation with ±15% price variance.

#### AI Enhancements

**4.10.1 ML-Based Rate Prediction**

| Attribute | Specification |
|-----------|--------------|
| **Model** | LightGBM regression trained on `carrier_rates` historical data |
| **Features** | Route, mode, season, fuel price index, carrier, container type, booking lead time |
| **Target** | Predicted rate with confidence interval |
| **vs. Current** | Replace Monte Carlo random variance with data-driven prediction |
| **Integration** | New `predicted_rates` results blended with actual `carrier_rates` |

**4.10.2 Competitive Rate Intelligence**

- **Data Source:** Scrape/API from public freight indices (Freightos BDI, Shanghai SCFI)
- **Model:** Benchmark current rates against market indices
- **Output:** Rate competitiveness score (below/at/above market)
- **Display:** Market position indicator in rate selection UI

---

## 5. CRM Platform — AI Implementation Strategies

### 5.1 Predictive Lead Scoring

**Current State:** Rule-based heuristic in `calculate-lead-score` edge function with 4 components (demographic +20, behavioral +20, logistics +20, decay -10%/week). Configurable weights via `lead_score_config` table.

#### ML Evolution Path

| Phase | Model | Expected Lift | Data Requirement |
|-------|-------|---------------|------------------|
| Current | Weighted heuristic | Baseline | None |
| Phase 1 | Logistic Regression | +15–25% accuracy | 6 months conversion history |
| Phase 2 | XGBoost/LightGBM | +30–40% accuracy | 1 year + feature engineering |
| Phase 3 | Neural Network + Embeddings | +40–50% accuracy | 2 years + email content embeddings |

**Feature Vector for ML Scoring:**

```typescript
interface LeadMLFeatures {
  // Demographic (static)
  title_seniority: number;         // 0-3 (staff → C-level)
  company_size_bucket: number;     // 0-4 (unknown → enterprise)
  industry_match_score: number;    // 0-1 (how well matches ICP)
  source_quality: number;          // 0-1 (referral=1.0, cold=0.1)

  // Behavioral (time-windowed)
  activities_7d: number;
  activities_30d: number;
  email_open_rate: number;
  link_click_rate: number;
  form_submissions: number;
  days_since_last_activity: number;

  // Logistics-specific
  estimated_annual_value: number;
  shipment_frequency_code: number; // encoded
  dangerous_goods_flag: boolean;
  trade_lanes_count: number;

  // Engagement velocity
  activity_trend_slope: number;    // positive = increasing engagement
  response_time_avg_hours: number;

  // CRM context
  owner_historical_close_rate: number;
  days_in_current_stage: number;
  stage_progression_speed: number; // days per stage transition
}
```

**Implementation:**
1. Train in Python (scikit-learn/XGBoost), export as ONNX
2. Run inference in Edge Function using `onnxruntime-web` or lightweight FastAPI service
3. Store ML score alongside rule-based score: `leads.ai_score` + `leads.ai_score_factors` (JSONB)
4. A/B test: show both scores for 2 weeks, then switch when ML outperforms

### 5.2 Intelligent Email Classification & NLP

**Current State:** `classify-email` returns hardcoded stub. `_shared/classification-logic.ts` has 14 keywords for crude classification. `route-email` assigns queues based on category/sentiment/intent.

#### Implementation Specification

**5.2.1 LLM-Based Email Classification**

| Attribute | Specification |
|-----------|--------------|
| **Model** | Gemini 2.0 Flash (cheapest, ~$0.03 per 500 emails) |
| **Fallback** | GPT-4o-mini if Gemini unavailable |
| **Input** | Subject + body (truncated to 1000 tokens) |
| **Output Schema** | See below |
| **Latency Target** | < 2 seconds |
| **Trigger** | On email ingestion (`ingest-email` → `classify-email` chain) |

**Output Schema:**
```typescript
interface EmailClassification {
  category: 'quote_request' | 'booking_confirmation' | 'complaint' |
            'payment' | 'documentation' | 'tracking' | 'general' | 'spam';
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  intent: 'request_quote' | 'follow_up' | 'escalation' |
          'information' | 'action_required';
  suggested_response_type: 'auto_reply' | 'template' | 'human_required';
  extracted_entities: {
    shipment_ref: string | null;
    container_numbers: string[];
    po_numbers: string[];
    dates_mentioned: string[];
  };
  buying_signals: {
    budget_mentioned: boolean;
    timeline_mentioned: boolean;
    authority_indicated: boolean;
    urgency_expressed: boolean;
  };
}
```

**5.2.2 Email Summarization & Action Extraction**

- **Model:** GPT-4o-mini
- **Trigger:** On thread with > 5 messages or > 2000 total tokens
- **Output:** Summary (2–3 sentences) + action items (bullet list) + next step recommendation
- **Display:** Summary card at top of `EmailDetailView.tsx`
- **Storage:** `emails.ai_summary`, `emails.ai_action_items` (JSONB)

**5.2.3 Smart Reply Suggestions**

- **Model:** GPT-4o-mini with RAG (retrieve similar past successful replies)
- **Trigger:** When user opens reply composer
- **Output:** 3 suggested reply drafts (tone-matched to customer's email)
- **Display:** Collapsible "AI Suggestions" panel in email compose UI
- **Privacy:** PII-sanitized input, drafts reviewed before sending

### 5.3 Smart Lead Assignment & Routing

**Current State:** Rule-based routing in `process-lead-assignments` edge function (360 lines). Methods: specific user, round-robin, load balance, territory-based. Fallback: round-robin.

#### AI Enhancement

**5.3.1 Agent-Lead Matching**

| Attribute | Specification |
|-----------|--------------|
| **Model** | Collaborative filtering on historical agent × lead outcomes |
| **Features** | Agent specialization (commodity types, trade lanes, deal sizes), lead profile, language match |
| **Output** | Ranked list of best agents for each lead + expected conversion probability |
| **Integration** | Inject AI recommendations into `process-lead-assignments` before rule evaluation |
| **Fallback** | If AI confidence < 60%, fall back to existing rule-based routing |

**5.3.2 Capacity-Aware Assignment**

- Predict each agent's capacity utilization for next 7 days based on current pipeline velocity
- Factor in upcoming meetings, leaves (from activities calendar)
- Route high-value leads to agents with upcoming capacity, not just current lowest load

### 5.4 Deal Health & Pipeline Forecasting

**Current State:** Opportunity pipeline with 8 stages (prospecting → closed), manual drag-drop, Salesforce sync, stage history tracking. No predictive capabilities.

#### AI Enhancements

**5.4.1 Win Probability Model**

| Attribute | Specification |
|-----------|--------------|
| **Model** | XGBoost binary classifier |
| **Training Data** | Historical opportunities with closed_won/closed_lost outcomes |
| **Features** | Days in current stage, total activities, last activity recency, deal size vs. historical avg, competitor mentions, stage progression speed |
| **Output** | Win probability (0–100%) with top 3 contributing factors |
| **AUROC Target** | 0.75–0.85 |
| **Integration** | `opportunities.ai_win_probability` column, display as badge in pipeline view |
| **Update** | Recalculate daily or on stage change |

**5.4.2 Revenue Forecasting**

- **Model:** Opportunity-weighted pipeline forecast: Σ(deal_amount × win_probability)
- **Enhancement:** Add confidence intervals from model uncertainty
- **Display:** Dashboard widget: "Q1 Forecast: $1.2M (±$200K at 80% confidence)"
- **Anomaly Detection:** Alert if any rep's forecast deviates >20% from historical close rate pattern

**5.4.3 Deal Stall Detection**

- Define per-stage dwell time thresholds from historical averages
- If opportunity exceeds 1.5× average dwell time → auto-flag as "At Risk"
- Suggest next action: "Similar deals that won typically had a meeting at this stage"
- **Integration:** Auto-update `opportunities.risk_flag` field, trigger notification

### 5.5 Customer Portal Intelligence

**Current State:** Token-based portal at `/portal/quotes/:token`. Displays quote details, allows acceptance with name/email capture. Rate-limited refresh.

#### AI Enhancements

**5.5.1 Portal Chatbot (RAG-Powered)**

| Attribute | Specification |
|-----------|--------------|
| **Model** | GPT-4o-mini with RAG (streaming via Vercel AI SDK) |
| **Knowledge Sources** | Embedded SOPs, rate sheets, FAQs, shipment statuses |
| **Tools** | `get_shipment_status`, `get_quote_details`, `get_invoice_status`, `escalate_to_human` |
| **Auth** | Token-scoped: chatbot can only access data linked to the portal token |
| **Latency** | < 3s first token (streaming) |
| **Deployment** | New Edge Function `portal-chatbot` + React component in QuotePortal |

**Chatbot Query Flow:**
```
Customer types question in portal
  ↓
Embed question → vector search knowledge_base (tenant-scoped)
  ↓
If question about shipment → call get_shipment_status tool
If question about invoice → call get_invoice_status tool
If general question → RAG answer from knowledge base
  ↓
Stream response to portal UI
  ↓
If confidence < 0.5 → offer "Talk to a representative" escalation
```

**5.5.2 Personalized Quote Variations**

- Based on customer's historical preferences (fastest vs cheapest)
- Highlight the option most likely to be accepted
- Show "Similar customers chose..." social proof

### 5.6 Dynamic Customer Segmentation

**Current State:** Static segments in `CustomerSegmentation.tsx` by demographic, behavioral, geographic. Manual configuration. Pie/bar chart visualizations.

#### AI Enhancement

| Attribute | Specification |
|-----------|--------------|
| **Model** | K-Means clustering with silhouette score optimization |
| **Features** | Revenue, shipment frequency, mode preferences, trade lanes, deal size, engagement level |
| **Output** | Auto-generated segments with labels (generated by LLM) |
| **Refresh** | Monthly batch recalculation |
| **Prediction** | "Accounts likely to expand in next 90 days" based on engagement velocity |
| **Integration** | Replace static segments with ML clusters, allow manual override |

### 5.7 Activity Intelligence & Auto-Logging

**Current State:** Manual form-based logging in `ActivityForm.tsx`. Activity types: call, email, meeting, task, note, status_change. Timeline display in `LeadActivitiesTimeline.tsx`.

#### AI Enhancements

**5.7.1 Email Activity Auto-Linking**

- When email is received/sent with a known contact, auto-create `email` activity linked to their lead/opportunity
- Extract key information: discussed topics, mentioned dates, action items
- **Integration:** Extend `ingest-email` to check contact match and auto-create activity

**5.7.2 Meeting Summary Auto-Logging**

- Post-meeting, user uploads notes or recording transcript
- LLM extracts: summary, action items, sentiment, next steps
- Auto-create `meeting` activity with structured notes
- **Model:** GPT-4o-mini for extraction

---

## 6. Platform-Wide AI Features

### 6.1 RAG-Powered Decision Support ("Nexus Copilot")

A natural language interface for querying platform data, SOPs, regulations, and rate sheets.

**Architecture:**

```
┌──────────────────────────────────────────────────────────────┐
│                     NEXUS COPILOT                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User: "What's the cheapest way to ship 2000kg of           │
│         electronics from Shanghai to Rotterdam?"             │
│                                                              │
│  ┌──────────────┐                                            │
│  │ Intent       │ → Identify: rate_query + route_lookup      │
│  │ Detection    │                                            │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │ Tool         │ → Call: lookup_rate(CNSHA, NLRTM, ocean,   │
│  │ Selection    │         2000kg, electronics)                │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │ RAG Context  │ → Search: knowledge_base for trade lane    │
│  │ Retrieval    │   regulations, recent rate trends          │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │ Response     │ → "Based on current rates, ocean freight   │
│  │ Generation   │    via LCL is cheapest at ~$XX. However,   │
│  │ (Streaming)  │    consider FCL if volume increases to     │
│  └──────────────┘    10 CBM. Customs note: electronics to NL │
│                      require CE marking compliance."         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Implementation:**
- **Edge Function:** `nexus-copilot` with tool-calling LLM (GPT-4o or Claude Sonnet 4)
- **Frontend:** Floating chat widget using Vercel AI SDK streaming
- **Security:** Tenant-scoped RAG, user-scoped tool access via ScopedDataAccess
- **Conversation Memory:** Store in `copilot_conversations` table (session-based, 24h TTL)

### 6.2 Document Automation & OCR Pipeline

**Current State:** `extract-invoice-items` uses GPT-4o Vision for invoice extraction. `analyze-cargo-damage` uses Vision API for damage detection. Both are single-document, user-triggered.

#### Full Pipeline Design

```
Document Upload (Storage Bucket trigger)
  ↓
Categorize Document (Gemini Flash)
  ├─ Commercial Invoice → extract-invoice-items
  ├─ Bill of Lading → extract-bol-fields (NEW)
  ├─ Packing List → extract-packing-list (NEW)
  ├─ Customs Declaration → extract-customs-fields (NEW)
  └─ Cargo Photo → analyze-cargo-damage
  ↓
Validate Extracted Fields (Zod schema)
  ↓
Cross-Reference:
  ├─ Entity names → RestrictedPartyScreening
  ├─ HS codes → search_hts_codes_hybrid
  └─ Amounts → landed cost calculation
  ↓
Store in structured tables with confidence scores
  ↓
UI: Display extracted data with confidence badges
  ├─ Green: > 90% confidence (auto-accept)
  ├─ Yellow: 70-90% confidence (review)
  └─ Red: < 70% confidence (manual correction)
  ↓
User corrections → extraction_corrections table (feedback loop)
```

**New Edge Functions Needed:**
- `extract-bol-fields` — Extract shipper, consignee, vessel, port, cargo details from BOL images
- `extract-packing-list` — Extract item list, quantities, weights from packing list images
- `categorize-document` — Classify uploaded document type (Gemini Flash)

### 6.3 Anomaly Detection & Fraud Prevention

**Current State:** `anomaly-detector` checks error log counts (threshold-based). No financial or operational anomaly detection.

#### Enhanced Anomaly Detection

| Anomaly Type | Detection Method | Model | Priority |
|-------------|-----------------|-------|----------|
| Price spikes | Z-score on rolling 30-day window | Statistical | HIGH |
| Demand surge | STL decomposition residuals | Prophet | HIGH |
| Carrier delays | Deviation from predicted ETA | LightGBM | HIGH |
| Duplicate invoices | Hash matching + fuzzy description similarity | Rule + trigram | HIGH |
| Unusual payment routes | New vendor + high value + unusual country | Isolation Forest | MEDIUM |
| Phantom shipments | Shipment without corresponding quote/booking | Rule-based | MEDIUM |
| Quality degradation | Damage claim rate increase per carrier | Moving average | MEDIUM |
| User behavior anomaly | Login from unusual location/time | Geo-velocity check | LOW |

**Implementation:**
- **Scheduled Job:** pg_cron triggers `anomaly-detection-suite` Edge Function hourly
- **Results Table:** `anomaly_alerts` (type, entity_type, entity_id, severity, details, resolved_at)
- **Notification:** Slack + email via `alert-notifier` for HIGH severity
- **Dashboard:** Anomaly feed widget with acknowledge/resolve actions

### 6.4 Smart Notifications & Alert Intelligence

**Current State:** `NotificationCenter.tsx` (in-app), `alert-notifier` (Slack + email for CRITICAL), `send-email` (transactional email). No intelligence in routing or timing.

#### AI Enhancements

**6.4.1 Notification Priority Scoring**
- **Model:** Rules + ML: estimate notification importance based on context
- **Factors:** Recipient's role, entity value, time sensitivity, recent activity
- **Output:** Priority bucket: immediate / batched (hourly) / digest (daily)

**6.4.2 Optimal Send Time**
- Learn from historical notification read patterns per user
- Send notifications when user is most likely to respond
- Respect do-not-disturb preferences stored in user profile

**6.4.3 Notification Summarization**
- Instead of 10 individual "New lead assigned" notifications, generate: "10 new leads assigned. 3 are high-priority (score > 80). Top lead: Company X ($50K estimated)."
- **Model:** GPT-4o-mini for batch summarization

### 6.5 Semantic Search Upgrade (HTS, Emails, Documents)

**Current State:** `search_hts_codes_smart` uses pg_trgm + FTS. No vector/semantic search anywhere.

#### Upgrade Plan

| Search Domain | Current | Upgrade | Priority |
|--------------|---------|---------|----------|
| HTS Codes | Trigram + FTS | Trigram + FTS + Vector (hybrid) | HIGH |
| Emails | Full-text search (search-emails fn) | FTS + Vector (semantic) | HIGH |
| Documents | None | Vector search with metadata filtering | MEDIUM |
| Leads/Accounts | Basic text filter | Vector similarity for lookalike search | LOW |
| Knowledge Base | None (new) | Vector search as primary | HIGH |

**Embedding Backfill Strategy:**
1. HTS codes: ~50K records × 100 tokens avg = 5M tokens → $0.10 cost
2. Emails: Batch embed on sync, new emails embedded on ingestion
3. Documents: Embed on upload, re-embed on content change
4. Knowledge base: Embed on create/update

### 6.6 AI-Powered Reporting & Analytics

**Current State:** `dashboardAnalytics.ts` provides basic RPCs for revenue, profit, carrier volume. `Reports.tsx` shows bar/line charts for 12-month history. Customizable widget system in `Dashboards.tsx`.

#### AI Enhancements

**6.6.1 Natural Language Dashboard Queries**
- "What was our revenue from ocean freight last quarter?"
- **Implementation:** Parse query → generate SQL via text-to-SQL → execute → format response
- **Model:** GPT-4o-mini with schema context
- **Safety:** Read-only queries only, wrapped in transaction with ROLLBACK

**6.6.2 Automated Insights Generation**
- Daily batch job analyzes metrics for noteworthy changes
- Generate bullet-point insights: "Revenue up 15% MoM driven by APAC ocean freight"
- **Display:** "AI Insights" card on dashboard homepage
- **Model:** GPT-4o-mini with time-series comparison data

**6.6.3 Predictive Revenue Forecasting**
- Combine pipeline data (opportunities × win probability) with historical seasonal patterns
- Generate quarterly revenue forecast with confidence intervals
- **Model:** Prophet for seasonality + pipeline-weighted sum
- **Display:** Forecast chart widget in dashboard

---

## 7. Data Flow Diagrams

### 7.1 RAG Query Pipeline

```
User Query (natural language)
  │
  ├─── 1. PII Sanitization (_shared/pii-guard.ts)
  │         Strip emails, phones, SSNs, passport numbers
  │
  ├─── 2. Generate Query Embedding
  │         OpenAI text-embedding-3-small (1536 dims)
  │
  ├─── 3. Vector Search (tenant-scoped)
  │         match_documents_scoped(embedding, tenant_id, threshold=0.78, limit=10)
  │         Returns: documents with similarity scores
  │
  ├─── 4. Context Assembly
  │         Concatenate top-k results (max 4000 tokens)
  │         Add metadata: source document, content_type
  │
  ├─── 5. LLM Completion (streaming)
  │         System prompt + RAG context + user query
  │         Model: GPT-4o-mini (Tier 2)
  │         Output: answer + source citations
  │
  ├─── 6. Audit Log
  │         ai_audit_logs: function, model, tokens, cost, latency, cache_hit
  │
  └─── 7. Stream to UI (Vercel AI SDK SSE)
```

### 7.2 Email Classification Pipeline

```
Inbound Email (provider webhook)
  │
  ├─── 1. ingest-email (Edge Function)
  │         Store in emails table
  │
  ├─── 2. Generate Embedding
  │         text-embedding-3-small(subject + body[:500])
  │         Store in emails.embedding
  │
  ├─── 3. classify-email (Edge Function) [UPGRADED]
  │         Gemini 2.0 Flash: category, sentiment, urgency, intent
  │         Extract entities: shipment_ref, container_numbers, PO numbers
  │         Detect buying signals: budget, timeline, authority
  │
  ├─── 4. route-email (Edge Function)
  │         Assign queue + SLA based on classification
  │         If urgency=critical → immediate notification
  │
  ├─── 5. Contact Match
  │         If from_email matches a contact → auto-link to lead/opportunity
  │         Auto-create email activity
  │
  └─── 6. Display in EmailInbox with AI badges
            Category chip, sentiment indicator, urgency flag
```

### 7.3 Smart Quote Generation Pipeline

```
User fills MultiModalQuoteComposer
  │
  ├─── 1. Commodity Classification
  │         ai-advisor: classify_commodity → HTS code, type
  │
  ├─── 2. Transport Mode Suggestion
  │         suggest-transport-mode: Gemini → OpenAI → heuristic
  │
  ├─── 3. Compliance Pre-Check
  │         screen_restricted_party(shipper) + screen_restricted_party(consignee)
  │         Cached for 24h per contact
  │
  ├─── 4. Rate Retrieval
  │         rate-engine: carrier_rates (3-tier) + simulation
  │         Returns 10+ options with CO2 estimates
  │
  ├─── 5. AI Smart Quote Generation
  │         ai-advisor: generate_smart_quotes
  │         GPT-4o: 5 options (Best Value, Cheapest, Fastest, Greenest, Reliable)
  │         Cache: ai_quote_cache (24h TTL)
  │         Audit: quote_audit_logs
  │
  ├─── 6. [NEW] Personalized Ranking
  │         Re-rank options based on customer's historical preferences
  │         Add acceptance probability per option
  │
  ├─── 7. Save to quotation_versions + quotation_version_options
  │
  └─── 8. Share via QuotePortal token
            Customer views, chatbot assists, accepts
```

### 7.4 Lead Scoring ML Pipeline

```
Lead Created / Updated / Activity Logged
  │
  ├─── 1. Feature Collection
  │         leads table: demographic features
  │         lead_activities: behavioral features (windowed)
  │         emails: engagement signals (if linked)
  │         opportunities: conversion context
  │
  ├─── 2. Rule-Based Score (preserved as baseline)
  │         calculate-lead-score edge function
  │         Output: leads.lead_score (0-100)
  │
  ├─── 3. [NEW] ML Score
  │         Feature vector → XGBoost model → probability
  │         Output: leads.ai_score (0-100) + leads.ai_score_factors (JSONB)
  │
  ├─── 4. [NEW] Score Comparison
  │         If |rule_score - ml_score| > 20 → flag for review
  │
  ├─── 5. Log to lead_score_logs
  │         Include both scores for A/B analysis
  │
  └─── 6. Display in LeadScoringCard
            Show ML score with factor breakdown
            Grade: A (80+), B (60-79), C (40-59), D (<40)
```

### 7.5 Demand Forecasting Pipeline

```
Scheduled Trigger (pg_cron, weekly)
  │
  ├─── 1. Data Collection
  │         cargo_details: monthly aggregates by HS code
  │         quotes: conversion rates (leading indicator)
  │         [External]: commodity indices, economic indicators
  │
  ├─── 2. Statistical Models (Python microservice)
  │         Prophet: seasonal decomposition + holidays
  │         LightGBM: feature-rich prediction (external data)
  │         TimesFM: zero-shot foundation model
  │
  ├─── 3. Ensemble Combination
  │         Weighted average based on recent accuracy
  │         Confidence interval from model disagreement
  │
  ├─── 4. LLM Narrative (GPT-4o-mini)
  │         Generate human-readable explanation
  │         Market context, risk factors, recommendations
  │
  ├─── 5. Store Results
  │         demand_predictions: date, volume, confidence, factors
  │
  ├─── 6. Alerting
  │         If predicted demand > warehouse capacity → alert
  │         If predicted demand change > 30% → flag
  │
  └─── 7. Dashboard Visualization
            Time series chart with prediction bands
            Risk factor callouts
```

### 7.6 Document Processing Pipeline

```
Document Upload (Supabase Storage webhook)
  │
  ├─── 1. categorize-document (Gemini Flash)
  │         Determine type: invoice, BOL, packing_list, customs_form, cargo_photo
  │
  ├─── 2. Route to Appropriate Extractor
  │         ├─ Invoice → extract-invoice-items (GPT-4o Vision)
  │         ├─ BOL → extract-bol-fields (GPT-4o Vision) [NEW]
  │         ├─ Packing List → extract-packing-list (GPT-4o Vision) [NEW]
  │         ├─ Customs Form → extract-customs-fields (GPT-4o Vision) [NEW]
  │         └─ Cargo Photo → analyze-cargo-damage (GPT-4o Vision)
  │
  ├─── 3. Validate with Zod Schema
  │         Enforce expected output structure
  │         Calculate per-field confidence scores
  │
  ├─── 4. Cross-Reference & Enrich
  │         Entity names → RestrictedPartyScreening
  │         HS codes → search_hts_codes_hybrid
  │         Amounts → landed cost calculation
  │
  ├─── 5. Store Structured Data
  │         Link extracted fields to shipment/invoice/customs records
  │         Store confidence scores per field
  │
  ├─── 6. Generate Embedding
  │         Embed document text for RAG knowledge base
  │
  └─── 7. UI Display
            Extracted fields with confidence badges (green/yellow/red)
            User corrections → extraction_corrections (feedback loop)
```

---

## 8. Performance Metrics & Success Criteria

### 8.1 Accuracy Targets by Feature

| Feature | Metric | Phase 1 Target | Phase 4 Target |
|---------|--------|----------------|----------------|
| HS Code Classification | Accuracy (6-digit) | 85% | 92% |
| Email Sentiment | F1 Score | 85% | 93% |
| Email Category | F1 Score | 82% | 90% |
| Invoice Item Extraction | Field accuracy (structured) | 90% | 95% |
| Invoice Item Extraction | Field accuracy (handwritten) | 75% | 85% |
| Lead Conversion Prediction | AUROC | 0.72 | 0.85 |
| Demand Forecast | MAPE (4-week horizon) | 18% | 10% |
| ETA Prediction | MAE (ocean) | ±2 days | ±1 day |
| ETA Prediction | MAE (air) | ±0.5 days | ±0.3 days |
| Cargo Damage Detection | Precision | 85% | 95% |
| Win Probability | AUROC | 0.70 | 0.82 |
| RAG Answer Relevance | Human eval (1-5 scale) | 3.5 | 4.2 |

### 8.2 Latency Requirements

| Feature | Max Acceptable | Target | Streaming |
|---------|---------------|--------|-----------|
| Email Classification | 5s | < 2s | No |
| Smart Quote Generation | 15s | < 8s | Yes |
| Invoice Extraction | 20s | < 10s | No |
| RAG Chat Response | 5s | < 3s (TTFT) | Yes |
| Transport Mode Suggestion | 3s | < 1.5s | No |
| Lead Score Calculation | 2s | < 1s | No |
| ETA Prediction | 3s | < 1s | No |
| Document Categorization | 3s | < 1s | No |
| Nexus Copilot | 5s | < 2s (TTFT) | Yes |

### 8.3 Business Impact KPIs

| KPI | Baseline | 6-Month Target | 12-Month Target |
|-----|----------|----------------|-----------------|
| Tier-1 support ticket deflection | 0% | 30% | 60% |
| Quote creation time | 15 min | 5 min | 2 min |
| Data entry time per shipment | 15 min | 5 min | 30 sec |
| Lead response time | 4 hours | 1 hour | 15 min (auto) |
| Demand forecast accuracy | N/A | 85% | 90% |
| Email classification accuracy | ~40% | 85% | 92% |
| Customs examination prediction | N/A | 70% | 82% |
| Revenue forecast accuracy | N/A | ±15% | ±8% |
| Short shipment fee reduction | Baseline | -10% | -20% |
| Invoice processing time | 10 min | 2 min | 30 sec |

---

## 9. Security, Privacy & Governance

### 9.1 PII Handling in LLM Prompts

**Critical Gap:** Current AI edge functions send raw data to LLM providers without PII sanitization.

**Affected Functions:**
- `ai-advisor`: Raw payload including customer names, addresses
- `extract-invoice-items`: Invoice images may contain full PII
- `forecast-demand`: Historical data may include identifiable patterns
- `classify-email`: Email body sent to Gemini/OpenAI

**Implementation — `_shared/pii-guard.ts`:**

```typescript
export function sanitizeForLLM(text: string): { sanitized: string; redacted: string[] } {
  const redacted: string[] = [];
  let sanitized = text;

  // Email addresses
  sanitized = sanitized.replace(
    /\b[\w.-]+@[\w.-]+\.\w{2,4}\b/g,
    (match) => { redacted.push('email'); return '[EMAIL]'; }
  );

  // Phone numbers (international)
  sanitized = sanitized.replace(
    /\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g,
    (match) => { redacted.push('phone'); return '[PHONE]'; }
  );

  // Credit card numbers
  sanitized = sanitized.replace(
    /\b(?:\d[ -]*?){13,16}\b/g,
    (match) => { redacted.push('card'); return '[CARD]'; }
  );

  // SSN / Tax IDs
  sanitized = sanitized.replace(
    /\b\d{3}-\d{2}-\d{4}\b/g,
    (match) => { redacted.push('ssn'); return '[SSN]'; }
  );

  // Passport numbers
  sanitized = sanitized.replace(
    /\b[A-Z]{1,2}\d{6,9}\b/g,
    (match) => { redacted.push('passport'); return '[PASSPORT]'; }
  );

  return { sanitized, redacted };
}
```

**Usage:** Apply `sanitizeForLLM()` before every LLM API call. Log redacted field types in `ai_audit_logs.pii_fields_redacted`.

### 9.2 GDPR/CCPA Compliance for AI Features

| Requirement | Implementation |
|-------------|---------------|
| **Right to Erasure** | `delete-ai-data` Edge Function: delete all embeddings, predictions, audit logs for a user/tenant |
| **Data Minimization** | Truncate inputs before LLM calls. Only send necessary context. |
| **Processing Records** | `ai_audit_logs` table with function_name, model, tokens, cost per call |
| **Consent** | `profiles.ai_consent_given_at` timestamp. Block AI features if NULL. |
| **Data Residency** | For EU tenants: use Azure OpenAI (EU region) or Anthropic EU endpoints |
| **Vendor DPAs** | Ensure DPAs with OpenAI (does NOT train on API data), Google, Anthropic |
| **Retention** | TTL on all AI-generated data: predictions (90 days), cache (24h), audit logs (1 year) |
| **Transparency** | "AI-generated" labels on all AI-produced content in UI |

### 9.3 Prompt Injection Prevention

| Attack Vector | Mitigation |
|--------------|------------|
| **Direct injection** (user input in prompt) | Separate system and user messages. Never concatenate user input into system prompt. |
| **Indirect injection** (malicious content in documents/emails) | Sanitize RAG context. Use XML delimiters: `<user_context>...</user_context>` |
| **Jailbreaking** | Use structured output (JSON Schema mode). Validate output with Zod schemas. |
| **Data exfiltration** | Never include API keys, internal URLs, or architecture details in prompts. |
| **Token limit abuse** | Set `max_tokens` on all calls. Truncate inputs before sending. |
| **Output validation** | Every LLM response parsed through Zod schema before use. Reject malformed responses. |

### 9.4 AI Audit Trail & Model Governance

**New Table: `ai_audit_logs`**

```sql
CREATE TABLE public.ai_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  user_id uuid REFERENCES auth.users(id),
  function_name text NOT NULL,
  model_used text NOT NULL,
  model_version text,
  input_tokens int,
  output_tokens int,
  total_cost_usd numeric(10,6),
  latency_ms int,
  input_hash text,                   -- SHA-256 of sanitized input (for dedup tracking)
  output_summary jsonb,              -- Structured summary, NOT raw LLM output
  pii_detected boolean DEFAULT false,
  pii_fields_redacted text[],
  cache_hit boolean DEFAULT false,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_audit_tenant_date
  ON public.ai_audit_logs (tenant_id, created_at DESC);

CREATE INDEX idx_ai_audit_function
  ON public.ai_audit_logs (function_name, created_at DESC);
```

**Usage:** Every AI edge function must log to `ai_audit_logs` with token counts and cost estimates. Dashboard widget shows AI spend per tenant/month.

---

## 10. Implementation Timeline & Phases

### 10.1 Phase 1: Foundations (Weeks 1–3)

| Week | Task | Deliverable | Dependencies |
|------|------|-------------|--------------|
| 1 | Enable pgvector extension | Migration: `CREATE EXTENSION vector` + embedding columns | None |
| 1 | Create `_shared/pii-guard.ts` | PII sanitization helper for all Edge Functions | None |
| 1 | Create `ai_audit_logs` table | Migration + audit logging helper | None |
| 1 | Create `knowledge_base` table | Migration with RLS + embedding column | pgvector |
| 2 | Implement `generate-embedding` Edge Function | Batch + single embedding generation | pgvector |
| 2 | Backfill HTS code embeddings | ~50K records, ~$0.10 cost | generate-embedding fn |
| 2 | Create `match_documents_scoped` function | RLS-aware vector search | pgvector |
| 3 | Implement real `classify-email` | Gemini 2.0 Flash, replace stub | PII guard |
| 3 | Create `_shared/model-router.ts` | Tier-based model selection helper | None |
| 3 | Retrofit existing AI functions with audit logging | ai-advisor, forecast-demand, etc. | ai_audit_logs |

**Phase 1 Cost:** ~$0.15 (embedding backfill) + development time
**Phase 1 Outcome:** RAG foundation ready, email classification live, audit trail operational

### 10.2 Phase 2: Core AI Features (Weeks 4–10)

| Week | Task | Deliverable | Dependencies |
|------|------|-------------|--------------|
| 4–5 | Hybrid HTS search | `search_hts_codes_hybrid` (trigram + FTS + vector) | Phase 1 embeddings |
| 4–5 | Email embedding pipeline | Auto-embed on ingestion, backfill existing | generate-embedding fn |
| 5–6 | Nexus Copilot MVP | RAG chatbot Edge Function + React widget | pgvector, knowledge_base |
| 6–7 | ML Lead Scoring v1 | Logistic regression model, A/B test framework | Historical lead data |
| 7–8 | Demand forecasting upgrade | TimesFM integration (zero-shot, no training) | Python microservice |
| 8–9 | ETA prediction model | LightGBM on historical shipment transit data | Historical shipment data |
| 9–10 | Document processing pipeline | categorize-document + extract-bol-fields | Gemini Flash + GPT-4o Vision |

**Phase 2 Cost:** ~$35/month API costs + development time
**Phase 2 Outcome:** Semantic search live, copilot MVP, ML scoring, real demand forecasts

### 10.3 Phase 3: Advanced Intelligence (Weeks 11–18)

| Week | Task | Deliverable | Dependencies |
|------|------|-------------|--------------|
| 11–12 | Win probability model | XGBoost classifier on opportunities | Historical opp data |
| 12–13 | Portal chatbot | RAG chatbot in QuotePortal with tool access | Nexus Copilot |
| 13–14 | Smart reply suggestions | Email draft suggestions with RAG context | Email embeddings |
| 14–15 | Supply chain risk scoring | Risk model + external data integration | External APIs |
| 15–16 | Container demand prediction | SARIMA model per container type | Historical container data |
| 16–17 | Carrier performance scoring | ML-calibrated scoring from shipment outcomes | Historical shipment data |
| 17–18 | Dynamic margin optimization | Regression: margin vs. win rate | Rate engine data |

**Phase 3 Cost:** ~$65/month API costs + Python microservice hosting
**Phase 3 Outcome:** Predictive pipeline, risk scoring, carrier intelligence, portal AI

### 10.4 Phase 4: Autonomous Operations (Weeks 19–26)

| Week | Task | Deliverable | Dependencies |
|------|------|-------------|--------------|
| 19–20 | Route optimization (VROOM) | Multi-leg optimization with AI suggestions | VROOM Docker deployment |
| 20–21 | Autonomous email handling | Auto-classify → auto-route → auto-reply (with review) | Phase 2 email AI |
| 21–22 | Anomaly detection suite | Financial + operational + quality anomaly detection | All data pipelines |
| 22–23 | Revenue forecasting | Prophet + pipeline-weighted model | Win probability model |
| 23–24 | Fleet utilization optimization | OR-Tools assignment model | Fleet management data |
| 24–25 | Ensemble demand forecasting | Prophet + LightGBM + TimesFM + LLM narrative | Phase 2 models |
| 25–26 | AI agent with tool calling | Multi-tool autonomous agent (rate, compliance, booking) | All tools built |

**Phase 4 Cost:** ~$120/month API costs + additional infrastructure
**Phase 4 Outcome:** Autonomous operations, full predictive suite, AI agent

### 10.5 Gantt Chart Overview

```
Week:     1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26
          ├──────────┤
Phase 1:  ██████████│  FOUNDATIONS
          │         ├──────────────────────────┤
Phase 2:  │         │ ████████████████████████│  CORE AI
          │         │                         ├──────────────────────────────┤
Phase 3:  │         │                         │ ████████████████████████████│  ADVANCED
          │         │                         │                             ├────────────────┤
Phase 4:  │         │                         │                             │ ████████████████│  AUTONOMOUS

Key Milestones:
  Week 1:  pgvector enabled, PII guard deployed
  Week 3:  Email classification live, audit trail active
  Week 6:  Nexus Copilot MVP launched
  Week 8:  Real demand forecasting operational
  Week 10: Document processing pipeline complete
  Week 14: Portal chatbot live
  Week 18: Carrier intelligence + risk scoring live
  Week 22: Autonomous email handling active
  Week 26: Full AI agent with tool calling
```

---

## 11. Resource Requirements

### 11.1 Team Composition

| Role | Count | Phase | Responsibilities |
|------|-------|-------|-----------------|
| **AI/ML Engineer** | 2 | All | Model development, training pipelines, Edge Function AI logic |
| **Full Stack Developer** | 2 | All | React UI integration, Edge Functions, database migrations |
| **Data Engineer** | 1 | Phase 2+ | ETL pipelines, embedding backfills, external data integration |
| **Domain Expert (Logistics)** | 1 (part-time) | All | Validation of AI outputs, training data curation, business rules |
| **DevOps/MLOps** | 1 (part-time) | Phase 2+ | Python microservice deployment, monitoring, model serving |
| **QA Engineer** | 1 | All | AI output validation, accuracy benchmarking, regression testing |

**Total:** 6 FTEs + 2 part-time = ~7 FTE equivalent

### 11.2 Infrastructure Costs

| Component | Current | Phase 1 | Phase 2 | Phase 4 | Notes |
|-----------|---------|---------|---------|---------|-------|
| Supabase (Pro) | $25/mo | $25/mo | $25/mo | $25/mo | pgvector included |
| Supabase Edge Functions | Included | Included | Included | Included | 500K invocations/mo |
| Python Microservice (Fly.io) | $0 | $0 | $5/mo | $15/mo | For ML models |
| VROOM Container (Docker) | $0 | $0 | $0 | $10/mo | Route optimization |
| External Data APIs | $0 | $0 | $20/mo | $50/mo | MarineTraffic, weather |
| **Infrastructure Total** | **$25/mo** | **$25/mo** | **$50/mo** | **$100/mo** | |

### 11.3 API Cost Projections

| Feature | Monthly Calls | Model | Phase 1 | Phase 2 | Phase 4 |
|---------|--------------|-------|---------|---------|---------|
| Smart Quote Generation | 1,500 | GPT-4o | $37.50 | $37.50 | $37.50 |
| Email Classification | 15,000 | Gemini Flash | $0.90 | $0.90 | $0.90 |
| Invoice Extraction | 600 | GPT-4o Vision | — | $7.50 | $7.50 |
| Cargo Damage Analysis | 200 | GPT-4o Vision | — | $2.50 | $2.50 |
| Demand Forecasting | 300 | GPT-4o-mini | — | $0.15 | $0.15 |
| Transport Mode Suggestion | 3,000 | Gemini Flash | $0.18 | $0.18 | $0.18 |
| RAG Queries (Copilot) | 5,000 | GPT-4o-mini | — | $2.25 | $2.25 |
| Embedding Generation | 20,000 docs | text-embedding-3-small | $0.10 | $0.80 | $0.80 |
| Lead Score ML Enrichment | 6,000 | GPT-4o-mini | — | — | $0.90 |
| Document Categorization | 2,000 | Gemini Flash | — | $0.12 | $0.12 |
| BOL/Packing List Extraction | 500 | GPT-4o Vision | — | — | $6.25 |
| Notification Summarization | 10,000 | GPT-4o-mini | — | — | $0.45 |
| Portal Chatbot | 3,000 | GPT-4o-mini | — | — | $1.35 |
| **API Total** | | | **~$39/mo** | **~$52/mo** | **~$61/mo** |

**Grand Total (Infrastructure + API):**
- Phase 1: ~$64/month
- Phase 2: ~$102/month
- Phase 4: ~$161/month

---

## 12. Risk Assessment & Mitigation

### 12.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| LLM API outage (OpenAI/Google) | Medium | HIGH | Multi-provider fallback (already done for transport mode). Implement for all functions. |
| pgvector performance at scale | Low | Medium | HNSW indexes with tuned parameters. Partition by tenant if >5M vectors. |
| Model accuracy degradation over time | Medium | Medium | Monthly accuracy benchmarking. Retrain schedule. A/B testing framework. |
| Edge Function cold start latency | Medium | Medium | Keep-alive pings, warm-up on deploy. |
| Embedding model version change | Low | Medium | Store model_version with embeddings. Re-embed on model change. |
| Python microservice reliability | Medium | Medium | Health checks, auto-restart, replicas. |

### 12.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Insufficient training data | HIGH | HIGH | Start with zero-shot models (TimesFM, LLM classification). Collect labeled data over time. |
| User distrust of AI outputs | Medium | Medium | Confidence scores on all AI outputs. Human review for low confidence. "AI-generated" labels. |
| AI cost overrun | Medium | Medium | Token budgets per function. Cost alerts in ai_audit_logs. Monthly cost review. |
| Hallucination in compliance contexts | Medium | HIGH | Never use LLM-only for compliance decisions. Always cross-reference with authoritative data. Human review required. |
| Data quality issues in training | HIGH | HIGH | Data validation pipeline. Outlier detection. Manual review of training samples. |

### 12.3 Compliance Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| PII sent to LLM providers | HIGH (current) | HIGH | Implement `pii-guard.ts` ASAP. Mandatory for all AI functions. |
| GDPR right to erasure for AI data | Medium | HIGH | `delete-ai-data` function. Cascade delete embeddings + predictions + audit logs. |
| AI bias in lead scoring | Medium | Medium | Regular bias audits. Demographic parity checks. Transparent factor breakdown. |
| Regulatory change (EU AI Act) | Medium | Medium | AI audit trail ready. Human-in-the-loop for high-risk decisions. Model cards. |
| Model vendor data usage | Low | HIGH | Verify DPAs. OpenAI/Anthropic do NOT train on API data. Google: verify terms. |

### 12.4 Risk Mitigation Matrix

```
                    LOW IMPACT              HIGH IMPACT
              ┌─────────────────────┬─────────────────────┐
 HIGH PROB    │ - Data quality      │ - PII in prompts    │
              │ - Insufficient      │ - Hallucination in  │
              │   training data     │   compliance        │
              │                     │                     │
              │ Action: MANAGE      │ Action: PRIORITIZE  │
              ├─────────────────────┼─────────────────────┤
 LOW PROB     │ - Embedding model   │ - API provider      │
              │   version change    │   outage            │
              │ - Cold start        │ - GDPR erasure      │
              │   latency           │   complexity        │
              │                     │                     │
              │ Action: ACCEPT      │ Action: MITIGATE    │
              └─────────────────────┴─────────────────────┘
```

---

## 13. Appendices

### 13.1 Existing Codebase Integration Points

| Module | Key Files | AI Enhancement Points |
|--------|-----------|----------------------|
| **Shipment** | `ShipmentNew.tsx`, `ShipmentForm.tsx`, `Shipments.tsx` | ETA prediction, damage risk, milestone forecasting |
| **Warehouse** | `Warehouses.tsx`, `WarehouseNew.tsx`, `WarehouseForm.tsx` | Capacity forecasting, cross-dock optimization |
| **Container** | `ContainerTracking.tsx`, `ContainerAnalytics.tsx` | Demand prediction, auto-matching, repositioning |
| **Routing** | `TransportModeSelector.tsx`, `LegsConfigurationStep.tsx` | ML mode selection, multi-leg optimization |
| **Carrier** | `Carriers.tsx`, `CarrierForm.tsx`, `Vessels.tsx` | Performance scoring, fleet optimization |
| **Compliance** | `RestrictedPartyScreening.tsx`, `CustomsClearancePipeline.tsx` | AI HS classification, risk scoring, doc compliance |
| **Quote** | `MultiModalQuoteComposer.tsx`, `QuoteDetailsStep.tsx` | Smart ranking, acceptance prediction, reconciliation |
| **Invoice** | `InvoiceService.ts` | Auto-extraction, reconciliation, anomaly detection |
| **Lead** | `Leads.tsx`, `LeadScoringCard.tsx`, `LeadAssignment.tsx` | ML scoring, smart routing, enrichment |
| **Email** | `EmailInbox.tsx`, `EmailDetailView.tsx`, `EmailFilters.tsx` | LLM classification, summarization, smart reply |
| **Portal** | `QuotePortal.tsx` | RAG chatbot, personalized quotes |
| **Pipeline** | `OpportunitiesPipeline.tsx`, `Opportunities.tsx` | Win probability, stall detection, forecasting |
| **Analytics** | `dashboardAnalytics.ts`, `Reports.tsx`, `Dashboards.tsx` | NL queries, automated insights, predictive forecasts |
| **Notifications** | `NotificationCenter.tsx`, `alert-notifier` fn | Smart routing, timing, summarization |

### 13.2 Database Migration Templates

**Migration naming convention:** `YYYYMMDDHHMMSS_<description>.sql`

**Required migrations for Phase 1:**
1. `20260208000000_enable_pgvector.sql` — Enable pgvector extension, add embedding columns
2. `20260208000001_create_knowledge_base.sql` — Knowledge base table with RLS
3. `20260208000002_create_ai_audit_logs.sql` — AI audit trail table
4. `20260208000003_create_match_documents_scoped.sql` — RLS-aware vector search function
5. `20260208000004_add_ai_fields_to_emails.sql` — `ai_classification`, `ai_summary`, `embedding` columns
6. `20260208000005_add_ai_fields_to_leads.sql` — `ai_score`, `ai_score_factors`, `embedding` columns

### 13.3 Edge Function Patterns

**Standard AI Edge Function Template:**

```typescript
// supabase/functions/<function-name>/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { getModelConfig } from "../_shared/model-router.ts";
import { logAiCall } from "../_shared/ai-audit.ts";

serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  const startTime = Date.now();
  const { user, error: authError } = await requireAuth(req);
  if (authError) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

  try {
    const body = await req.json();
    const { sanitized, redacted } = sanitizeForLLM(JSON.stringify(body));
    const model = getModelConfig('classification'); // or 'moderate', 'complex'

    // ... AI logic here ...

    await logAiCall({
      tenant_id: user.user_metadata?.tenant_id,
      user_id: user.id,
      function_name: '<function-name>',
      model_used: model.model,
      input_tokens: /* from response */, output_tokens: /* from response */,
      total_cost_usd: /* calculated */,
      latency_ms: Date.now() - startTime,
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
      cache_hit: false
    });

    return new Response(JSON.stringify(result), { headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
});
```

### 13.4 Glossary

| Term | Definition |
|------|-----------|
| **RAG** | Retrieval-Augmented Generation — LLM responses grounded in retrieved documents |
| **pgvector** | PostgreSQL extension for vector similarity search |
| **HNSW** | Hierarchical Navigable Small World — graph-based approximate nearest neighbor index |
| **MAPE** | Mean Absolute Percentage Error — forecast accuracy metric |
| **AUROC** | Area Under Receiver Operating Characteristic — classification accuracy metric |
| **TTFT** | Time To First Token — streaming response latency metric |
| **TEU** | Twenty-foot Equivalent Unit — standard container size measure |
| **HTS** | Harmonized Tariff Schedule — customs commodity classification system |
| **SCAC** | Standard Carrier Alpha Code — carrier identification |
| **IMO** | International Maritime Organization — vessel identification |
| **DGR** | Dangerous Goods Regulations — hazardous material classification |
| **BDI** | Baltic Dry Index — shipping market indicator |
| **SCFI** | Shanghai Containerized Freight Index — container shipping rate index |
| **LCL** | Less than Container Load — shared container shipment |
| **FCL** | Full Container Load — dedicated container shipment |

---

**Document End**

*This specification should be read alongside `docs/NEXT_GEN_PLATFORM_STRATEGY.md` which provides the strategic vision. This document translates that vision into actionable, implementation-ready specifications grounded in the actual codebase architecture.*

---

**Version:** 1.0 | **Pages:** ~60 | **Last Updated:** 2026-02-07
