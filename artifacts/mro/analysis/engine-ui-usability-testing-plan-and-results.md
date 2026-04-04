# Engine UI Usability Testing Plan and Results

## Scope
- Surface under test: AMRO Aircraft -> Engine workspace.
- Build target: redesigned command-center UI.
- User goals:
- locate critical engine risk within 10 seconds;
- identify next actionable maintenance item;
- confirm compliance readiness for release;
- complete validated engine data entry.

## Target Users
- Maintenance Planner
- Line Maintenance Engineer
- Reliability Engineer
- Compliance Officer

## Task Matrix
| Task ID | Task Description | Success Criteria | Time Target |
|---|---|---|---|
| T1 | Find current engine risk state | User identifies risk score/status from header cards | <= 10s |
| T2 | Locate next due maintenance package | User opens maintenance lane and identifies due item | <= 20s |
| T3 | Verify AD/SB readiness | User reports ready/pending/overdue summary | <= 20s |
| T4 | Find latest anomaly evidence | User identifies anomaly list and confidence context | <= 20s |
| T5 | Validate engine data entry form | User submits valid serial/module/TSN/CSN | <= 30s |

## Instrumentation
- Observation sheet:
- task completion (pass/fail),
- completion time,
- navigation errors,
- confidence rating (1-5),
- moderator notes.
- In-app telemetry hooks:
- Browser event: `amro:engine-usability-marker`
- Event types: `task_start`, `task_end`
- Task IDs:
- `engine_risk_scan`
- `engine_maintenance_next_due`
- `engine_compliance_readiness`
- `engine_anomaly_review`
- `engine_data_entry_validation`
- Local storage stream: `amro.engine.usability.session.events.v1`
- Session marker fields: `session_id`, `task_id`, `event_type`, `timestamp`, `duration_ms`, `outcome`, `metadata`
- Browser/device matrix:
- Chrome (desktop), Firefox (desktop), Safari (desktop), Safari iPad, Chrome Android.

## Execution Protocol
1. Pre-brief user on business context without giving task hints.
2. Capture first-click path for each task.
3. Record completion time and misclick count.
4. Capture post-task confidence and SUS-lite score.
5. Debrief for qualitative friction themes.

## Results Template
| Participant | Role | T1 | T2 | T3 | T4 | T5 | Avg Time | Task Success % | Notes |
|---|---|---|---|---|---|---|---|---|---|
| P1 | Planner |  |  |  |  |  |  |  |  |
| P2 | Engineer |  |  |  |  |  |  |  |  |
| P3 | Reliability |  |  |  |  |  |  |  |  |
| P4 | Compliance |  |  |  |  |  |  |  |  |
| P5 | Planner |  |  |  |  |  |  |  |  |

## KPI Targets
- Task completion rate: `>= 90%`
- Average completion time:
- T1 <= 10s
- T2 <= 20s
- T3 <= 20s
- T4 <= 20s
- T5 <= 30s
- Critical navigation error rate: `<= 5%`
- User confidence score: `>= 4.0 / 5.0`

## Cross-Browser Validation Checklist
- Layout integrity for cards, lane chips, and data-entry form.
- Chart responsiveness and tooltip interaction.
- Focus ring visibility and tab order.
- Mobile stack behavior and touch target spacing.

## Performance Validation Checklist
- Initial render does not introduce long task > 200ms from added UI logic.
- Scrolling remains smooth in long list cards.
- Card hover transitions remain GPU-friendly (transform/shadow/background only).

## Status
- Design + implementation complete.
- Usability session packet ready for participant execution.
- Results table intentionally left blank for real user session capture.
