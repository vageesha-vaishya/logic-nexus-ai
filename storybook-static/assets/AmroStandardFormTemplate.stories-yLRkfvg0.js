import{j as a,I as ie}from"./iframe-BA3bigUR.js";import{L as de}from"./label-D9P-urtt.js";import{A as o}from"./AmroStandardFormTemplate-B3kUNGyS.js";import{b as ce,c as T,d as ue}from"./amroPartsEnterpriseStoryTemplate-yPioTkv-.js";import"./preload-helper-C1FmrZbK.js";import"./alert-DrlRnapg.js";import"./badge-D9TJ8RBX.js";import"./button-CbA7afJr.js";import"./card-CStZ5zmI.js";import"./circle-check-8TQDJzXV.js";import"./loader-circle-DesVXUTG.js";import"./circle-alert-dNIPXqm_.js";const i=()=>{},me=[{key:"record_id",label:"Record ID",required:!0},{key:"title",label:"Title",required:!0},{key:"status",label:"Status",required:!0},{key:"priority",label:"Priority"},{key:"owner",label:"Owner"},{key:"due_date",label:"Due Date"},{key:"instructions",label:"Instructions",span:2},{key:"requires_qa",label:"Requires QA",visibleWhen:e=>String(e.status||"").toLowerCase()!=="draft"}],pe=[{id:"identity",title:"Record Identity",description:"Primary identifiers and status controls.",fieldKeys:["record_id","title","status","priority"]},{id:"ownership",title:"Ownership",description:"Assignment and due-date management.",fieldKeys:["owner","due_date"]},{id:"execution",title:"Execution",description:"Execution rules and instructions.",fieldKeys:["requires_qa","instructions"]}],Fe={title:"AMRO/Templates/AmroStandardFormTemplate",component:o,parameters:{...T,docs:{...T.docs||{},description:{component:ue({componentId:"AMRO-STANDARD-FORM-TEMPLATE",ownerTeam:"AMRO Platform Team",releaseRing:"production",dataClassification:"internal",approvalPolicy:"two_person_review_required",auditReference:"SCR-AMRO-STANDARD-FORM-TEMPLATE"})}}},decorators:[ce],tags:["autodocs","amro","parts","enterprise"],args:{moduleKey:"aircraft",title:"AMRO Standard Template",subtitle:"Adapter-first standardized AMRO form template",mode:"edit",state:"ready",breadcrumbs:["AMRO","Master Data","Aircraft"],statusBadges:["Canonical","WCAG 2.1 AA"],values:{record_id:"AC-001",title:"A320 Fleet Record",status:"active",priority:"high",owner:"MRO Planner",due_date:"2026-04-15",instructions:"Verify all maintenance references before release.",requires_qa:"true"},fields:me,sections:pe,renderField:e=>a.jsxs("div",{className:"space-y-1",children:[a.jsxs(de,{htmlFor:e.key,children:[e.label,e.required?" *":""]}),a.jsx(ie,{id:e.key,defaultValue:"",placeholder:e.label})]}),listSlot:{title:"Related Records",description:"Slot for module list/table component",content:a.jsx("div",{className:"text-sm text-muted-foreground",children:"Inject existing AMRO list component here."})},sidePanelSlot:a.jsx("div",{className:"text-sm text-muted-foreground",children:"Inject activity/audit panel here."}),primaryActions:[{id:"save",label:"Save",onClick:i}],secondaryActions:[{id:"cancel",label:"Cancel",onClick:i}]},argTypes:{mode:{control:"inline-radio",options:["create","edit","readonly"]},state:{control:"inline-radio",options:["ready","loading","error","success"]},validation:{control:"object"},values:{control:"object"},fields:{control:"object"},sections:{control:"object"}}},ye=[{key:"template_code",label:"Template Code (Standard)",required:!0},{key:"template_name",label:"Template Name (Standard)",required:!0},{key:"version",label:"Version (Standard)",required:!0},{key:"maintenance_type",label:"Maintenance Type (Standard)",required:!0},{key:"policy_snapshot_id",label:"Policy Snapshot ID (Standard)"},{key:"active",label:"Active (Standard)"}],ge=[{id:"wpt-standard-core",title:"Standardized Core Fields",description:"Exact adapter field parity for production sign-off.",fieldKeys:["template_code","template_name","version","maintenance_type","policy_snapshot_id","active"]}];function ke(e,r){const s=r[e.key];return a.jsxs("div",{className:"space-y-1",children:[a.jsxs(de,{htmlFor:`wpt-${e.key}`,children:[e.label,e.required?" *":""]}),a.jsx(ie,{id:`wpt-${e.key}`,defaultValue:String(s??""),placeholder:e.label})]})}function le(e){var S,P;const r=(e==null?void 0:e.tasks)||["TASK-1001 A-check visual inspection","TASK-2004 hydraulic pressure check"],s=((S=e==null?void 0:e.scopeValues)==null?void 0:S.threshold)||"10",d=((P=e==null?void 0:e.scopeValues)==null?void 0:P.planning_horizon_days)||"45",t=(e==null?void 0:e.policySnapshotLabel)||"POL-2026-Q2",l=(e==null?void 0:e.reorderHint)||"Simulated reorder: drag TASK-2004 above TASK-1001";return a.jsxs("div",{className:"space-y-3 rounded-md border border-border/70 bg-muted/10 p-3 text-sm","data-testid":"wpt-production-parity-legacy-slot",children:[a.jsxs("div",{children:[a.jsx("p",{className:"font-medium",children:"Work Package Details"}),a.jsxs("p",{className:"text-xs text-muted-foreground",children:["Policy Snapshot: ",t]})]}),a.jsxs("div",{children:[a.jsx("p",{className:"font-medium",children:"Selected Tasks"}),a.jsx("ul",{className:"list-disc pl-4 text-xs text-muted-foreground",children:r.map(A=>a.jsx("li",{children:A},A))}),a.jsx("p",{className:"mt-1 text-xs text-muted-foreground",children:"Task remove simulation: remove first task action available."}),a.jsx("p",{className:"text-xs text-muted-foreground",children:l})]}),a.jsxs("div",{children:[a.jsx("p",{className:"font-medium",children:"Scope Definition"}),a.jsxs("p",{className:"text-xs text-muted-foreground",children:["Threshold: ",s,"% | Planning Horizon: ",d," days"]})]})]})}const c={args:{moduleKey:"aircraft-records",title:"Aircraft Records",breadcrumbs:["AMRO","Aircraft","Records"],statusBadges:["Operational"]}},u={args:{moduleKey:"parts-inventory",title:"Parts Inventory",breadcrumbs:["AMRO","Inventory","Parts"],values:{record_id:"PART-0001",title:"Hydraulic Pump",status:"available",priority:"critical",owner:"Stores Lead",due_date:"2026-04-12",instructions:"Confirm rotable eligibility before issue.",requires_qa:"true"}}},m={args:{moduleKey:"work-packages",title:"Work Package",breadcrumbs:["AMRO","Maintenance","Work Packages"],values:{record_id:"WP-0291",title:"A-check Batch",status:"in_progress",priority:"high",owner:"Line Maintenance",due_date:"2026-04-17",instructions:"Validate AMP references per task row.",requires_qa:"true"},steps:[{id:"scope",title:"Scope",completed:!0},{id:"tasks",title:"Tasks",completed:!0},{id:"resources",title:"Resources"},{id:"approval",title:"Approval"}],activeStepId:"resources"}},p={args:{moduleKey:"dynamic-field-form",title:"Dynamic Field Generation",values:{record_id:"DY-001",title:"Conditional Workflow",status:"draft",priority:"medium",owner:"QA",due_date:"2026-04-20",instructions:"Requires QA field hidden while status is draft.",requires_qa:"false"}}},y={args:{moduleKey:"multistep",title:"Multi-step Workflow",steps:[{id:"draft",title:"Draft",completed:!0},{id:"review",title:"Review",completed:!0},{id:"approve",title:"Approve",completed:!1},{id:"publish",title:"Publish",completed:!1}],activeStepId:"approve"}},g={args:{moduleKey:"validation",title:"Validation State",state:"ready",validation:{level:"error",messages:["Record ID is required.","Due Date cannot be earlier than today."]}}},k={render:()=>a.jsxs("div",{className:"space-y-4",children:[a.jsx(o,{moduleKey:"loading-state",title:"Loading State",mode:"edit",state:"loading",values:{},fields:[],sections:[],renderField:()=>null}),a.jsx(o,{moduleKey:"error-state",title:"Error State",mode:"edit",state:"error",values:{},fields:[],sections:[],renderField:()=>null}),a.jsx(o,{moduleKey:"success-state",title:"Success State",mode:"edit",state:"success",values:{},fields:[],sections:[],renderField:()=>null})]})},b={args:{moduleKey:"contract",title:"AMRO Form Standard Contract",subtitle:"Enforces cross-module consistency without breaking existing integrations.",breadcrumbs:["AMRO","Standards","Form Contract"],statusBadges:["Backward Compatible","Config-Driven"],validation:{level:"warning",messages:["Template must remain API-agnostic; adapters own data integration.","No module-specific layout forks allowed.","All variants must pass WCAG 2.1 AA baseline checks."]},footerSlot:a.jsx("div",{className:"rounded-md border border-border/70 bg-muted/20 p-3 text-sm",children:"Contract checklist: naming conventions, slot usage, state handling, validation parity, and regression tests."})}},n={name:"WorkPackageTemplates_ProductionParity",parameters:{docs:{description:{story:`
**State Switch Guide**
- \`WorkPackageTemplates_ProductionParity\` = ready state (no validation errors expected)
- \`WorkPackageTemplates_ProductionParity_ValidationError\` = validation state (error summary + 2 expected messages)
- QA rule: both stories must keep the same field/block layout; only validation state should differ.

**Visual Sign-off Checklist (QA)**
1. Confirm all 6 standardized fields are visible with exact labels.
2. Confirm legacy parity blocks are visible: Work Package Details, Selected Tasks, Scope Definition.
3. Confirm task interaction simulation notes are present: add/remove/reorder.
4. Confirm policy snapshot and scope values are visible.
5. Confirm keyboard navigation reaches field inputs and error summary container.
6. Confirm validation state surfaces both summary and contextual messaging.

**Accessibility Notes**
- Keyboard path: header actions -> standard fields -> legacy parity blocks.
- Error summary behavior: validation alert remains visible at top and should be announced by assistive tech in runtime app.
`}}},render:e=>{const r=e.values;return a.jsx(o,{...e,fields:ye,sections:ge,renderField:s=>ke(s,r),formBodySlot:le({tasks:["TASK-1001 A-check visual inspection","TASK-2004 hydraulic pressure check","TASK-3020 avionics health check"],scopeValues:{threshold:"12",planning_horizon_days:"60"},policySnapshotLabel:String(r.policy_snapshot_id||"POL-2026-Q2"),reorderHint:"Reorder simulation: TASK-3020 moved above TASK-1001"})})},args:{moduleKey:"work_package_templates",title:"Work Package Templates - Production Parity",subtitle:"Exact visual parity contract for adapter-standardized rollout path.",mode:"edit",state:"ready",breadcrumbs:["AMRO","Master Data","Work Package Templates"],statusBadges:["Feature Flag ON","Production Parity"],values:{template_code:"WPT-1001",template_name:"A320 A-CHECK BASE",version:"3",maintenance_type:"base",policy_snapshot_id:"POL-2026-Q2",active:"true"},primaryActions:[{id:"save",label:"Save",onClick:i}],secondaryActions:[{id:"cancel",label:"Cancel",onClick:i}]},play:async({canvasElement:e})=>{const r=Array.from(e.querySelectorAll("label")).map(t=>t.textContent||""),s=e.textContent||"",d=["Template Code (Standard) *","Template Name (Standard) *","Version (Standard) *","Maintenance Type (Standard) *","Policy Snapshot ID (Standard)","Active (Standard)"];for(const t of d)if(!r.some(l=>l.includes(t)))throw new Error(`Production parity assertion failed: missing label "${t}"`);for(const t of["Work Package Details","Selected Tasks","Scope Definition"])if(!s.includes(t))throw new Error(`Production parity assertion failed: missing legacy block "${t}"`)}},f={name:"WorkPackageTemplates_ProductionParity_ValidationError",parameters:{docs:{description:{story:`
**State Switch Guide**
- \`WorkPackageTemplates_ProductionParity\` = ready state (no validation errors expected)
- \`WorkPackageTemplates_ProductionParity_ValidationError\` = expected validation summary state
- QA rule: both stories must keep the same field/block layout; only validation state should differ.

**Expected Validation Output**
- Validation Errors
- Template Code (Standard) is required.
- Version (Standard) must be greater than zero.
`}}},render:n.render,args:{...n.args,state:"ready",validation:{level:"error",messages:["Template Code (Standard) is required.","Version (Standard) must be greater than zero."]}},play:async({canvasElement:e})=>{const r=Array.from(e.querySelectorAll("label")).map(t=>t.textContent||""),s=e.textContent||"";for(const t of["Validation Errors","Template Code (Standard) is required.","Version (Standard) must be greater than zero."])if(!s.includes(t))throw new Error(`Validation parity assertion failed: missing "${t}"`);const d=["Template Code (Standard) *","Template Name (Standard) *","Version (Standard) *","Maintenance Type (Standard) *","Policy Snapshot ID (Standard)","Active (Standard)"];for(const t of d)if(!r.some(l=>l.includes(t)))throw new Error(`Validation parity assertion failed: missing label "${t}"`);for(const t of["Work Package Details","Selected Tasks","Scope Definition"])if(!s.includes(t))throw new Error(`Validation parity assertion failed: missing legacy block "${t}"`)}},h={name:"WorkPackageTemplates_ProductionParity_Loading",render:n.render,args:{...n.args,state:"loading"}},v={name:"WorkPackageTemplates_ProductionParity_FeatureFlagOffFallback",parameters:{docs:{description:{story:"Represents legacy fallback visualization when `VITE_AMRO_WPT_STANDARD_TEMPLATE=false`."}}},render:e=>a.jsxs("div",{className:"space-y-3",children:[a.jsx(o,{...e,fields:[],sections:[],renderField:()=>null,formBodySlot:le({tasks:["TASK-1001 A-check visual inspection","TASK-2004 hydraulic pressure check"],scopeValues:{threshold:"10",planning_horizon_days:"45"},policySnapshotLabel:"Legacy policy snapshot binding",reorderHint:"Legacy drag/drop reorder behavior retained"})}),a.jsx("div",{className:"rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800",children:"Feature flag fallback mode: standard fields hidden, legacy section path only."})]}),args:{moduleKey:"work_package_templates",title:"Work Package Templates - Legacy Fallback",subtitle:"Feature flag OFF fallback reference",mode:"edit",state:"ready",breadcrumbs:["AMRO","Master Data","Work Package Templates"],statusBadges:["Feature Flag OFF"],values:{},primaryActions:[{id:"save",label:"Save",onClick:i}],secondaryActions:[{id:"cancel",label:"Cancel",onClick:i}]}};var _,x,w;c.parameters={...c.parameters,docs:{...(_=c.parameters)==null?void 0:_.docs,source:{originalSource:`{
  args: {
    moduleKey: 'aircraft-records',
    title: 'Aircraft Records',
    breadcrumbs: ['AMRO', 'Aircraft', 'Records'],
    statusBadges: ['Operational']
  }
}`,...(w=(x=c.parameters)==null?void 0:x.docs)==null?void 0:w.source}}};var C,F,W;u.parameters={...u.parameters,docs:{...(C=u.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    moduleKey: 'parts-inventory',
    title: 'Parts Inventory',
    breadcrumbs: ['AMRO', 'Inventory', 'Parts'],
    values: {
      record_id: 'PART-0001',
      title: 'Hydraulic Pump',
      status: 'available',
      priority: 'critical',
      owner: 'Stores Lead',
      due_date: '2026-04-12',
      instructions: 'Confirm rotable eligibility before issue.',
      requires_qa: 'true'
    }
  }
}`,...(W=(F=u.parameters)==null?void 0:F.docs)==null?void 0:W.source}}};var E,R,V;m.parameters={...m.parameters,docs:{...(E=m.parameters)==null?void 0:E.docs,source:{originalSource:`{
  args: {
    moduleKey: 'work-packages',
    title: 'Work Package',
    breadcrumbs: ['AMRO', 'Maintenance', 'Work Packages'],
    values: {
      record_id: 'WP-0291',
      title: 'A-check Batch',
      status: 'in_progress',
      priority: 'high',
      owner: 'Line Maintenance',
      due_date: '2026-04-17',
      instructions: 'Validate AMP references per task row.',
      requires_qa: 'true'
    },
    steps: [{
      id: 'scope',
      title: 'Scope',
      completed: true
    }, {
      id: 'tasks',
      title: 'Tasks',
      completed: true
    }, {
      id: 'resources',
      title: 'Resources'
    }, {
      id: 'approval',
      title: 'Approval'
    }],
    activeStepId: 'resources'
  }
}`,...(V=(R=m.parameters)==null?void 0:R.docs)==null?void 0:V.source}}};var D,K,M;p.parameters={...p.parameters,docs:{...(D=p.parameters)==null?void 0:D.docs,source:{originalSource:`{
  args: {
    moduleKey: 'dynamic-field-form',
    title: 'Dynamic Field Generation',
    values: {
      record_id: 'DY-001',
      title: 'Conditional Workflow',
      status: 'draft',
      priority: 'medium',
      owner: 'QA',
      due_date: '2026-04-20',
      instructions: 'Requires QA field hidden while status is draft.',
      requires_qa: 'false'
    }
  }
}`,...(M=(K=p.parameters)==null?void 0:K.docs)==null?void 0:M.source}}};var q,O,L;y.parameters={...y.parameters,docs:{...(q=y.parameters)==null?void 0:q.docs,source:{originalSource:`{
  args: {
    moduleKey: 'multistep',
    title: 'Multi-step Workflow',
    steps: [{
      id: 'draft',
      title: 'Draft',
      completed: true
    }, {
      id: 'review',
      title: 'Review',
      completed: true
    }, {
      id: 'approve',
      title: 'Approve',
      completed: false
    }, {
      id: 'publish',
      title: 'Publish',
      completed: false
    }],
    activeStepId: 'approve'
  }
}`,...(L=(O=y.parameters)==null?void 0:O.docs)==null?void 0:L.source}}};var j,N,I;g.parameters={...g.parameters,docs:{...(j=g.parameters)==null?void 0:j.docs,source:{originalSource:`{
  args: {
    moduleKey: 'validation',
    title: 'Validation State',
    state: 'ready',
    validation: {
      level: 'error',
      messages: ['Record ID is required.', 'Due Date cannot be earlier than today.']
    }
  }
}`,...(I=(N=g.parameters)==null?void 0:N.docs)==null?void 0:I.source}}};var z,B,Q;k.parameters={...k.parameters,docs:{...(z=k.parameters)==null?void 0:z.docs,source:{originalSource:`{
  render: () => <div className="space-y-4">
      <AmroStandardFormTemplate moduleKey="loading-state" title="Loading State" mode="edit" state="loading" values={{}} fields={[]} sections={[]} renderField={() => null} />
      <AmroStandardFormTemplate moduleKey="error-state" title="Error State" mode="edit" state="error" values={{}} fields={[]} sections={[]} renderField={() => null} />
      <AmroStandardFormTemplate moduleKey="success-state" title="Success State" mode="edit" state="success" values={{}} fields={[]} sections={[]} renderField={() => null} />
    </div>
}`,...(Q=(B=k.parameters)==null?void 0:B.docs)==null?void 0:Q.source}}};var H,$,G;b.parameters={...b.parameters,docs:{...(H=b.parameters)==null?void 0:H.docs,source:{originalSource:`{
  args: {
    moduleKey: 'contract',
    title: 'AMRO Form Standard Contract',
    subtitle: 'Enforces cross-module consistency without breaking existing integrations.',
    breadcrumbs: ['AMRO', 'Standards', 'Form Contract'],
    statusBadges: ['Backward Compatible', 'Config-Driven'],
    validation: {
      level: 'warning',
      messages: ['Template must remain API-agnostic; adapters own data integration.', 'No module-specific layout forks allowed.', 'All variants must pass WCAG 2.1 AA baseline checks.']
    },
    footerSlot: <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
        Contract checklist: naming conventions, slot usage, state handling, validation parity, and regression tests.
      </div>
  }
}`,...(G=($=b.parameters)==null?void 0:$.docs)==null?void 0:G.source}}};var Y,J,U;n.parameters={...n.parameters,docs:{...(Y=n.parameters)==null?void 0:Y.docs,source:{originalSource:`{
  name: 'WorkPackageTemplates_ProductionParity',
  parameters: {
    docs: {
      description: {
        story: \`
**State Switch Guide**
- \\\`WorkPackageTemplates_ProductionParity\\\` = ready state (no validation errors expected)
- \\\`WorkPackageTemplates_ProductionParity_ValidationError\\\` = validation state (error summary + 2 expected messages)
- QA rule: both stories must keep the same field/block layout; only validation state should differ.

**Visual Sign-off Checklist (QA)**
1. Confirm all 6 standardized fields are visible with exact labels.
2. Confirm legacy parity blocks are visible: Work Package Details, Selected Tasks, Scope Definition.
3. Confirm task interaction simulation notes are present: add/remove/reorder.
4. Confirm policy snapshot and scope values are visible.
5. Confirm keyboard navigation reaches field inputs and error summary container.
6. Confirm validation state surfaces both summary and contextual messaging.

**Accessibility Notes**
- Keyboard path: header actions -> standard fields -> legacy parity blocks.
- Error summary behavior: validation alert remains visible at top and should be announced by assistive tech in runtime app.
\`
      }
    }
  },
  render: args => {
    const values = args.values as Record<string, unknown>;
    return <AmroStandardFormTemplate {...args} fields={wptFields} sections={wptSections} renderField={field => renderWptField(field, values)} formBodySlot={buildWptLegacyParitySlot({
      tasks: ['TASK-1001 A-check visual inspection', 'TASK-2004 hydraulic pressure check', 'TASK-3020 avionics health check'],
      scopeValues: {
        threshold: '12',
        planning_horizon_days: '60'
      },
      policySnapshotLabel: String(values.policy_snapshot_id || 'POL-2026-Q2'),
      reorderHint: 'Reorder simulation: TASK-3020 moved above TASK-1001'
    })} />;
  },
  args: {
    moduleKey: 'work_package_templates',
    title: 'Work Package Templates - Production Parity',
    subtitle: 'Exact visual parity contract for adapter-standardized rollout path.',
    mode: 'edit',
    state: 'ready',
    breadcrumbs: ['AMRO', 'Master Data', 'Work Package Templates'],
    statusBadges: ['Feature Flag ON', 'Production Parity'],
    values: {
      template_code: 'WPT-1001',
      template_name: 'A320 A-CHECK BASE',
      version: '3',
      maintenance_type: 'base',
      policy_snapshot_id: 'POL-2026-Q2',
      active: 'true'
    },
    primaryActions: [{
      id: 'save',
      label: 'Save',
      onClick: noop
    }],
    secondaryActions: [{
      id: 'cancel',
      label: 'Cancel',
      onClick: noop
    }]
  },
  play: async ({
    canvasElement
  }) => {
    const labels = Array.from(canvasElement.querySelectorAll('label')).map(node => node.textContent || '');
    const pageText = canvasElement.textContent || '';
    const requiredLabels = ['Template Code (Standard) *', 'Template Name (Standard) *', 'Version (Standard) *', 'Maintenance Type (Standard) *', 'Policy Snapshot ID (Standard)', 'Active (Standard)'];
    for (const label of requiredLabels) {
      if (!labels.some(candidate => candidate.includes(label))) {
        throw new Error(\`Production parity assertion failed: missing label "\${label}"\`);
      }
    }
    for (const section of ['Work Package Details', 'Selected Tasks', 'Scope Definition']) {
      if (!pageText.includes(section)) {
        throw new Error(\`Production parity assertion failed: missing legacy block "\${section}"\`);
      }
    }
  }
}`,...(U=(J=n.parameters)==null?void 0:J.docs)==null?void 0:U.source}}};var X,Z,ee;f.parameters={...f.parameters,docs:{...(X=f.parameters)==null?void 0:X.docs,source:{originalSource:`{
  name: 'WorkPackageTemplates_ProductionParity_ValidationError',
  parameters: {
    docs: {
      description: {
        story: \`
**State Switch Guide**
- \\\`WorkPackageTemplates_ProductionParity\\\` = ready state (no validation errors expected)
- \\\`WorkPackageTemplates_ProductionParity_ValidationError\\\` = expected validation summary state
- QA rule: both stories must keep the same field/block layout; only validation state should differ.

**Expected Validation Output**
- Validation Errors
- Template Code (Standard) is required.
- Version (Standard) must be greater than zero.
\`
      }
    }
  },
  render: WorkPackageTemplates_ProductionParity.render,
  args: {
    ...WorkPackageTemplates_ProductionParity.args,
    state: 'ready',
    validation: {
      level: 'error',
      messages: ['Template Code (Standard) is required.', 'Version (Standard) must be greater than zero.']
    }
  },
  play: async ({
    canvasElement
  }) => {
    const labels = Array.from(canvasElement.querySelectorAll('label')).map(node => node.textContent || '');
    const pageText = canvasElement.textContent || '';

    // Error summary + expected messages
    for (const expected of ['Validation Errors', 'Template Code (Standard) is required.', 'Version (Standard) must be greater than zero.']) {
      if (!pageText.includes(expected)) {
        throw new Error(\`Validation parity assertion failed: missing "\${expected}"\`);
      }
    }

    // 6 standard fields should still render in error state
    const requiredLabels = ['Template Code (Standard) *', 'Template Name (Standard) *', 'Version (Standard) *', 'Maintenance Type (Standard) *', 'Policy Snapshot ID (Standard)', 'Active (Standard)'];
    for (const label of requiredLabels) {
      if (!labels.some(candidate => candidate.includes(label))) {
        throw new Error(\`Validation parity assertion failed: missing label "\${label}"\`);
      }
    }

    // Legacy parity blocks should still render in error state
    for (const section of ['Work Package Details', 'Selected Tasks', 'Scope Definition']) {
      if (!pageText.includes(section)) {
        throw new Error(\`Validation parity assertion failed: missing legacy block "\${section}"\`);
      }
    }
  }
}`,...(ee=(Z=f.parameters)==null?void 0:Z.docs)==null?void 0:ee.source}}};var ae,te,re;h.parameters={...h.parameters,docs:{...(ae=h.parameters)==null?void 0:ae.docs,source:{originalSource:`{
  name: 'WorkPackageTemplates_ProductionParity_Loading',
  render: WorkPackageTemplates_ProductionParity.render,
  args: {
    ...WorkPackageTemplates_ProductionParity.args,
    state: 'loading'
  }
}`,...(re=(te=h.parameters)==null?void 0:te.docs)==null?void 0:re.source}}};var se,ne,oe;v.parameters={...v.parameters,docs:{...(se=v.parameters)==null?void 0:se.docs,source:{originalSource:`{
  name: 'WorkPackageTemplates_ProductionParity_FeatureFlagOffFallback',
  parameters: {
    docs: {
      description: {
        story: 'Represents legacy fallback visualization when \`VITE_AMRO_WPT_STANDARD_TEMPLATE=false\`.'
      }
    }
  },
  render: args => <div className="space-y-3">
      <AmroStandardFormTemplate {...args} fields={[]} sections={[]} renderField={() => null} formBodySlot={buildWptLegacyParitySlot({
      tasks: ['TASK-1001 A-check visual inspection', 'TASK-2004 hydraulic pressure check'],
      scopeValues: {
        threshold: '10',
        planning_horizon_days: '45'
      },
      policySnapshotLabel: 'Legacy policy snapshot binding',
      reorderHint: 'Legacy drag/drop reorder behavior retained'
    })} />
      <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
        Feature flag fallback mode: standard fields hidden, legacy section path only.
      </div>
    </div>,
  args: {
    moduleKey: 'work_package_templates',
    title: 'Work Package Templates - Legacy Fallback',
    subtitle: 'Feature flag OFF fallback reference',
    mode: 'edit',
    state: 'ready',
    breadcrumbs: ['AMRO', 'Master Data', 'Work Package Templates'],
    statusBadges: ['Feature Flag OFF'],
    values: {},
    primaryActions: [{
      id: 'save',
      label: 'Save',
      onClick: noop
    }],
    secondaryActions: [{
      id: 'cancel',
      label: 'Cancel',
      onClick: noop
    }]
  }
}`,...(oe=(ne=v.parameters)==null?void 0:ne.docs)==null?void 0:oe.source}}};const We=["AircraftRecordsVariant","PartsInventoryVariant","WorkPackageVariant","DynamicFieldGenerationVariant","MultiStepWorkflowVariant","ValidationErrorVariant","LoadingErrorSuccessStates","FormStandardContract","WorkPackageTemplates_ProductionParity","WorkPackageTemplates_ProductionParity_ValidationError","WorkPackageTemplates_ProductionParity_Loading","WorkPackageTemplates_ProductionParity_FeatureFlagOffFallback"];export{c as AircraftRecordsVariant,p as DynamicFieldGenerationVariant,b as FormStandardContract,k as LoadingErrorSuccessStates,y as MultiStepWorkflowVariant,u as PartsInventoryVariant,g as ValidationErrorVariant,n as WorkPackageTemplates_ProductionParity,v as WorkPackageTemplates_ProductionParity_FeatureFlagOffFallback,h as WorkPackageTemplates_ProductionParity_Loading,f as WorkPackageTemplates_ProductionParity_ValidationError,m as WorkPackageVariant,We as __namedExportsOrder,Fe as default};
