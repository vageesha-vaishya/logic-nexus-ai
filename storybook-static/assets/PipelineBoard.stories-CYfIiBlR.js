import{j as r}from"./jsx-runtime-Z5uAzocK.js";import{r as m}from"./index-pP6CS22B.js";import{a as c}from"./index-B-lxVbXh.js";import{K}from"./KanbanBoard-aS9rzFkW.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./v4-CtRu48qb.js";import"./core.esm-ApSfpczI.js";import"./index-DLHbBEj9.js";import"./sortable.esm-CIusYQ_n.js";import"./card-BRH59LJj.js";import"./utils-mOyDzkE6.js";import"./badge-BazqNHwJ.js";import"./index-CyLt0tHj.js";import"./button-SB7iZ1uz.js";import"./avatar-CzFMJ_Ps.js";import"./index-CuDmVINA.js";import"./index-DSMx10ar.js";import"./index-BzXjCyLi.js";import"./index-C_BnrBF9.js";import"./input-uwiBJMe4.js";import"./proxy-C3Nso6pS.js";import"./createLucideIcon-DEP7aKU9.js";import"./scroll-area-CNxhw6Ms.js";import"./index-Bk-1lDEB.js";import"./index-7TLWIpSA.js";import"./index-DW48STyt.js";import"./plus-BkGVcHzy.js";import"./ellipsis-irieReKa.js";import"./index-BXs83rev.js";const x=[{id:"new",title:"New",color:"bg-red-500"},{id:"qualified",title:"Qualified",color:"bg-red-500"},{id:"proposition",title:"Proposition",color:"bg-red-500"},{id:"won",title:"Won",color:"bg-red-500"}],_=[{id:"n1",title:"Quote for 150 carpets",subtitle:"Product",status:"new",priority:"high",value:4e4},{id:"n2",title:"Quote for 12 Tables",subtitle:"Product",status:"new",priority:"medium",value:4e4},{id:"n3",title:"Chester Reed's opportunity",subtitle:"SOS Delhi, Chester Reed",status:"new",priority:"low",value:0},{id:"q1",title:"Global Solutions: Furnitures",subtitle:"Design",status:"qualified",priority:"high",value:3800},{id:"q2",title:"Quote for 600 Chairs",subtitle:"Product",status:"qualified",priority:"medium",value:22500},{id:"q3",title:"Info about services",subtitle:"Product",status:"qualified",priority:"medium",value:25e3},{id:"p1",title:"Modern Open Space",subtitle:"Information",status:"proposition",priority:"high",value:4500},{id:"p2",title:"Office Design and Architecture",subtitle:"Consulting",status:"proposition",priority:"medium",value:9e3},{id:"p3",title:"5 VP Chairs",subtitle:"Services",status:"proposition",priority:"low",value:560},{id:"p4",title:"Need 20 Desks",subtitle:"Consulting",status:"proposition",priority:"low",value:6e4},{id:"w1",title:"Distributor Contract",subtitle:"Information • Other",status:"won",priority:"high",value:19800}],C=[{name:"Victoria Li",avatarUrl:"https://i.pravatar.cc/150?u=victoria"},{name:"James Porter",avatarUrl:"https://i.pravatar.cc/150?u=james"},{name:"Noah Singh",avatarUrl:"https://i.pravatar.cc/150?u=noah"}];function G(e,n,u){if(e==="empty")return[];const l=_.map((s,o)=>({...s,currency:u,assignee:n?C[o%C.length]:void 0,updatedAt:new Date(2026,2,o%25+1).toISOString()}));return e==="compact"?l.filter(s=>s.status!=="proposition"||Number(s.value)>=9e3):e==="high-volume"?l.flatMap((o,p)=>[o,{...o,id:`${o.id}-hv`,title:`${o.title} #${p+1}`,value:Number(o.value||0)+(p+1)*700}]):l}function J(e,n){return`${e.toLocaleString("en-US")}${n}`}function X(e){const n=m.useMemo(()=>e.showWonColumnOnly?x.filter(t=>t.id==="won"):x,[e.showWonColumnOnly]),u=m.useMemo(()=>G(e.visualMode,e.showAssignees,e.currencySymbol),[e.visualMode,e.showAssignees,e.currencySymbol]),[l,s]=m.useState(u);m.useEffect(()=>{s(u)},[u]);const o=m.useMemo(()=>n.reduce((t,i)=>(t[i.id]=l.filter(a=>a.status===i.id).reduce((a,d)=>a+Number(d.value||0),0),t),{}),[n,l]),p=(t,i,a)=>{if(e.freezeInteractions){c("pipeline.dragBlocked")({activeId:t,overId:i,newStatus:a});return}c("pipeline.dragEnd")({activeId:t,overId:i,newStatus:a}),s(d=>d.map(S=>S.id===t?{...S,status:a}:S))},Q=async(t,i)=>{if(e.freezeInteractions){c("pipeline.itemUpdateBlocked")({id:t,updates:i});return}c("pipeline.itemUpdate")({id:t,updates:i}),s(a=>a.map(d=>d.id===t?{...d,...i}:d))},F=t=>{if(e.freezeInteractions){c("pipeline.itemClickBlocked")({id:t});return}c("pipeline.itemClick")({id:t})};return r.jsxs("div",{className:"bg-white p-4 md:p-6",style:{minHeight:`${e.boardHeight+120}px`},children:[r.jsx("div",{className:"mb-4 grid gap-3 grid-cols-2 md:grid-cols-4",children:n.map(t=>r.jsxs("div",{className:"rounded-md border border-border bg-card p-3",children:[r.jsxs("div",{className:"mb-1 flex items-center justify-between",children:[r.jsx("span",{className:"text-sm font-semibold",children:t.title}),r.jsx("span",{className:"text-sm font-semibold tabular-nums",children:J(o[t.id]||0,e.currencySymbol)})]}),r.jsx("div",{className:"h-1 w-full rounded-full bg-red-500/80"})]},t.id))}),r.jsx("div",{className:`overflow-hidden rounded-lg border bg-muted/20 p-2 ${e.freezeInteractions?"pointer-events-none":""}`,style:{height:`${e.boardHeight}px`},children:r.jsx(K,{columns:n,items:l,onDragEnd:p,onItemUpdate:Q,onItemClick:F})})]})}const ke={title:"Leads/Pipeline Module",component:X,tags:["autodocs"],args:{visualMode:"reference",showWonColumnOnly:!1,showAssignees:!0,currencySymbol:" €",boardHeight:620,freezeInteractions:!1},argTypes:{visualMode:{control:"select",options:["reference","compact","high-volume","empty"],description:"Select visual density and scenario for stakeholder review."},showWonColumnOnly:{control:"boolean",description:"Focus on closed outcomes by showing only the Won stage."},showAssignees:{control:"boolean",description:"Toggle avatar rendering on cards."},currencySymbol:{control:"text",description:"Currency suffix used in stage totals and card values."},boardHeight:{control:{type:"range",min:420,max:900,step:20},description:"Board canvas height for responsive previews."},freezeInteractions:{control:"boolean",description:"Disable drag, click, and edit interactions for static review sessions."}},decorators:[e=>r.jsx("div",{className:"min-h-screen bg-background text-foreground",children:r.jsx(e,{})})],parameters:{layout:"fullscreen",viewport:{defaultViewport:"desktop"},controls:{expanded:!0,sort:"requiredFirst"},a11y:{disable:!1},docs:{description:{component:"Leads pipeline visual reference for stakeholder validation. Integration points: map lead records from `PipelineService.listLeads` into `KanbanItem`, pass stage metadata as `ColumnType[]`, persist drag transitions through `PipelineService.transitionLeadStage`, and route card selection to `/dashboard/leads/:id`."}}}},g={},h={args:{visualMode:"reference",showWonColumnOnly:!1,showAssignees:!0,currencySymbol:" €",boardHeight:620,freezeInteractions:!0},parameters:{controls:{include:["showWonColumnOnly","showAssignees","currencySymbol","boardHeight"]},docs:{description:{story:"Demo-safe view for stakeholder sign-off. Interactions are frozen while still allowing visual and responsive validation."}}}},f={args:{visualMode:"compact",boardHeight:560}},v={args:{visualMode:"high-volume",boardHeight:700}},b={args:{visualMode:"empty"}},y={args:{visualMode:"compact",showAssignees:!1,boardHeight:520},parameters:{viewport:{defaultViewport:"small"}}},w={args:{visualMode:"reference",boardHeight:620},parameters:{viewport:{defaultViewport:"tablet"}}};var M,I,H;g.parameters={...g.parameters,docs:{...(M=g.parameters)==null?void 0:M.docs,source:{originalSource:"{}",...(H=(I=g.parameters)==null?void 0:I.docs)==null?void 0:H.source}}};var k,j,N;h.parameters={...h.parameters,docs:{...(k=h.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    visualMode: 'reference',
    showWonColumnOnly: false,
    showAssignees: true,
    currencySymbol: ' €',
    boardHeight: 620,
    freezeInteractions: true
  },
  parameters: {
    controls: {
      include: ['showWonColumnOnly', 'showAssignees', 'currencySymbol', 'boardHeight']
    },
    docs: {
      description: {
        story: 'Demo-safe view for stakeholder sign-off. Interactions are frozen while still allowing visual and responsive validation.'
      }
    }
  }
}`,...(N=(j=h.parameters)==null?void 0:j.docs)==null?void 0:N.source}}};var O,P,A;f.parameters={...f.parameters,docs:{...(O=f.parameters)==null?void 0:O.docs,source:{originalSource:`{
  args: {
    visualMode: 'compact',
    boardHeight: 560
  }
}`,...(A=(P=f.parameters)==null?void 0:P.docs)==null?void 0:A.source}}};var V,D,R;v.parameters={...v.parameters,docs:{...(V=v.parameters)==null?void 0:V.docs,source:{originalSource:`{
  args: {
    visualMode: 'high-volume',
    boardHeight: 700
  }
}`,...(R=(D=v.parameters)==null?void 0:D.docs)==null?void 0:R.source}}};var z,W,E;b.parameters={...b.parameters,docs:{...(z=b.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    visualMode: 'empty'
  }
}`,...(E=(W=b.parameters)==null?void 0:W.docs)==null?void 0:E.source}}};var q,U,$;y.parameters={...y.parameters,docs:{...(q=y.parameters)==null?void 0:q.docs,source:{originalSource:`{
  args: {
    visualMode: 'compact',
    showAssignees: false,
    boardHeight: 520
  },
  parameters: {
    viewport: {
      defaultViewport: 'small'
    }
  }
}`,...($=(U=y.parameters)==null?void 0:U.docs)==null?void 0:$.source}}};var L,B,T;w.parameters={...w.parameters,docs:{...(L=w.parameters)==null?void 0:L.docs,source:{originalSource:`{
  args: {
    visualMode: 'reference',
    boardHeight: 620
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet'
    }
  }
}`,...(T=(B=w.parameters)==null?void 0:B.docs)==null?void 0:T.source}}};const je=["ScreenshotReference","StakeholderReview","CompactView","HighVolumePipeline","EmptyState","MobileReview","TabletReview"];export{f as CompactView,b as EmptyState,v as HighVolumePipeline,y as MobileReview,g as ScreenshotReference,h as StakeholderReview,w as TabletReview,je as __namedExportsOrder,ke as default};
