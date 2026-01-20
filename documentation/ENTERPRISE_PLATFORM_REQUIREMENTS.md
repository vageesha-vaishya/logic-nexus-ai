# Enterprise Platform Master Plan: Logic Nexus AI

## 1. GAP Analysis & Market Differentiation

### 1.1 Comparative Landscape Analysis

This analysis benchmarks **Logic Nexus AI** against Tier-1 CRM leaders and specialized Logistics Platforms. The goal is to identify high-value gaps where Logic Nexus AI can disrupt the market through superior UX, AI integration, and a franchise-first architecture.

| Feature Domain | Logic Nexus AI (Target) | Salesforce / HubSpot | CargoWise / Magaya | Strategic Gap / Opportunity |
| :--- | :--- | :--- | :--- | :--- |
| **User Experience (UX)** | **Consumer-grade**: Fast (SPA), Keyboard-first (Cmd+K), Dark mode, Context-aware. | **Salesforce**: Legacy Lightning UI, slow page loads. <br> **HubSpot**: Good, but generic (no logistics context). | **Legacy Desktop**: Windows-forms style, dense grids, high learning curve (2-3 months training). | **Critical**: Logistics users want "Slack-like" speed. We win by reducing clicks-to-shipment by 50%. |
| **Automation & Workflow** | **AI-Native**: "Draft quote from this email", "Alert me if ETA slips > 2 days". | **Rules-based**: Powerful flows but requires admin setup. Not shipping-aware. | **Rigid**: Hardcoded logic for standard shipping. Customization requires expensive consultancy. | **High**: We replace "Admin Configuration" with "AI Intent". |
| **Integration Ecosystem** | **API-First**: Open REST/GraphQL, Webhooks, standard JSON schemas. | **Marketplace**: Massive ecosystem but expensive per-seat connectors. | **Closed**: EDI-heavy, proprietary formats, high fees for API access. | **Medium**: Win developers with better DX (Developer Experience). |
| **Multi-Tenancy** | **Franchise-Native**: Tenant -> Franchise -> User hierarchy built-in. | **Org-based**: One org = one company. Hard to model franchise networks without custom code. | **Instance-based**: Often requires separate DBs/instances for large franchises. | **Winning Feature**: Native support for global freight networks. |
| **Pricing Model** | **Usage/Value-based**: Pay per shipment/user. | **Seat-based**: High per-user cost ($100+/mo). | **Transaction-based**: Complex fees per file/user/module. | **Commercial**: Disrupt with transparent, scalable pricing. |

### 1.2 Detailed Functional Gaps

#### A. User Experience (UX)
*   **Gap**: Legacy platforms require "Alt+Tab" switching between email, TMS, and spreadsheets.
*   **Requirement**: **Unified Workspace**.
    *   Embedded Email Client (Outlook/Gmail sync) contextually linked to Shipments.
    *   "Smart Command Bar" (Cmd+K) to jump to *INV-2024-001* or *Customer: Apple Inc*.
    *   **Personalization**: User-saved column layouts, filter sets ("My Air Exports"), and drag-and-drop widget dashboards.

#### B. Automation & Kanban
*   **Gap**: Logistics ops are task-heavy. Existing tools use static lists.
*   **Requirement**: **Visual Workflow Management**.
    *   **Kanban Boards**: Drag-and-drop for Opportunity Stages (*Lead -> Quote -> Closed*) and Shipment Milestones (*Booked -> In Transit -> Arrived*).
    *   **Swimlanes**: Group by assignee, carrier, or priority.
    *   **WIP Limits**: Visual warnings when a user has too many active files.
    *   **Automation**: Dragging a card to "Booked" auto-triggers an email to the carrier.

#### C. Integration
*   **Gap**: Lack of real-time visibility and accounting sync in mid-market tools.
*   **Requirement**: **Seamless Connectivity**.
    *   **Connectors**: Native integrations for Xero/QuickBooks (Invoices), project44/Vizion (Container Tracking).
    *   **EDI Engine**: Capability to parse X12 (204, 214, 310) and EDIFACT messages for enterprise clients.

#### D. Reporting
*   **Gap**: "Black Box" analytics. Reports are historical, not predictive.
*   **Requirement**: **Actionable Intelligence**.
    *   **Real-time Dashboards**: "Live Profitability" per trade lane.
    *   **Geospatial**: Live map view of all cargo in transit (AIS data integration).
    *   **Custom Builder**: Self-service pivot tables for Finance teams.

