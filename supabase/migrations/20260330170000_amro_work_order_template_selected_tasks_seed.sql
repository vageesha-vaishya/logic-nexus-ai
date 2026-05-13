BEGIN;

UPDATE public.work_order_templates
SET
  tasks_json = CASE
    WHEN jsonb_typeof(tasks_json) = 'array' AND jsonb_array_length(tasks_json) >= 15 THEN tasks_json
    ELSE jsonb_build_array(
      jsonb_build_object(
        'task_number', 'WP-0001-001',
        'task_name', 'Pre-arrival documentation and defect history consolidation',
        'ata_code', '05-20',
        'serial_number', 'SN-WP0001-001',
        'part_number', 'PN-DOC-05020',
        'description', 'Compile technical log entries, deferred defect history, MEL references, and previous release notes into one controlled package before aircraft arrival. Cross-verify revision currency, highlight open risk items, and prepare escalation notes for the planning lead and certifying engineer to reduce dispatch uncertainty.',
        'priority', 'High',
        'estimated_hours', 6,
        'status', 'Not Started',
        'complexity', 'Simple',
        'dependency_task_numbers', jsonb_build_array(),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74', 'role', 'Planner', 'availability_status', 'Available', 'allocation_hours', 4),
          jsonb_build_object('user_id', '8d7e21a9-5cb9-4d61-9e5d-3a7bf4f52c10', 'role', 'Engineer', 'availability_status', 'Available', 'allocation_hours', 2)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-002',
        'task_name', 'Pre-docking safety zoning and access isolation',
        'ata_code', '20-00',
        'serial_number', 'SN-WP0001-002',
        'part_number', 'PN-SAFE-20000',
        'description', 'Establish safe working envelopes at gate and hangar interface, enforce exclusion barriers, validate lockout tagging points, and publish communication channels for tug, fuel, and ground teams. Confirm emergency routes and brief all participating technicians to control movement risk during initial docking operations.',
        'priority', 'Critical',
        'estimated_hours', 8,
        'status', 'In Progress',
        'complexity', 'Simple',
        'dependency_task_numbers', jsonb_build_array('WP-0001-001'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', 'b5a612df-f6c0-4d2f-8ca5-0a8f03d67a2d', 'role', 'Safety Inspector', 'availability_status', 'Available', 'allocation_hours', 5),
          jsonb_build_object('user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74', 'role', 'Planner', 'availability_status', 'Busy', 'allocation_hours', 3)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-003',
        'task_name', 'External fuselage and control-surface condition survey',
        'ata_code', '51-00',
        'serial_number', 'SN-WP0001-003',
        'part_number', 'PN-STR-51000',
        'description', 'Perform a structured walkaround inspection covering fuselage skin, fairings, static ports, flight-control hinges, and evidence of fluid leaks or impact damage. Capture geotagged evidence and annotate defect classes against approved limits so structural engineering can determine immediate disposition without delaying downstream tasks.',
        'priority', 'High',
        'estimated_hours', 10,
        'status', 'Not Started',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-002'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', 'c3e1474a-0ac6-4495-9278-1b8fd32f5ef9', 'role', 'Structures Technician', 'availability_status', 'Available', 'allocation_hours', 6),
          jsonb_build_object('user_id', 'b5a612df-f6c0-4d2f-8ca5-0a8f03d67a2d', 'role', 'Inspector', 'availability_status', 'Available', 'allocation_hours', 4)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-004',
        'task_name', 'Landing gear bay inspection and brake wear verification',
        'ata_code', '32-00',
        'serial_number', 'SN-WP0001-004',
        'part_number', 'PN-LDG-32000',
        'description', 'Inspect gear bay plumbing, strut condition, actuator safetying, and brake stack wear against configured thresholds. Verify wheel hardware torque witness marks and review previous snag trends to identify recurring failures. Raise parts reservation requests where tolerance margins indicate replacement in current visit.',
        'priority', 'Critical',
        'estimated_hours', 14,
        'status', 'In Progress',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-002'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74', 'role', 'Engineer', 'availability_status', 'Available', 'allocation_hours', 8),
          jsonb_build_object('user_id', 'd2dbe5ea-0d4a-4d31-8e57-95f0cc83d1dd', 'role', 'Technician', 'availability_status', 'On Leave', 'allocation_hours', 0)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-005',
        'task_name', 'Engine intake and fan-blade borescope assessment',
        'ata_code', '72-00',
        'serial_number', 'SN-WP0001-005',
        'part_number', 'PN-ENG-72000',
        'description', 'Execute borescope inspection of fan and LPC stages, compare findings against baseline imagery, and classify erosion, nicks, and foreign object signatures. Record blendability decisions and escalation thresholds with clear dimensional references to support engineering approval and reduce unnecessary shop removals.',
        'priority', 'High',
        'estimated_hours', 18,
        'status', 'Blocked',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-003', 'WP-0001-004'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', 'c3e1474a-0ac6-4495-9278-1b8fd32f5ef9', 'role', 'Engine Specialist', 'availability_status', 'Available', 'allocation_hours', 12),
          jsonb_build_object('user_id', '8d7e21a9-5cb9-4d61-9e5d-3a7bf4f52c10', 'role', 'Engineer', 'availability_status', 'Busy', 'allocation_hours', 6)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-006',
        'task_name', 'Hydraulic system leak isolation and pressure hold test',
        'ata_code', '29-00',
        'serial_number', 'SN-WP0001-006',
        'part_number', 'PN-HYD-29000',
        'description', 'Troubleshoot hydraulic seepage reports by isolating affected circuits, confirming reservoir levels, and executing pressure hold tests under controlled temperature conditions. Document pressure decay trends and component observations so reliability engineering can determine corrective action and recurrence controls.',
        'priority', 'Critical',
        'estimated_hours', 24,
        'status', 'In Progress',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-004'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74', 'role', 'Lead Engineer', 'availability_status', 'Available', 'allocation_hours', 10),
          jsonb_build_object('user_id', 'd2dbe5ea-0d4a-4d31-8e57-95f0cc83d1dd', 'role', 'Hydraulics Technician', 'availability_status', 'Available', 'allocation_hours', 14)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-007',
        'task_name', 'Avionics bay connector integrity and harness continuity checks',
        'ata_code', '23-00',
        'serial_number', 'SN-WP0001-007',
        'part_number', 'PN-AVI-23000',
        'description', 'Inspect avionics bay harness routes, connector retention, shield terminations, and continuity across critical navigation and communication channels. Correlate findings with intermittent defect reports and environmental exposure records to determine repair scope and avoid repeat write-ups after release.',
        'priority', 'Medium',
        'estimated_hours', 20,
        'status', 'On Hold',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-002'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', '8d7e21a9-5cb9-4d61-9e5d-3a7bf4f52c10', 'role', 'Avionics Engineer', 'availability_status', 'Available', 'allocation_hours', 12),
          jsonb_build_object('user_id', 'b5a612df-f6c0-4d2f-8ca5-0a8f03d67a2d', 'role', 'Inspector', 'availability_status', 'Busy', 'allocation_hours', 8)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-008',
        'task_name', 'Cabin emergency equipment inventory and expiry audit',
        'ata_code', '25-60',
        'serial_number', 'SN-WP0001-008',
        'part_number', 'PN-CAB-25600',
        'description', 'Audit life vests, oxygen bottles, fire extinguishers, and emergency medical kits for quantity, location, and shelf-life compliance. Reconcile discrepancies against cabin layout revisions and stocking records, then issue replacement actions with traceable accountability for each station and kit position.',
        'priority', 'Low',
        'estimated_hours', 9,
        'status', 'Completed',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-001'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', 'd2dbe5ea-0d4a-4d31-8e57-95f0cc83d1dd', 'role', 'Cabin Technician', 'availability_status', 'Available', 'allocation_hours', 9)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-009',
        'task_name', 'Fuel quantity indication calibration cross-check',
        'ata_code', '28-40',
        'serial_number', 'SN-WP0001-009',
        'part_number', 'PN-FUEL-28400',
        'description', 'Validate fuel indication channels by comparing cockpit quantity readings, maintenance computer outputs, and calibrated dip checks under controlled conditions. Capture tolerance drift and calibration bias, and prepare corrective recommendations aligned with approved troubleshooting manuals and deferred defect policy.',
        'priority', 'High',
        'estimated_hours', 12,
        'status', 'Not Started',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-007'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', '8d7e21a9-5cb9-4d61-9e5d-3a7bf4f52c10', 'role', 'Avionics Engineer', 'availability_status', 'Available', 'allocation_hours', 7),
          jsonb_build_object('user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74', 'role', 'Engineer', 'availability_status', 'Available', 'allocation_hours', 5)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-010',
        'task_name', 'Environmental control system performance trend verification',
        'ata_code', '21-00',
        'serial_number', 'SN-WP0001-010',
        'part_number', 'PN-ECS-21000',
        'description', 'Run ECS operational checks across representative operating points, confirm pack output parameters, and compare values against historical trends for degradation detection. Include sensor plausibility checks and fault message correlation to isolate root causes before dispatch-critical temperature control failures occur.',
        'priority', 'Medium',
        'estimated_hours', 16,
        'status', 'In Progress',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-006', 'WP-0001-007'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', 'c3e1474a-0ac6-4495-9278-1b8fd32f5ef9', 'role', 'Systems Technician', 'availability_status', 'Available', 'allocation_hours', 10),
          jsonb_build_object('user_id', 'b5a612df-f6c0-4d2f-8ca5-0a8f03d67a2d', 'role', 'Inspector', 'availability_status', 'Available', 'allocation_hours', 6)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-011',
        'task_name', 'Flight control rigging tolerance verification',
        'ata_code', '27-00',
        'serial_number', 'SN-WP0001-011',
        'part_number', 'PN-FLT-27000',
        'description', 'Measure and validate control-surface neutral positions, travel limits, and cable or actuator rigging values against maintenance manual tolerances. Record any asymmetry and command response lag with repeatable measurement evidence to support engineering disposition and post-maintenance handling quality.',
        'priority', 'High',
        'estimated_hours', 28,
        'status', 'Not Started',
        'complexity', 'Complex',
        'dependency_task_numbers', jsonb_build_array('WP-0001-003', 'WP-0001-006', 'WP-0001-010'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74', 'role', 'Lead Engineer', 'availability_status', 'Busy', 'allocation_hours', 12),
          jsonb_build_object('user_id', 'd2dbe5ea-0d4a-4d31-8e57-95f0cc83d1dd', 'role', 'Flight Controls Technician', 'availability_status', 'Available', 'allocation_hours', 16)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-012',
        'task_name', 'Corrosion prevention treatment on identified hotspots',
        'ata_code', '51-70',
        'serial_number', 'SN-WP0001-012',
        'part_number', 'PN-COR-51700',
        'description', 'Apply approved corrosion control procedures on affected panels and structural interfaces identified during inspection findings. Include surface preparation traceability, chemical dwell control, and coating verification records to ensure follow-up intervals and long-term integrity monitoring are properly baselined.',
        'priority', 'Medium',
        'estimated_hours', 30,
        'status', 'Blocked',
        'complexity', 'Complex',
        'dependency_task_numbers', jsonb_build_array('WP-0001-003'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', 'c3e1474a-0ac6-4495-9278-1b8fd32f5ef9', 'role', 'Structures Technician', 'availability_status', 'Available', 'allocation_hours', 18),
          jsonb_build_object('user_id', 'b5a612df-f6c0-4d2f-8ca5-0a8f03d67a2d', 'role', 'Inspector', 'availability_status', 'Available', 'allocation_hours', 12)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-013',
        'task_name', 'Functional check flight data package preparation',
        'ata_code', '45-00',
        'serial_number', 'SN-WP0001-013',
        'part_number', 'PN-FCF-45000',
        'description', 'Prepare functional check flight package including validated defect closure list, deferred item rationale, and targeted in-flight observation points. Coordinate with operations and flight crew to ensure acceptance criteria and test priorities are understood before aircraft release gate review is initiated.',
        'priority', 'Medium',
        'estimated_hours', 11,
        'status', 'On Hold',
        'complexity', 'Medium',
        'dependency_task_numbers', jsonb_build_array('WP-0001-009', 'WP-0001-010', 'WP-0001-011'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', '8d7e21a9-5cb9-4d61-9e5d-3a7bf4f52c10', 'role', 'Engineer', 'availability_status', 'Available', 'allocation_hours', 6),
          jsonb_build_object('user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74', 'role', 'Planner', 'availability_status', 'Available', 'allocation_hours', 5)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-014',
        'task_name', 'Final quality assurance conformity release review',
        'ata_code', '00-00',
        'serial_number', 'SN-WP0001-014',
        'part_number', 'PN-QA-00000',
        'description', 'Conduct independent QA review of completed job cards, evidence attachments, inspection sign-offs, and deferred defect approvals. Validate traceability from finding to closure and verify regulatory references are current so certifying staff can issue release without compliance exceptions or missing records.',
        'priority', 'Critical',
        'estimated_hours', 26,
        'status', 'Not Started',
        'complexity', 'Complex',
        'dependency_task_numbers', jsonb_build_array('WP-0001-005', 'WP-0001-011', 'WP-0001-012'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', 'b5a612df-f6c0-4d2f-8ca5-0a8f03d67a2d', 'role', 'QA Inspector', 'availability_status', 'Available', 'allocation_hours', 16),
          jsonb_build_object('user_id', '8d7e21a9-5cb9-4d61-9e5d-3a7bf4f52c10', 'role', 'Engineer', 'availability_status', 'Busy', 'allocation_hours', 10)
        )
      ),
      jsonb_build_object(
        'task_number', 'WP-0001-015',
        'task_name', 'Release readiness briefing and turnover to operations',
        'ata_code', '05-50',
        'serial_number', 'SN-WP0001-015',
        'part_number', 'PN-REL-05500',
        'description', 'Run final multidisciplinary turnover briefing covering completed maintenance scope, residual observations, dispatch limitations, and recommended monitoring actions. Ensure maintenance control and operations sign acknowledgement, then archive decision artifacts for audit-ready traceability and post-release reliability tracking.',
        'priority', 'High',
        'estimated_hours', 7,
        'status', 'Completed',
        'complexity', 'Simple',
        'dependency_task_numbers', jsonb_build_array('WP-0001-014'),
        'assigned_users', jsonb_build_array(
          jsonb_build_object('user_id', '52811a3b-5baf-4c5f-854b-7ced632e3a74', 'role', 'Planner', 'availability_status', 'Available', 'allocation_hours', 3),
          jsonb_build_object('user_id', 'b5a612df-f6c0-4d2f-8ca5-0a8f03d67a2d', 'role', 'QA Inspector', 'availability_status', 'Available', 'allocation_hours', 4)
        )
      )
    )
  END,
  updated_at = now()
WHERE id = '9515a25e-272a-4048-a930-c997d8916366';

COMMIT;
