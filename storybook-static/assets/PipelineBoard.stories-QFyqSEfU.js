import{j as r,r as p}from"./iframe-CsWugpTQ.js";import{K as Q}from"./KanbanBoard-CJq4L30V.js";import"./preload-helper-C1FmrZbK.js";import"./core.esm-CbsZJG1k.js";import"./sortable.esm-0kiIc-66.js";import"./card-DElVqdz_.js";import"./badge-CieB6EZu.js";import"./button-hQwFhXKy.js";import"./avatar-Csdu7tz0.js";import"./index-QPA-lWnS.js";import"./dropdown-menu-DS66NQQn.js";import"./index-BMNU2nVA.js";import"./index-lk_7jC7R.js";import"./check-CREjJjm4.js";import"./chevron-right-gZLE9Dpm.js";import"./proxy-1TXl86YP.js";import"./ellipsis-CbKO68Uu.js";import"./trash-2-Afz3fUjr.js";import"./plus-GiGrk20-.js";import"./index-DDiXTfvP.js";const{fn:F}=__STORYBOOK_MODULE_TEST__,d=F(),x=[{id:"new",title:"New",color:"bg-red-500"},{id:"qualified",title:"Qualified",color:"bg-red-500"},{id:"proposition",title:"Proposition",color:"bg-red-500"},{id:"won",title:"Won",color:"bg-red-500"}],G=[{id:"n1",title:"Quote for 150 carpets",subtitle:"Product",status:"new",priority:"high",value:4e4},{id:"n2",title:"Quote for 12 Tables",subtitle:"Product",status:"new",priority:"medium",value:4e4},{id:"n3",title:"Chester Reed's opportunity",subtitle:"SOS Delhi, Chester Reed",status:"new",priority:"low",value:0},{id:"q1",title:"Global Solutions: Furnitures",subtitle:"Design",status:"qualified",priority:"high",value:3800},{id:"q2",title:"Quote for 600 Chairs",subtitle:"Product",status:"qualified",priority:"medium",value:22500},{id:"q3",title:"Info about services",subtitle:"Product",status:"qualified",priority:"medium",value:25e3},{id:"p1",title:"Modern Open Space",subtitle:"Information",status:"proposition",priority:"high",value:4500},{id:"p2",title:"Office Design and Architecture",subtitle:"Consulting",status:"proposition",priority:"medium",value:9e3},{id:"p3",title:"5 VP Chairs",subtitle:"Services",status:"proposition",priority:"low",value:560},{id:"p4",title:"Need 20 Desks",subtitle:"Consulting",status:"proposition",priority:"low",value:6e4},{id:"w1",title:"Distributor Contract",subtitle:"Information • Other",status:"won",priority:"high",value:19800}],C=[{name:"Victoria Li",avatarUrl:"https://i.pravatar.cc/150?u=victoria"},{name:"James Porter",avatarUrl:"https://i.pravatar.cc/150?u=james"},{name:"Noah Singh",avatarUrl:"https://i.pravatar.cc/150?u=noah"}];function J(e,n,u){if(e==="empty")return[];const l=G.map((s,o)=>({...s,currency:u,assignee:n?C[o%C.length]:void 0,updatedAt:new Date(2026,2,o%25+1).toISOString()}));return e==="compact"?l.filter(s=>s.status!=="proposition"||Number(s.value)>=9e3):e==="high-volume"?l.flatMap((o,m)=>[o,{...o,id:`${o.id}-hv`,title:`${o.title} #${m+1}`,value:Number(o.value||0)+(m+1)*700}]):l}function Y(e,n){return`${e.toLocaleString("en-US")}${n}`}function X(e){const n=p.useMemo(()=>e.showWonColumnOnly?x.filter(t=>t.id==="won"):x,[e.showWonColumnOnly]),u=p.useMemo(()=>J(e.visualMode,e.showAssignees,e.currencySymbol),[e.visualMode,e.showAssignees,e.currencySymbol]),[l,s]=p.useState(u);p.useEffect(()=>{s(u)},[u]);const o=p.useMemo(()=>n.reduce((t,i)=>(t[i.id]=l.filter(a=>a.status===i.id).reduce((a,c)=>a+Number(c.value||0),0),t),{}),[n,l]),m=(t,i,a)=>{if(e.freezeInteractions){d({type:"pipeline.dragBlocked",activeId:t,overId:i,newStatus:a});return}d({type:"pipeline.dragEnd",activeId:t,overId:i,newStatus:a}),s(c=>c.map(S=>S.id===t?{...S,status:a}:S))},B=async(t,i)=>{if(e.freezeInteractions){d({type:"pipeline.itemUpdateBlocked",id:t,updates:i});return}d({type:"pipeline.itemUpdate",id:t,updates:i}),s(a=>a.map(c=>c.id===t?{...c,...i}:c))},K=t=>{if(e.freezeInteractions){d({type:"pipeline.itemClickBlocked",id:t});return}d({type:"pipeline.itemClick",id:t})};return r.jsxs("div",{className:"bg-white p-4 md:p-6",style:{minHeight:`${e.boardHeight+120}px`},children:[r.jsx("div",{className:"mb-4 grid gap-3 grid-cols-2 md:grid-cols-4",children:n.map(t=>r.jsxs("div",{className:"rounded-md border border-border bg-card p-3",children:[r.jsxs("div",{className:"mb-1 flex items-center justify-between",children:[r.jsx("span",{className:"text-sm font-semibold",children:t.title}),r.jsx("span",{className:"text-sm font-semibold tabular-nums",children:Y(o[t.id]||0,e.currencySymbol)})]}),r.jsx("div",{className:"h-1 w-full rounded-full bg-red-500/80"})]},t.id))}),r.jsx("div",{className:`overflow-hidden rounded-lg border border-[#e5eaf2] bg-white p-2 ${e.freezeInteractions?"pointer-events-none":""}`,style:{height:`${e.boardHeight}px`},children:r.jsx(Q,{columns:n,items:l,onDragEnd:m,onItemUpdate:B,onItemClick:K,themeVariant:"reference"})})]})}const ye={title:"Leads/Pipeline Module",component:X,tags:["autodocs"],args:{visualMode:"reference",showWonColumnOnly:!1,showAssignees:!0,currencySymbol:" €",boardHeight:620,freezeInteractions:!1},argTypes:{visualMode:{control:"select",options:["reference","compact","high-volume","empty"],description:"Select visual density and scenario for stakeholder review."},showWonColumnOnly:{control:"boolean",description:"Focus on closed outcomes by showing only the Won stage."},showAssignees:{control:"boolean",description:"Toggle avatar rendering on cards."},currencySymbol:{control:"text",description:"Currency suffix used in stage totals and card values."},boardHeight:{control:{type:"range",min:420,max:900,step:20},description:"Board canvas height for responsive previews."},freezeInteractions:{control:"boolean",description:"Disable drag, click, and edit interactions for static review sessions."}},decorators:[e=>r.jsx("div",{className:"min-h-screen bg-background text-foreground",children:r.jsx(e,{})})],parameters:{layout:"fullscreen",viewport:{defaultViewport:"desktop"},controls:{expanded:!0,sort:"requiredFirst"},a11y:{disable:!1},docs:{description:{component:"Leads pipeline visual reference for stakeholder validation. Integration points: map lead records from `PipelineService.listLeads` into `KanbanItem`, pass stage metadata as `ColumnType[]`, persist drag transitions through `PipelineService.transitionLeadStage`, and route card selection to `/dashboard/leads/:id`."}}}},g={},h={args:{visualMode:"reference",showWonColumnOnly:!1,showAssignees:!0,currencySymbol:" €",boardHeight:620,freezeInteractions:!0},parameters:{controls:{include:["showWonColumnOnly","showAssignees","currencySymbol","boardHeight"]},docs:{description:{story:"Demo-safe view for stakeholder sign-off. Interactions are frozen while still allowing visual and responsive validation."}}}},f={args:{visualMode:"compact",boardHeight:560}},v={args:{visualMode:"high-volume",boardHeight:700}},b={args:{visualMode:"empty"}},y={args:{visualMode:"compact",showAssignees:!1,boardHeight:520},globals:{viewport:{value:"small",isRotated:!1}}},w={args:{visualMode:"reference",boardHeight:620},globals:{viewport:{value:"tablet",isRotated:!1}}};var M,I,H;g.parameters={...g.parameters,docs:{...(M=g.parameters)==null?void 0:M.docs,source:{originalSource:"{}",...(H=(I=g.parameters)==null?void 0:I.docs)==null?void 0:H.source}}};var O,k,R;h.parameters={...h.parameters,docs:{...(O=h.parameters)==null?void 0:O.docs,source:{originalSource:`{
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
}`,...(R=(k=h.parameters)==null?void 0:k.docs)==null?void 0:R.source}}};var j,N,A;f.parameters={...f.parameters,docs:{...(j=f.parameters)==null?void 0:j.docs,source:{originalSource:`{
  args: {
    visualMode: 'compact',
    boardHeight: 560
  }
}`,...(A=(N=f.parameters)==null?void 0:N.docs)==null?void 0:A.source}}};var P,D,E;v.parameters={...v.parameters,docs:{...(P=v.parameters)==null?void 0:P.docs,source:{originalSource:`{
  args: {
    visualMode: 'high-volume',
    boardHeight: 700
  }
}`,...(E=(D=v.parameters)==null?void 0:D.docs)==null?void 0:E.source}}};var z,W,T;b.parameters={...b.parameters,docs:{...(z=b.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    visualMode: 'empty'
  }
}`,...(T=(W=b.parameters)==null?void 0:W.docs)==null?void 0:T.source}}};var U,V,q;y.parameters={...y.parameters,docs:{...(U=y.parameters)==null?void 0:U.docs,source:{originalSource:`{
  args: {
    visualMode: 'compact',
    showAssignees: false,
    boardHeight: 520
  },
  globals: {
    viewport: {
      value: 'small',
      isRotated: false
    }
  }
}`,...(q=(V=y.parameters)==null?void 0:V.docs)==null?void 0:q.source}}};var L,_,$;w.parameters={...w.parameters,docs:{...(L=w.parameters)==null?void 0:L.docs,source:{originalSource:`{
  args: {
    visualMode: 'reference',
    boardHeight: 620
  },
  globals: {
    viewport: {
      value: 'tablet',
      isRotated: false
    }
  }
}`,...($=(_=w.parameters)==null?void 0:_.docs)==null?void 0:$.source}}};const we=["ScreenshotReference","StakeholderReview","CompactView","HighVolumePipeline","EmptyState","MobileReview","TabletReview"];export{f as CompactView,b as EmptyState,v as HighVolumePipeline,y as MobileReview,g as ScreenshotReference,h as StakeholderReview,w as TabletReview,we as __namedExportsOrder,ye as default};