#### E. Scalability
*   **Gap**: Performance degradation at >500 concurrent users in legacy web apps.
*   **Requirement**: **Hyper-Scale Architecture**.
    *   **Horizontal Scaling**: Stateless application tier (Kubernetes).
    *   **Data Partitioning**: Tenant-based sharding strategy for PostgreSQL.
    *   **Global Caching**: Cloudflare Workers for edge caching of static assets and read-heavy API responses.

### 1.3 Quantitative Benchmarks

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **Transaction Throughput** | **5,000 TPS** | Handles peak "End of Month" closing volume for 500+ franchises. |
| **API Latency (P95)** | **< 100ms** | Required for seamless UI interactions (perceptual instant). |
| **Concurrent Users** | **10,000+** | Supports global rollout (Asia/Europe/US active simultaneously). |
| **Search Speed** | **< 50ms** | Elasticsearch/Meilisearch backend for instant record retrieval. |
| **Uptime SLA** | **99.99%** | Critical logistics infrastructure (cannot go down during customs filing). |

---

## 2. Technical Design Document

### 2.1 Architectural Blueprints

#### A. Hybrid Cloud Deployment Model
*   **Concept**: Cloud-first control plane with optional "Edge Agents" for local device connectivity (Printers, Scales, On-prem ERPs).

```mermaid
graph TD
    subgraph "Client Layer"
        Web[React PWA (Offline Support)]
        Mobile[Native iOS/Android]
    end

    subgraph "Global Edge (Cloudflare)"
        WAF[WAF & DDoS Protection]
        EdgeCache[Static Assets & API Cache]
        EdgeWorkers[Routing & Auth Verification]
    end

    subgraph "Core Platform (AWS Sydney)"
        Ingress[ALB Ingress Controller]
        
        subgraph "Kubernetes Cluster"
            API[API Gateway (NestJS/Go)]
            Workflow[Temporal.io Workers]
            PDF[PDF Generation Svc]
            AI[LLM Inference Proxy]
        end
        
        subgraph "Data Persistence"
            Postgres[(Supabase DB Cluster)]
            Redis[(Redis Cache)]
            Vector[(pgvector Embeddings)]
            S3[S3 Document Store]
        end
    end

    subgraph "Local Franchise Infrastructure"
        LocalAgent[Node.js Edge Agent]
        Hardware[Zebra Printers / Scales]
    end

    Web --> WAF
    WAF --> EdgeWorkers
    EdgeWorkers --> Ingress
    Ingress --> API
    API --> Workflow
    API --> Postgres
    API --> Redis
    Workflow --> AI
    LocalAgent -- WebSocket --> API
    LocalAgent --> Hardware
```

#### B. Network Topology (Multi-Region)
*   **Primary (Write)**: `ap-southeast-2` (Sydney).
*   **Read Replicas**: `us-east-1` (N. Virginia), `eu-central-1` (Frankfurt) for <100ms read latency globally.
*   **Data Residency**: Tenant-specific capability to pin data to a specific region (GDPR compliance).

### 2.2 AI & Cognitive Services Specification

#### A. RAG (Retrieval-Augmented Generation) Architecture
*   **Vector Database**: **Supabase `pgvector`**.
    *   *Why*: Keeps vector embeddings adjacent to relational data (RLS applies automatically). No need for external Pinecone/Weaviate sync.
*   **Embedding Model**: `text-embedding-3-small` (1536 dimensions). Efficient and cheap.
*   **Context Window**: 128k tokens (GPT-4o) allows feeding full HBLs and Invoices into the prompt.

#### B. Conversational AI ("Nexus Copilot")
*   **Interface**: Floating chat + "Ask AI" button on every form field.
*   **Skills**:
    *   *Query*: "Show me all FCL shipments to Rotterdam departing next week."
    *   *Action*: "Draft an email to the consignee about the delay."
    *   *Analysis*: "Why is our margin on Air Freight dropping?" (Queries analytics DB).
*   **Accuracy**: >95% intent recognition via fine-tuned classifier (DistilBERT) before hitting LLM.

#### C. Predictive Analytics
*   **ETA Prediction**: XGBoost model trained on historical carrier performance + AIS live data.
*   **Dynamic Pricing**: Random Forest model inputs: Spot Rate Indices (SCFI), Carrier Capacity, Customer Loyalty Score. Target: **85% win-rate prediction accuracy**.

### 2.3 Security & Compliance Framework

#### A. Certifications Roadmap
*   **ISO 27001:2022**: Focus on Annex A controls (A.5.7 Threat Intel, A.8.12 Data Leakage Prevention).
*   **SOC 2 Type II**:
    *   *Security*: WAF, mTLS, RBAC.
    *   *Availability*: Multi-AZ deployment, DR Failover < 15 mins.
    *   *Confidentiality*: Field-level encryption for PII.

