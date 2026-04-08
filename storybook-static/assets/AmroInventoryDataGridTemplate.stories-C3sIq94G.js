import{j as o,R as i}from"./iframe-CsWugpTQ.js";import{B as le}from"./badge-CieB6EZu.js";import{A as se}from"./AmroInventoryDataGridTemplate-DLqUwver.js";import{a as de,b as ce,c as S,d as pe}from"./amroPartsEnterpriseStoryTemplate-C_VASplh.js";import"./preload-helper-C1FmrZbK.js";import"./button-hQwFhXKy.js";import"./card-DElVqdz_.js";import"./label-0vt78nj7.js";import"./select-Bos0K022.js";import"./index-BdQq_4o_.js";import"./index-BMNU2nVA.js";import"./index-DutRtgoX.js";import"./chevron-down-KegWGprN.js";import"./check-CREjJjm4.js";import"./chevron-up-Bu-ihN1g.js";import"./switch-ByXkVZAf.js";import"./textarea-Dqhh79Oy.js";import"./arrow-up-t6BYoJdo.js";import"./chevron-left-BcRsrA3V.js";import"./chevron-right-gZLE9Dpm.js";import"./grip-vertical-Bdi6a1Q7.js";import"./plus-GiGrk20-.js";import"./trash-2-Afz3fUjr.js";import"./save-LqEWDU7K.js";const{fn:d}=__STORYBOOK_MODULE_TEST__,f=["Rotable","Consumable","Tooling","Equipment"],R=["Stores","Line Maintenance","Heavy Maintenance","Planning"],ue=Array.from({length:220}).map((e,r)=>({id:`INV-${String(r+1).padStart(4,"0")}`,partNumber:`PN-${1e4+r}`,description:`Hydraulic component ${r+1}`,quantity:Math.max(0,Math.floor(120-r%33*2+r%7)),lastUpdated:new Date(2026,r%12,r%27+1).toISOString(),serviceable:r%5!==0,metadata:{aisle:`A-${r%9+1}`,bin:`B-${r%14+1}`,tags:[r%2===0?"critical":"routine",r%3===0?"serialized":"bulk"]},category:f[r%f.length],owner:R[r%R.length]})),me=Array.from({length:40}).map((e,r)=>({id:`LONG-${String(r+1).padStart(4,"0")}`,partNumber:`PN-ULTRA-LONG-${1e5+r}-AFT-COMPONENT-SERIES`,description:`High-cycle pressure regulator assembly with extended maintenance narrative and serialized compliance remarks for aircraft ${r+1}.`,quantity:Math.max(0,40-r%11),lastUpdated:new Date(2026,r%12,r%27+1).toISOString(),serviceable:r%4!==0,metadata:{aisle:`ZONE-${r%6+1}-NORTH-WING-BLOCK`,bin:`BIN-${r%13+1}-OVERSIZE-COMPARTMENT`,tags:["traceability-required","long-content-validation","separator-persistence-check",r%2===0?"serialized-inspection-cycle":"deferred-planning-review"]},category:f[r%f.length],owner:R[r%R.length]})),be=[{key:"id",header:"Record ID",sortable:!0,filterable:!0,groupable:!0,resizable:!0,width:150,dataType:"text"},{key:"partNumber",header:"Part Number",sortable:!0,filterable:!0,groupable:!0,resizable:!0,width:150,dataType:"text"},{key:"description",header:"Description",sortable:!0,filterable:!0,resizable:!0,width:230,dataType:"text"},{key:"quantity",header:"Qty",sortable:!0,filterable:!1,groupable:!1,resizable:!0,width:90,dataType:"numeric"},{key:"lastUpdated",header:"Last Updated",sortable:!0,filterable:!1,groupable:!1,resizable:!0,width:130,dataType:"date"},{key:"serviceable",header:"Serviceable",sortable:!0,filterable:!1,groupable:!0,resizable:!0,width:120,dataType:"boolean",render:e=>o.jsx(le,{variant:e.serviceable?"default":"destructive",children:e.serviceable?"Ready":"Blocked"})},{key:"metadata",header:"Metadata",sortable:!1,filterable:!0,groupable:!1,resizable:!0,width:250,dataType:"object"},{key:"category",header:"Category",sortable:!0,filterable:!0,groupable:!0,resizable:!0,width:140,dataType:"text"},{key:"owner",header:"Owner",sortable:!0,filterable:!0,groupable:!0,resizable:!0,width:180,dataType:"text"}],K=se,Ue={title:"AMRO/Templates/AmroInventoryDataGridTemplate",component:K,parameters:{...S,docs:{...S.docs||{},description:{component:pe({componentId:"AMRO-INVENTORY-DATAGRID-TEMPLATE",ownerTeam:"AMRO Platform Team",releaseRing:"production",dataClassification:"internal",approvalPolicy:"two_person_review_required",auditReference:"SCR-AMRO-TEMPLATES-DATAGRID"})}}},decorators:[ce],tags:["autodocs","amro","parts","enterprise"],argTypes:{...de,viewMode:{control:"inline-radio",options:["horizontal-split","vertical-split","stacked-auto"]},density:{control:"inline-radio",options:["compact","normal","comfortable"]},scrollBehavior:{control:"inline-radio",options:["virtualization","pagination","infinite-scroll"]},pageSize:{control:{type:"number",min:5,max:100,step:5}},enableHighContrast:{control:"boolean"},enableDetailPanelToggle:{control:"boolean"},defaultDetailPanelVisible:{control:"boolean"},syncDetailWithScroll:{control:"boolean"},onCrudAction:{action:"crud-action"},onCreateRecord:{action:"create-record"},onReadRecord:{action:"read-record"},onUpdateRecord:{action:"update-record"},onDeleteRecord:{action:"delete-record"},onSaveRecord:{action:"save-record"},onCancelRecord:{action:"cancel-record"}}};function he(e){const[r,F]=i.useState([]),[v,Y]=i.useState([]),w=i.useRef(0),s=i.useCallback(t=>{F(a=>[`${new Date().toLocaleTimeString()} - ${t}`,...a].slice(0,8))},[]),l=i.useCallback(t=>{Y(a=>[`${new Date().toLocaleTimeString()} - ${t}`,...a].slice(0,8))},[]),Z=i.useCallback(t=>{var a;s(`selection: ${t.recordId} (${t.source})`),(a=e.onRecordSelectionChange)==null||a.call(e,t)},[s,e]),Q=i.useCallback(t=>{var c;const a=Date.now();a-w.current>500&&(s(`scroll: first=${t.firstVisibleIndex} last=${t.lastVisibleIndex} top=${Math.round(t.scrollTop)}`),w.current=a),(c=e.onScrollPositionChange)==null||c.call(e,t)},[s,e]),J=i.useCallback(t=>{var a;s(`view: requested=${t.requested} effective=${t.effective} width=${t.viewportWidth}`),(a=e.onViewModeChange)==null||a.call(e,t)},[s,e]),X=i.useCallback(t=>{var a;s(`detail panel: ${t?"visible":"hidden"}`),(a=e.onDetailPanelVisibilityChange)==null||a.call(e,t)},[s,e]),ee=i.useCallback((t,a)=>{var c;l(`crud: ${t}${a!=null&&a.id?` on ${a.id}`:""}`),(c=e.onCrudAction)==null||c.call(e,t,a)},[l,e]),te=i.useCallback(()=>{var t;l("create record"),(t=e.onCreateRecord)==null||t.call(e)},[l,e]),ae=i.useCallback(t=>{var a;l(`read ${t.id}`),(a=e.onReadRecord)==null||a.call(e,t)},[l,e]),re=i.useCallback(t=>{var a;l(`update ${t.id}`),(a=e.onUpdateRecord)==null||a.call(e,t)},[l,e]),oe=i.useCallback(t=>{var a;l(`delete ${t.id}`),(a=e.onDeleteRecord)==null||a.call(e,t)},[l,e]),ne=i.useCallback(t=>{var a;l(`save ${t.id}`),(a=e.onSaveRecord)==null||a.call(e,t)},[l,e]),ie=i.useCallback(t=>{var a;l(`cancel ${t.id}`),(a=e.onCancelRecord)==null||a.call(e,t)},[l,e]);return o.jsxs("div",{className:"space-y-3",children:[o.jsx(K,{...e,onRecordSelectionChange:Z,onScrollPositionChange:Q,onViewModeChange:J,onDetailPanelVisibilityChange:X,onCrudAction:ee,onCreateRecord:te,onReadRecord:ae,onUpdateRecord:re,onDeleteRecord:oe,onSaveRecord:ne,onCancelRecord:ie}),o.jsxs("div",{className:"grid gap-3 md:grid-cols-2",children:[o.jsxs("div",{className:"rounded-md border p-3",children:[o.jsx("h4",{className:"mb-2 text-sm font-semibold",children:"Event Stream"}),o.jsx("ul",{className:"space-y-1 text-xs text-muted-foreground",children:r.length>0?r.map(t=>o.jsx("li",{children:t},t)):o.jsx("li",{children:"No events captured yet."})})]}),o.jsxs("div",{className:"rounded-md border p-3",children:[o.jsx("h4",{className:"mb-2 text-sm font-semibold",children:"CRUD Events"}),o.jsx("ul",{className:"space-y-1 text-xs text-muted-foreground",children:v.length>0?v.map(t=>o.jsx("li",{children:t},t)):o.jsx("li",{children:"No CRUD actions captured yet."})})]})]}),o.jsxs("div",{className:"rounded-md border p-3",children:[o.jsx("h4",{className:"mb-2 text-sm font-semibold",children:"Viewport Validation Checklist (1366x768)"}),o.jsxs("ul",{className:"space-y-1 text-xs text-muted-foreground",children:[o.jsx("li",{children:"1. Record Detail form remains fully usable without horizontal scrolling."}),o.jsx("li",{children:"2. Sticky action bar remains visible while scrolling long forms."}),o.jsx("li",{children:"3. Grid/detail separator supports mouse drag and keyboard resize."}),o.jsx("li",{children:"4. Collapsible panel controls keep navigation accessible."}),o.jsx("li",{children:"5. Focus states are visible for action buttons and separator handle."})]})]})]})}const n={render:e=>o.jsx(he,{...e}),args:{title:"AMRO Inventory Grid Template",subtitle:"Split-layout grid with synchronized detail panel",records:ue,columns:be,viewMode:"horizontal-split",density:"normal",scrollBehavior:"virtualization",pageSize:20,enableHighContrast:!1,enableDetailPanelToggle:!0,defaultDetailPanelVisible:!0,syncDetailWithScroll:!0,persistKey:"storybook-amro-grid-template",onCrudAction:d(),onCreateRecord:d(),onReadRecord:d(),onUpdateRecord:d(),onDeleteRecord:d(),onSaveRecord:d(),onCancelRecord:d()}},p={...n,args:{...n.args,viewMode:"horizontal-split"}},u={...n,args:{...n.args,viewMode:"vertical-split"}},m={...n,args:{...n.args,viewMode:"stacked-auto"}},b={...n,args:{...n.args,viewMode:"horizontal-split",density:"normal"},parameters:{viewport:{defaultViewport:"desktop1366",viewports:{desktop1366:{name:"Desktop 1366x768",styles:{width:"1366px",height:"768px"},type:"desktop"}}}}},h={...n,args:{...n.args,crudPermissions:{create:!1,read:!0,update:!1,delete:!1,save:!1,cancel:!1}}},y={...n,args:{...n.args,crudPermissions:{create:!0,read:!0,update:!0,delete:!1,save:!0,cancel:!0}}},g={...n,args:{...n.args,title:"AMRO Inventory Grid Template - Long Content Separator Validation",subtitle:"Stress scenario for separator persistence with long text, deep metadata, and narrow viewport rendering.",records:me,viewMode:"stacked-auto",density:"comfortable",scrollBehavior:"pagination",pageSize:10},parameters:{docs:{description:{story:"Validates persistent separator boxes under extreme content length and narrow viewport conditions. Confirm no overlap between separator, field blocks, and panel boundaries."}},viewport:{defaultViewport:"mobileStress",viewports:{mobileStress:{name:"Mobile Stress 390x844",styles:{width:"390px",height:"844px"},type:"mobile"}}}}};var C,k,P;n.parameters={...n.parameters,docs:{...(C=n.parameters)==null?void 0:C.docs,source:{originalSource:`{
  render: args => <InteractiveTemplate {...args} />,
  args: {
    title: 'AMRO Inventory Grid Template',
    subtitle: 'Split-layout grid with synchronized detail panel',
    records: mockRecords,
    columns,
    viewMode: 'horizontal-split',
    density: 'normal',
    scrollBehavior: 'virtualization',
    pageSize: 20,
    enableHighContrast: false,
    enableDetailPanelToggle: true,
    defaultDetailPanelVisible: true,
    syncDetailWithScroll: true,
    persistKey: 'storybook-amro-grid-template',
    onCrudAction: fn(),
    onCreateRecord: fn(),
    onReadRecord: fn(),
    onUpdateRecord: fn(),
    onDeleteRecord: fn(),
    onSaveRecord: fn(),
    onCancelRecord: fn()
  }
}`,...(P=(k=n.parameters)==null?void 0:k.docs)==null?void 0:P.source}}};var T,x,D;p.parameters={...p.parameters,docs:{...(T=p.parameters)==null?void 0:T.docs,source:{originalSource:`{
  ...Playground,
  args: {
    ...Playground.args,
    viewMode: 'horizontal-split'
  }
}`,...(D=(x=p.parameters)==null?void 0:x.docs)==null?void 0:D.source}}};var M,z,A;u.parameters={...u.parameters,docs:{...(M=u.parameters)==null?void 0:M.docs,source:{originalSource:`{
  ...Playground,
  args: {
    ...Playground.args,
    viewMode: 'vertical-split'
  }
}`,...(A=(z=u.parameters)==null?void 0:z.docs)==null?void 0:A.source}}};var N,$,V;m.parameters={...m.parameters,docs:{...(N=m.parameters)==null?void 0:N.docs,source:{originalSource:`{
  ...Playground,
  args: {
    ...Playground.args,
    viewMode: 'stacked-auto'
  }
}`,...(V=($=m.parameters)==null?void 0:$.docs)==null?void 0:V.source}}};var O,j,E;b.parameters={...b.parameters,docs:{...(O=b.parameters)==null?void 0:O.docs,source:{originalSource:`{
  ...Playground,
  args: {
    ...Playground.args,
    viewMode: 'horizontal-split',
    density: 'normal'
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop1366',
      viewports: {
        desktop1366: {
          name: 'Desktop 1366x768',
          styles: {
            width: '1366px',
            height: '768px'
          },
          type: 'desktop'
        }
      }
    }
  }
}`,...(E=(j=b.parameters)==null?void 0:j.docs)==null?void 0:E.source}}};var I,L,U;h.parameters={...h.parameters,docs:{...(I=h.parameters)==null?void 0:I.docs,source:{originalSource:`{
  ...Playground,
  args: {
    ...Playground.args,
    crudPermissions: {
      create: false,
      read: true,
      update: false,
      delete: false,
      save: false,
      cancel: false
    }
  }
}`,...(U=(L=h.parameters)==null?void 0:L.docs)==null?void 0:U.source}}};var G,_,B;y.parameters={...y.parameters,docs:{...(G=y.parameters)==null?void 0:G.docs,source:{originalSource:`{
  ...Playground,
  args: {
    ...Playground.args,
    crudPermissions: {
      create: true,
      read: true,
      update: true,
      delete: false,
      save: true,
      cancel: true
    }
  }
}`,...(B=(_=y.parameters)==null?void 0:_.docs)==null?void 0:B.source}}};var H,q,W;g.parameters={...g.parameters,docs:{...(H=g.parameters)==null?void 0:H.docs,source:{originalSource:`{
  ...Playground,
  args: {
    ...Playground.args,
    title: 'AMRO Inventory Grid Template - Long Content Separator Validation',
    subtitle: 'Stress scenario for separator persistence with long text, deep metadata, and narrow viewport rendering.',
    records: longContentRecords,
    viewMode: 'stacked-auto',
    density: 'comfortable',
    scrollBehavior: 'pagination',
    pageSize: 10
  },
  parameters: {
    docs: {
      description: {
        story: 'Validates persistent separator boxes under extreme content length and narrow viewport conditions. Confirm no overlap between separator, field blocks, and panel boundaries.'
      }
    },
    viewport: {
      defaultViewport: 'mobileStress',
      viewports: {
        mobileStress: {
          name: 'Mobile Stress 390x844',
          styles: {
            width: '390px',
            height: '844px'
          },
          type: 'mobile'
        }
      }
    }
  }
}`,...(W=(q=g.parameters)==null?void 0:q.docs)==null?void 0:W.source}}};const Ge=["Playground","HorizontalSplit","VerticalSplit","ResponsiveStacked","Desktop1366Validation","ReadOnlyRole","EditorRole","LongContentSeparatorValidation"];export{b as Desktop1366Validation,y as EditorRole,p as HorizontalSplit,g as LongContentSeparatorValidation,n as Playground,h as ReadOnlyRole,m as ResponsiveStacked,u as VerticalSplit,Ge as __namedExportsOrder,Ue as default};
