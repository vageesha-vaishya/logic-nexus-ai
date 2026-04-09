import{j as n,R as l}from"./iframe-BA3bigUR.js";import{A as $}from"./AmroPartsInventoryWorkbench-D05X1ZtX.js";import{g as N}from"./mockPartsInventoryData-Bqi8Qb1u.js";import{a as V,b as D,c as v,d as W}from"./amroPartsEnterpriseStoryTemplate-yPioTkv-.js";import"./preload-helper-C1FmrZbK.js";import"./badge-D9TJ8RBX.js";import"./button-CbA7afJr.js";import"./card-CStZ5zmI.js";import"./select-tCR7EeRx.js";import"./index-BdQq_4o_.js";import"./index-qkao1V5Z.js";import"./index-M3gPENRQ.js";import"./index-C6ofQxaF.js";import"./chevron-down-Bjk6AhXu.js";import"./check-6KMg7cXL.js";import"./chevron-up-q6yw7oks.js";import"./AmroInventoryDataGridTemplate-CYSZUcr6.js";import"./label-D9P-urtt.js";import"./switch-CNSQvbRa.js";import"./textarea-BrNA5qoz.js";import"./arrow-up-DCVWlWzZ.js";import"./rows-3-CgbrJqjX.js";import"./chevron-left-4UEH2n0y.js";import"./chevron-right-B8SgNuvV.js";import"./grip-vertical-BUIT8cdh.js";import"./plus-LC_JnUKm.js";import"./trash-2-DPqZeQC6.js";import"./save-BjhEVdwS.js";import"./refresh-ccw-CDGR8fEE.js";import"./triangle-alert-sZiJQXiO.js";import"./sliders-horizontal-CWf4QNQ8.js";import"./loader-circle-DesVXUTG.js";const{fn:m}=__STORYBOOK_MODULE_TEST__,xe={title:"AMRO/Parts/AmroPartsInventoryWorkbench",parameters:{...v,docs:{...v.docs||{},description:{component:W({componentId:"AMRO-PARTS-WORKBENCH",ownerTeam:"AMRO Platform Team",releaseRing:"production",dataClassification:"internal",approvalPolicy:"two_person_review_required",auditReference:"SCR-AMRO-PARTS-ENTERPRISE-STORYBOOK"})}}},decorators:[D],tags:["autodocs","amro","parts","enterprise"],argTypes:{...V,state:{control:"inline-radio",options:["loading","empty","ready","error"]},viewMode:{control:"inline-radio",options:["horizontal-split","vertical-split","stacked-auto"]},density:{control:"inline-radio",options:["compact","normal","comfortable"]},scrollBehavior:{control:"inline-radio",options:["virtualization","pagination","infinite-scroll"]},recordCount:{control:{type:"number",min:0,max:1e3,step:20}},includeExpired:{control:"boolean"}}};function L(e){const j=l.useMemo(()=>N({count:e.recordCount,includeExpired:e.includeExpired,seed:77}),[e.recordCount,e.includeExpired]),[u,z]=l.useState([]),a=l.useCallback(r=>{z(t=>[`${new Date().toLocaleTimeString()} · ${r}`,...t].slice(0,6))},[]),y=e.state==="empty"?"empty":e.state,B=y==="empty"?[]:j;return n.jsxs("div",{className:"space-y-3 p-4 md:p-6",children:[n.jsx($,{...e,state:y,records:B,onRetry:()=>{var r;a("Retry clicked"),(r=e.onRetry)==null||r.call(e)},onRefresh:()=>{var r;a("Refresh clicked"),(r=e.onRefresh)==null||r.call(e)},onCreatePart:()=>{var r;a("Add Part clicked"),(r=e.onCreatePart)==null||r.call(e)},onRecordSelectionChange:r=>{var t;a(`Selected ${r.recordId} via ${r.source}`),(t=e.onRecordSelectionChange)==null||t.call(e,r)},onScrollPositionChange:r=>{var t;a(`Scroll first=${r.firstVisibleIndex} last=${r.lastVisibleIndex}`),(t=e.onScrollPositionChange)==null||t.call(e,r)},onViewModeChange:r=>{var t;a(`View ${r.requested} => ${r.effective}`),(t=e.onViewModeChange)==null||t.call(e,r)}}),n.jsxs("div",{className:"rounded-md border bg-background p-3 text-xs text-muted-foreground",children:[n.jsx("p",{className:"mb-2 font-semibold text-foreground",children:"Interaction Events"}),u.length?n.jsx("ul",{className:"space-y-1",children:u.map(r=>n.jsx("li",{children:r},r))}):n.jsx("p",{children:"No interactions yet."})]})]})}const o={render:e=>n.jsx(L,{...e}),args:{state:"ready",title:"AMRO Parts Inventory",subtitle:"Operational table and side-by-side detail view for parts inventory records.",viewMode:"horizontal-split",density:"normal",scrollBehavior:"virtualization",pageSize:25,recordCount:220,includeExpired:!0,onRetry:m(),onRefresh:m(),onCreatePart:m()}},i={...o,args:{...o.args,state:"loading"}},s={...o,args:{...o.args,state:"empty",recordCount:0}},c={...o,args:{...o.args,state:"error",errorMessage:"AMRO parts inventory endpoint timeout: /api/v2/amro/inventory/sync"}},d={...o,args:{...o.args,viewMode:"vertical-split",density:"comfortable"}},p={...o,args:{...o.args,viewMode:"stacked-auto",scrollBehavior:"infinite-scroll",density:"compact"}};var R,f,P;o.parameters={...o.parameters,docs:{...(R=o.parameters)==null?void 0:R.docs,source:{originalSource:`{
  render: args => <StoryRenderer {...args} />,
  args: {
    state: 'ready',
    title: 'AMRO Parts Inventory',
    subtitle: 'Operational table and side-by-side detail view for parts inventory records.',
    viewMode: 'horizontal-split',
    density: 'normal',
    scrollBehavior: 'virtualization',
    pageSize: 25,
    recordCount: 220,
    includeExpired: true,
    onRetry: fn(),
    onRefresh: fn(),
    onCreatePart: fn()
  }
}`,...(P=(f=o.parameters)==null?void 0:f.docs)==null?void 0:P.source}}};var S,h,x;i.parameters={...i.parameters,docs:{...(S=i.parameters)==null?void 0:S.docs,source:{originalSource:`{
  ...Populated,
  args: {
    ...Populated.args,
    state: 'loading'
  }
}`,...(x=(h=i.parameters)==null?void 0:h.docs)==null?void 0:x.source}}};var E,b,g;s.parameters={...s.parameters,docs:{...(E=s.parameters)==null?void 0:E.docs,source:{originalSource:`{
  ...Populated,
  args: {
    ...Populated.args,
    state: 'empty',
    recordCount: 0
  }
}`,...(g=(b=s.parameters)==null?void 0:b.docs)==null?void 0:g.source}}};var C,M,O;c.parameters={...c.parameters,docs:{...(C=c.parameters)==null?void 0:C.docs,source:{originalSource:`{
  ...Populated,
  args: {
    ...Populated.args,
    state: 'error',
    errorMessage: 'AMRO parts inventory endpoint timeout: /api/v2/amro/inventory/sync'
  }
}`,...(O=(M=c.parameters)==null?void 0:M.docs)==null?void 0:O.source}}};var w,A,k;d.parameters={...d.parameters,docs:{...(w=d.parameters)==null?void 0:w.docs,source:{originalSource:`{
  ...Populated,
  args: {
    ...Populated.args,
    viewMode: 'vertical-split',
    density: 'comfortable'
  }
}`,...(k=(A=d.parameters)==null?void 0:A.docs)==null?void 0:k.source}}};var T,I,_;p.parameters={...p.parameters,docs:{...(T=p.parameters)==null?void 0:T.docs,source:{originalSource:`{
  ...Populated,
  args: {
    ...Populated.args,
    viewMode: 'stacked-auto',
    scrollBehavior: 'infinite-scroll',
    density: 'compact'
  }
}`,...(_=(I=p.parameters)==null?void 0:I.docs)==null?void 0:_.source}}};const Ee=["Populated","Loading","Empty","ErrorState","VerticalWorkflow","ResponsiveStacked"];export{s as Empty,c as ErrorState,i as Loading,o as Populated,p as ResponsiveStacked,d as VerticalWorkflow,Ee as __namedExportsOrder,xe as default};