#### B. Encryption Standards
*   **Data at Rest**: AES-256 (GCM mode). Keys managed via AWS KMS (Key Management Service).
*   **Data in Transit**: TLS 1.3 only. HSTS enabled.
*   **Database**: Transparent Data Encryption (TDE) enabled on Postgres volumes.

### 2.4 Microservices Strategy

*   **Orchestration**: **Kubernetes (EKS)**.
    *   *Namespace Isolation*: Per-module (Sales, Ops, Finance) or Per-Tenant (for Enterprise VIPs).
*   **Service Mesh**: **Linkerd**. Lightweight, adds mTLS and "Golden Metrics" (Success Rate, Latency, Throughput) automatically.
*   **CI/CD**: GitHub Actions.
    *   *Feature Branch*: Unit Tests + SonarQube Linting.
    *   *Staging*: Ephemeral environment creation -> E2E Cypress Tests.
    *   *Prod*: Canary deployment (rollout to 5% of traffic).

---

## 3. Competitive Advantage & Implementation Plan

### 3.1 AI Feature Roadmap

| Phase | Feature | Technical Implementation | Value Prop |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Smart Email Parsing** | LLM extracts `BOL #`, `Container #` from emails -> Updates Shipment. | Eliminates manual data entry (saves ~2h/day). |
| **Phase 1** | **Kanban Automation** | `@dnd-kit` triggers -> Temporal Workflows (e.g., "Send Booking Conf"). | Visualizes "Invisible" work; ensures SOP compliance. |
| **Phase 2** | **Dynamic Pricing** | Python/Pandas Service -> Real-time margin calc based on volatility. | Protects margins; faster quote turnaround. |
| **Phase 3** | **Route Optimizer** | Graph Database (Neo4j) pathfinding -> Cost/Time/CO2 weighting. | Offers customers "Green" vs "Fast" vs "Cheap" options. |

### 3.2 Phased Implementation Plan (6-Month Sprint Cycles)

#### Cycle 1: Foundation & "The Visual Shift" (Months 1-2)
*   **Sprint 1-2 (Wk 1-4)**:
    *   **Core**: Setup Supabase RLS for Franchise Hierarchy.
    *   **Feature**: **Kanban Board v1**. Drag-and-drop Opportunities.
    *   **UX**: "Command+K" Global Search.
*   **Sprint 3-4 (Wk 5-8)**:
    *   **Integration**: Email Sync (Gmail/Outlook API).
    *   **AI**: "Chat with Email" (RAG foundation).
    *   **Test**: 1,000 concurrent user load test (k6).

#### Cycle 2: Intelligence & Connectivity (Months 3-4)
*   **Sprint 5-6 (Wk 9-12)**:
    *   **Feature**: **Shipment Kanban**. Swimlanes by Carrier.
    *   **Integration**: Container Tracking Webhooks (project44).
    *   **AI**: Dynamic Pricing Beta.
*   **Sprint 7-8 (Wk 13-16)**:
    *   **Mobile**: React Native Beta (Scanner/POD).
    *   **Reporting**: PowerBI embedded dashboards.

#### Cycle 3: Enterprise Scale (Months 5-6)
*   **Sprint 9-10 (Wk 17-20)**:
    *   **Security**: ISO 27001 Audit Prep. Pen-testing.
    *   **Scale**: Multi-region Read Replicas setup.
*   **Sprint 11-12 (Wk 21-24)**:
    *   **Launch**: GA Release.
    *   **Migration**: "One-Click Import" for CargoWise data.

### 3.3 Technology Stack Selection Matrix

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19 + Vite** | Standard for enterprise SPAs. Ecosystem (TanStack Query/Table) is unmatched. |
| **UI Library** | **Shadcn/UI + Tailwind** | Accessible, copy-paste components (no vendor lock-in), highly customizable theme. |
| **Kanban Engine** | **@dnd-kit** | Modern, accessible, mobile-friendly drag-and-drop primitives. |
| **Backend / DB** | **Supabase (Postgres)** | "Backend-as-a-Service" speed with "Enterprise SQL" power. Native Auth + Realtime. |
| **Edge Compute** | **Supabase Edge Functions** | Run TS code close to user. Low cold-start latency compared to AWS Lambda. |
| **Workflow Engine** | **Temporal.io** | "Durable Execution". Guarantees code runs even if server crashes (critical for 30-day shipment flows). |
| **Analytics DB** | **Tinybird (ClickHouse)** | Ingests high-velocity events (clicks, tracking updates) for real-time dashboards. |
