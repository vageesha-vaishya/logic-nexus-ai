# Engine Module Benchmark Matrix

| Capability | SAP MRO | IBM Maximo Aviation | Ramco Aviation | Current (AMRO) | Gap Notes |
|---|---|---|---|---|---|
| Lifecycle & Config Graph | Equipment hierarchies, functional locations, shop visit dossiers | Complex asset config, meters, job plans | Engine shop visit, rotable/LLP, config lineage | Lifecycle, on‑wing, serialized tracking, config panel | Add formal config graph, LLP stack editor, shop visit context |
| Next‑Due Scheduling | PM orders, task lists, strategies, add‑ons for predictive | Meters, condition monitoring, assignment rules | Time/cycle/usage policies integrated with planner | Schedule list, conflicts, resources; predictive candidates | Engine‑specific next‑due API + constraint solver hooks |
| Parts & Trace | Reservations, procurement, batch trace | Inventory, reservations, trace, lot control | Materials with rotable pools and traceability | Parts tracking in WOs, ERP sync events | Add serialized trace self‑service search |
| Work Orders | Creation, assignment, execution, closure | Job plans, work orders, workflow | Shop visit packages, task cards | Work packages, totals, digital signatures | First‑class engine shop visit flow and task card packs |
| Compliance | AD/SB, gate checks, audit | Compliance status and audit | Regulator scenarios, release controls | AD/SB counters, regulatory profiles | Auto‑dossier assembly per engine shop visit |
| Predictive | Add‑on predictive PM | Condition monitoring, KPIs | Reliability/predictive modules | Anomaly index, failure prediction score | Model registry, versioning, drift, explainability |

## Architectural Recommendations
- Microservice split: engine‑core, engine‑schedule, engine‑intelligence
- API contracts: API‑ENG‑001..004 (read model, config graph, next‑due, performance)
- Read models for sub‑second p95 engine dashboards; additive API evolution
- Observability: traces per engine API; synthetic checks for p95 SLOs

## P0/P1/P2 Roadmap
- P0: Read‑models, config panel, API‑ENG‑001/002
- P1: Next‑due service, compliance gate hooks, WO linkage
- P2: Predictive pipelines, model governance, performance history API‑ENG‑004
