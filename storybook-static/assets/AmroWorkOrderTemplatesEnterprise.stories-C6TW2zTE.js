import{j as t,I as U}from"./iframe-BA3bigUR.js";import{B as f}from"./badge-D9TJ8RBX.js";import{L as $}from"./label-D9P-urtt.js";import{A as W}from"./AmroStandardFormTemplate-B3kUNGyS.js";import{c as g,b as G,d as K}from"./amroPartsEnterpriseStoryTemplate-yPioTkv-.js";import"./preload-helper-C1FmrZbK.js";import"./alert-DrlRnapg.js";import"./button-CbA7afJr.js";import"./card-CStZ5zmI.js";import"./circle-check-8TQDJzXV.js";import"./loader-circle-DesVXUTG.js";import"./circle-alert-dNIPXqm_.js";const v=()=>{},V=[{key:"template_code",label:"Template Code",required:!0},{key:"template_name",label:"Template Name",required:!0,span:2},{key:"version",label:"Version",required:!0},{key:"maintenance_type",label:"Maintenance Type",required:!0},{key:"aircraft_model",label:"Aircraft Model",required:!0},{key:"policy_snapshot_id",label:"Policy Snapshot ID"},{key:"active",label:"Active"}],J=[{id:"identity",title:"Work Package Details",description:"Core template identity and maintenance classification.",fieldKeys:["template_code","template_name","version","maintenance_type","aircraft_model","policy_snapshot_id","active"]}];function X(e,a){return t.jsxs("div",{className:"space-y-1",children:[t.jsxs($,{htmlFor:`enterprise-${e.key}`,children:[e.label,e.required?" *":""]}),t.jsx(U,{id:`enterprise-${e.key}`,defaultValue:String(a[e.key]??"")})]})}function u(e){const a=(e==null?void 0:e.taskCount)??12,r=(e==null?void 0:e.selectedCount)??4,I=(e==null?void 0:e.threshold)??"12",Q=(e==null?void 0:e.horizon)??"60",F=(e==null?void 0:e.note)??"Simulates add/remove/reorder controls from legacy handlers.";return t.jsxs("div",{className:"space-y-3 rounded-md border border-border/70 bg-muted/10 p-3 text-sm",children:[t.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[t.jsx("p",{className:"font-medium",children:"Selected Tasks"}),t.jsxs(f,{variant:"secondary",children:["Records: ",a]}),t.jsxs(f,{variant:"outline",children:["Checked: ",r]})]}),t.jsx("p",{className:"text-xs text-muted-foreground",children:F}),t.jsxs("div",{className:"rounded border border-border/70 bg-background p-2 text-xs",children:["Scope Definition: threshold ",I,"% | planning horizon ",Q," days"]})]})}const ce={title:"AMRO/Templates/WorkOrderTemplatesEnterprise",component:W,tags:["autodocs","amro","parts","enterprise"],decorators:[G],parameters:{...g,docs:{...g.docs||{},description:{component:`${K({componentId:"AMRO-WPT-ENTERPRISE-TEMPLATES",ownerTeam:"AMRO Platform Team",releaseRing:"uat",dataClassification:"internal",approvalPolicy:"two_person_review_required",auditReference:"SCR-AMRO-WPT-ENTERPRISE"})}

Enterprise-grade reference templates for AMRO Work Package Templates.

Usage Guidance:
- Use adapter-first integration to preserve existing API and handlers.
- Keep "Work Package Details", "Selected Tasks", and "Scope Definition" visible during migration.
- Validate parity with feature flag ON/OFF before promoting to wider rollout.

Implementation Best Practices:
- Keep fields config-driven and section-based.
- Keep task-row interactions keyboard accessible.
- Keep validation summary and field-level errors synchronized.
`}}},argTypes:{mode:{control:"inline-radio",options:["create","edit","readonly"]},state:{control:"inline-radio",options:["ready","loading","error","success"]},title:{control:"text"},subtitle:{control:"text"},breadcrumbs:{control:"object"},statusBadges:{control:"object"},validation:{control:"object"},values:{control:"object"}}},n={moduleKey:"work_order_templates",title:"AMRO Work Package Templates - Enterprise Reference",subtitle:"Scalable template pattern for production migration decisions.",mode:"edit",state:"ready",breadcrumbs:["AMRO","Master Data","Work Package Templates"],statusBadges:["Enterprise UI","WCAG 2.1 AA Baseline"],values:{template_code:"WPT-ENT-001",template_name:"A320 Base Check Package",version:"3",maintenance_type:"base",aircraft_model:"A320-200",policy_snapshot_id:"POL-2026-Q2",active:"true"},fields:V,sections:J,renderField:e=>X(e,n.values),formBodySlot:u(),primaryActions:[{id:"save",label:"Save",onClick:v}],secondaryActions:[{id:"cancel",label:"Cancel",onClick:v}]},s={name:"DesktopOperations",args:{...n}},o={name:"TabletGlovedHandMode",parameters:{viewport:{defaultViewport:"tablet"},docs:{description:{story:"Optimized spacing and larger control targets for tablet and gloved-hand interaction contexts."}}},args:{...n,statusBadges:["Tablet","High-Touch Targets"],formBodySlot:u({taskCount:9,selectedCount:3,threshold:"10",horizon:"45"})}},i={name:"HighContrastLowLight",parameters:{docs:{description:{story:"Reference for high-contrast operation in low-light hangar/line environments."}}},args:{...n,statusBadges:["High Contrast","Low Light"],footerSlot:t.jsx("div",{className:"rounded-md border border-foreground/40 bg-background p-3 text-sm",children:"Contrast guidance: maintain >= 4.5:1 for body text and visible focus indicators."})},play:async({canvasElement:e})=>{const a=e.textContent||"";if(!a.includes("Contrast guidance: maintain >= 4.5:1"))throw new Error("High-contrast gate failed: contrast guidance note not visible.");if(!a.includes("High Contrast"))throw new Error("High-contrast gate failed: high-contrast badge not visible.")}},l={name:"InternationalizationAndRTL",parameters:{docs:{description:{story:"Reference for localization, translated labels, and right-to-left layout readiness."}}},render:e=>t.jsx("div",{dir:"rtl",children:t.jsx(W,{...e})}),args:{...n,title:"Plantilla de Paquetes de Trabajo - Referencia",subtitle:"Localization and RTL-ready reference state.",statusBadges:["i18n Ready","RTL Ready"]},play:async({canvasElement:e})=>{if(!e.querySelector('[dir="rtl"]'))throw new Error("RTL gate failed: RTL wrapper missing.");const r=e.textContent||"";if(!r.includes("i18n Ready")||!r.includes("RTL Ready"))throw new Error("RTL gate failed: i18n/RTL badges not visible.");if(!r.includes("Plantilla de Paquetes de Trabajo - Referencia"))throw new Error("RTL gate failed: localized title not visible.")}},d={name:"OfflineSyncConflictState",args:{...n,state:"error",statusBadges:["Offline Queue","Sync Required"],validation:{level:"warning",messages:["Local draft is newer than server version.","Review conflict before final submit."]},footerSlot:t.jsx("div",{className:"rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800",children:"Offline mode reference: queue mutations, show sync status, and allow manual conflict resolution."})},play:async({canvasElement:e})=>{const a=e.textContent||"";for(const r of["Offline Queue","Sync Required","Local draft is newer than server version.","Review conflict before final submit.","Offline mode reference: queue mutations, show sync status, and allow manual conflict resolution."])if(!a.includes(r))throw new Error(`Offline gate failed: missing "${r}"`)}},c={name:"ApprovalWorkflowAndAudit",args:{...n,steps:[{id:"draft",title:"Draft",completed:!0},{id:"review",title:"Review",completed:!0},{id:"approval",title:"Approval"},{id:"release",title:"Release"}],activeStepId:"approval",sidePanelSlot:t.jsxs("div",{className:"space-y-2 text-xs",children:[t.jsx("p",{className:"font-medium",children:"Approval and Audit"}),t.jsx("p",{children:"Pending approver: QA Supervisor"}),t.jsx("p",{children:"Audit ref: AUD-2026-04-06-001"}),t.jsx("p",{children:"Digital signature status: pending"})]})},play:async({canvasElement:e})=>{const a=e.textContent||"";for(const r of["Draft","Review","Approval","Release","Approval and Audit","Pending approver: QA Supervisor","Audit ref: AUD-2026-04-06-001","Digital signature status: pending"])if(!a.includes(r))throw new Error(`Workflow/audit gate failed: missing "${r}"`)}},p={name:"EmptyStateReference",parameters:{docs:{description:{story:"Reference state for newly initialized templates with no selected tasks yet."}}},args:{...n,state:"ready",values:{template_code:"",template_name:"",version:"",maintenance_type:"",aircraft_model:"",policy_snapshot_id:"",active:""},formBodySlot:u({taskCount:0,selectedCount:0,threshold:"0",horizon:"0",note:"No selected task rows available. Start by selecting Aircraft Model and task templates."}),validation:{level:"warning",messages:["Template is in empty draft state. Required fields are not yet complete."]}}},m={name:"SuccessStateReference",parameters:{docs:{description:{story:"Reference state for successful save and post-submit confirmation behavior."}}},args:{...n,state:"success"}};var y,b,h;s.parameters={...s.parameters,docs:{...(y=s.parameters)==null?void 0:y.docs,source:{originalSource:`{
  name: 'DesktopOperations',
  args: {
    ...baseArgs
  }
}`,...(h=(b=s.parameters)==null?void 0:b.docs)==null?void 0:h.source}}};var w,R,x;o.parameters={...o.parameters,docs:{...(w=o.parameters)==null?void 0:w.docs,source:{originalSource:`{
  name: 'TabletGlovedHandMode',
  parameters: {
    viewport: {
      defaultViewport: 'tablet'
    },
    docs: {
      description: {
        story: 'Optimized spacing and larger control targets for tablet and gloved-hand interaction contexts.'
      }
    }
  },
  args: {
    ...baseArgs,
    statusBadges: ['Tablet', 'High-Touch Targets'],
    formBodySlot: legacySlot({
      taskCount: 9,
      selectedCount: 3,
      threshold: '10',
      horizon: '45'
    })
  }
}`,...(x=(R=o.parameters)==null?void 0:R.docs)==null?void 0:x.source}}};var A,S,T;i.parameters={...i.parameters,docs:{...(A=i.parameters)==null?void 0:A.docs,source:{originalSource:`{
  name: 'HighContrastLowLight',
  parameters: {
    docs: {
      description: {
        story: 'Reference for high-contrast operation in low-light hangar/line environments.'
      }
    }
  },
  args: {
    ...baseArgs,
    statusBadges: ['High Contrast', 'Low Light'],
    footerSlot: <div className="rounded-md border border-foreground/40 bg-background p-3 text-sm">
        Contrast guidance: maintain &gt;= 4.5:1 for body text and visible focus indicators.
      </div>
  },
  play: async ({
    canvasElement
  }) => {
    const text = canvasElement.textContent || '';
    if (!text.includes('Contrast guidance: maintain >= 4.5:1')) {
      throw new Error('High-contrast gate failed: contrast guidance note not visible.');
    }
    if (!text.includes('High Contrast')) {
      throw new Error('High-contrast gate failed: high-contrast badge not visible.');
    }
  }
}`,...(T=(S=i.parameters)==null?void 0:S.docs)==null?void 0:T.source}}};var k,C,E;l.parameters={...l.parameters,docs:{...(k=l.parameters)==null?void 0:k.docs,source:{originalSource:`{
  name: 'InternationalizationAndRTL',
  parameters: {
    docs: {
      description: {
        story: 'Reference for localization, translated labels, and right-to-left layout readiness.'
      }
    }
  },
  render: args => <div dir="rtl">
      <AmroStandardFormTemplate {...args} />
    </div>,
  args: {
    ...baseArgs,
    title: 'Plantilla de Paquetes de Trabajo - Referencia',
    subtitle: 'Localization and RTL-ready reference state.',
    statusBadges: ['i18n Ready', 'RTL Ready']
  },
  play: async ({
    canvasElement
  }) => {
    const rtlRoot = canvasElement.querySelector('[dir="rtl"]');
    if (!rtlRoot) {
      throw new Error('RTL gate failed: RTL wrapper missing.');
    }
    const text = canvasElement.textContent || '';
    if (!text.includes('i18n Ready') || !text.includes('RTL Ready')) {
      throw new Error('RTL gate failed: i18n/RTL badges not visible.');
    }
    if (!text.includes('Plantilla de Paquetes de Trabajo - Referencia')) {
      throw new Error('RTL gate failed: localized title not visible.');
    }
  }
}`,...(E=(C=l.parameters)==null?void 0:C.docs)==null?void 0:E.source}}};var L,P,_;d.parameters={...d.parameters,docs:{...(L=d.parameters)==null?void 0:L.docs,source:{originalSource:`{
  name: 'OfflineSyncConflictState',
  args: {
    ...baseArgs,
    state: 'error',
    statusBadges: ['Offline Queue', 'Sync Required'],
    validation: {
      level: 'warning',
      messages: ['Local draft is newer than server version.', 'Review conflict before final submit.']
    },
    footerSlot: <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        Offline mode reference: queue mutations, show sync status, and allow manual conflict resolution.
      </div>
  },
  play: async ({
    canvasElement
  }) => {
    const text = canvasElement.textContent || '';
    for (const expected of ['Offline Queue', 'Sync Required', 'Local draft is newer than server version.', 'Review conflict before final submit.', 'Offline mode reference: queue mutations, show sync status, and allow manual conflict resolution.']) {
      if (!text.includes(expected)) {
        throw new Error(\`Offline gate failed: missing "\${expected}"\`);
      }
    }
  }
}`,...(_=(P=d.parameters)==null?void 0:P.docs)==null?void 0:_.source}}};var O,j,D;c.parameters={...c.parameters,docs:{...(O=c.parameters)==null?void 0:O.docs,source:{originalSource:`{
  name: 'ApprovalWorkflowAndAudit',
  args: {
    ...baseArgs,
    steps: [{
      id: 'draft',
      title: 'Draft',
      completed: true
    }, {
      id: 'review',
      title: 'Review',
      completed: true
    }, {
      id: 'approval',
      title: 'Approval'
    }, {
      id: 'release',
      title: 'Release'
    }],
    activeStepId: 'approval',
    sidePanelSlot: <div className="space-y-2 text-xs">
        <p className="font-medium">Approval and Audit</p>
        <p>Pending approver: QA Supervisor</p>
        <p>Audit ref: AUD-2026-04-06-001</p>
        <p>Digital signature status: pending</p>
      </div>
  },
  play: async ({
    canvasElement
  }) => {
    const text = canvasElement.textContent || '';
    for (const expected of ['Draft', 'Review', 'Approval', 'Release', 'Approval and Audit', 'Pending approver: QA Supervisor', 'Audit ref: AUD-2026-04-06-001', 'Digital signature status: pending']) {
      if (!text.includes(expected)) {
        throw new Error(\`Workflow/audit gate failed: missing "\${expected}"\`);
      }
    }
  }
}`,...(D=(j=c.parameters)==null?void 0:j.docs)==null?void 0:D.source}}};var q,z,N;p.parameters={...p.parameters,docs:{...(q=p.parameters)==null?void 0:q.docs,source:{originalSource:`{
  name: 'EmptyStateReference',
  parameters: {
    docs: {
      description: {
        story: 'Reference state for newly initialized templates with no selected tasks yet.'
      }
    }
  },
  args: {
    ...baseArgs,
    state: 'ready',
    values: {
      template_code: '',
      template_name: '',
      version: '',
      maintenance_type: '',
      aircraft_model: '',
      policy_snapshot_id: '',
      active: ''
    },
    formBodySlot: legacySlot({
      taskCount: 0,
      selectedCount: 0,
      threshold: '0',
      horizon: '0',
      note: 'No selected task rows available. Start by selecting Aircraft Model and task templates.'
    }),
    validation: {
      level: 'warning',
      messages: ['Template is in empty draft state. Required fields are not yet complete.']
    }
  }
}`,...(N=(z=p.parameters)==null?void 0:z.docs)==null?void 0:N.source}}};var B,H,M;m.parameters={...m.parameters,docs:{...(B=m.parameters)==null?void 0:B.docs,source:{originalSource:`{
  name: 'SuccessStateReference',
  parameters: {
    docs: {
      description: {
        story: 'Reference state for successful save and post-submit confirmation behavior.'
      }
    }
  },
  args: {
    ...baseArgs,
    state: 'success'
  }
}`,...(M=(H=m.parameters)==null?void 0:H.docs)==null?void 0:M.source}}};const pe=["DesktopOperations","TabletGlovedHandMode","HighContrastLowLight","InternationalizationAndRTL","OfflineSyncConflictState","ApprovalWorkflowAndAudit","EmptyStateReference","SuccessStateReference"];export{c as ApprovalWorkflowAndAudit,s as DesktopOperations,p as EmptyStateReference,i as HighContrastLowLight,l as InternationalizationAndRTL,d as OfflineSyncConflictState,m as SuccessStateReference,o as TabletGlovedHandMode,pe as __namedExportsOrder,ce as default};
