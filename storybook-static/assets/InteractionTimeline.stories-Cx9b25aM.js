import{j as e}from"./jsx-runtime-Z5uAzocK.js";import{A as _,a as F,b as O}from"./avatar-CzFMJ_Ps.js";import{B as d}from"./button-SB7iZ1uz.js";import{C as P,a as W,b as L,d as q}from"./card-BRH59LJj.js";import{D as z,a as R,b as B,c as p}from"./dropdown-menu-BPiw1Z8x.js";import{S as H}from"./scroll-area-CNxhw6Ms.js";import{P as Q}from"./plus-BkGVcHzy.js";import{E as V}from"./ellipsis-vertical-BHGv0CYw.js";import{M as $}from"./message-square-BA2hELBN.js";import{C as G}from"./circle-check-De-Q-auN.js";import{F as J}from"./file-text-BpOUT4Fo.js";import{C as K}from"./calendar-y9rfTC-H.js";import{M as U}from"./mail-Ceh6d5_X.js";import{P as X}from"./phone-C2f6q_dt.js";import{f as Y}from"./format-DS4ckFgI.js";import{b as Z}from"./mock-data-i6hjpj77.js";import{S as ee}from"./skeleton-table-B7UYLiTh.js";import{A as te,a as re,b as se}from"./alert-DORxEos_.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./index-CuDmVINA.js";import"./index-DSMx10ar.js";import"./index-BzXjCyLi.js";import"./index-DLHbBEj9.js";import"./index-CyLt0tHj.js";import"./utils-mOyDzkE6.js";import"./index-C_BnrBF9.js";import"./index-DW48STyt.js";import"./index-DLuVoU5X.js";import"./index-WQoRFki_.js";import"./index-7TLWIpSA.js";import"./index-DyZtt5qy.js";import"./index-CiCgAmAg.js";import"./index-DvPxE0jW.js";import"./index-CTbEET-J.js";import"./index-Bk-1lDEB.js";import"./index-1nVOT-6P.js";import"./chevron-right-C_5x1iad.js";import"./createLucideIcon-DEP7aKU9.js";import"./check--MVdLoPp.js";import"./en-US-ClfMaaVW.js";import"./differenceInCalendarDays-DBTEEzZ7.js";import"./constants-DrTc0T0L.js";import"./getTimezoneOffsetInMilliseconds-DY_9x7Xo.js";import"./addDays-B7SrYi78.js";import"./subDays-CUZy8QfG.js";import"./skeleton-JqcMxz8I.js";import"./table-B7y9fgOD.js";import"./chevron-up-BYJQeOkQ.js";import"./chevron-down-D-nzWkjq.js";import"./chevrons-up-down-ChP24vm-.js";const ae=t=>{switch(t){case"call":return e.jsx(X,{className:"h-4 w-4"});case"email":return e.jsx(U,{className:"h-4 w-4"});case"meeting":return e.jsx(K,{className:"h-4 w-4"});case"note":return e.jsx(J,{className:"h-4 w-4"});case"status_change":return e.jsx(G,{className:"h-4 w-4"});default:return e.jsx($,{className:"h-4 w-4"})}},ie=t=>{switch(t){case"call":return"bg-blue-100 text-blue-600";case"email":return"bg-yellow-100 text-yellow-600";case"meeting":return"bg-purple-100 text-purple-600";case"note":return"bg-gray-100 text-gray-600";case"status_change":return"bg-green-100 text-green-600";default:return"bg-slate-100 text-slate-600"}};function l({activities:t,onAddActivity:k,className:E}){return e.jsxs(P,{className:E,children:[e.jsxs(W,{className:"flex flex-row items-center justify-between pb-4 space-y-0",children:[e.jsx(L,{className:"text-base font-semibold",children:"Interaction History"}),e.jsxs(d,{size:"sm",onClick:k,children:[e.jsx(Q,{className:"h-4 w-4 mr-2"}),"Log Activity"]})]}),e.jsx(q,{children:e.jsx(H,{className:"h-[400px] pr-4",children:e.jsx("div",{className:"relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent",children:t.map(r=>e.jsxs("div",{className:"relative flex items-start group",children:[e.jsx("div",{className:`absolute left-0 flex items-center justify-center w-10 h-10 rounded-full ring-8 ring-white ${ie(r.type)}`,children:ae(r.type)}),e.jsxs("div",{className:"ml-16 w-full",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between mb-1",children:[e.jsx("span",{className:"text-sm font-semibold text-slate-900",children:r.title}),e.jsx("time",{className:"text-xs text-slate-500 whitespace-nowrap",children:Y(new Date(r.date),"MMM d, yyyy h:mm a")})]}),e.jsxs("div",{className:"bg-slate-50 rounded-lg p-3 border border-slate-100 group-hover:border-slate-200 transition-colors",children:[e.jsx("p",{className:"text-sm text-slate-600 mb-2",children:r.description}),e.jsxs("div",{className:"flex items-center justify-between mt-3",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(_,{className:"h-5 w-5",children:[e.jsx(F,{src:r.user.avatar}),e.jsx(O,{children:r.user.name[0]})]}),e.jsx("span",{className:"text-xs text-slate-500",children:r.user.name})]}),r.outcome&&e.jsx("span",{className:"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600",children:r.outcome})]})]})]}),e.jsx("div",{className:"absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity",children:e.jsxs(z,{children:[e.jsx(R,{asChild:!0,children:e.jsx(d,{variant:"ghost",size:"icon",className:"h-8 w-8","aria-label":"Open menu",children:e.jsx(V,{className:"h-4 w-4"})})}),e.jsxs(B,{align:"end",children:[e.jsx(p,{children:"Edit Details"}),e.jsx(p,{children:"Delete Activity"})]})]})})]},r.id))})})})]})}l.__docgenInfo={description:"",methods:[],displayName:"InteractionTimeline",props:{activities:{required:!0,tsType:{name:"Array",elements:[{name:"Activity"}],raw:"Activity[]"},description:""},onAddActivity:{required:!1,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},className:{required:!1,tsType:{name:"string"},description:""}}};const st={title:"CRM/InteractionTimeline",component:l,parameters:{layout:"centered",docs:{description:{component:"A vertical timeline component for tracking interactions (calls, emails, meetings) with leads and customers. Features collapsible details, activity types, and user attribution."}}},tags:["autodocs"],argTypes:{onAddActivity:{action:"add-activity"}}},m=Z.map(t=>({...t,type:t.type})),s={args:{activities:m,className:"w-[600px]"}},a={args:{activities:[],className:"w-[600px]"}},i={args:{activities:[...m,{id:"a4",type:"status_change",title:"Stage Changed",description:'Moved from "New" to "Qualification"',date:new Date().toISOString(),user:{name:"System"},outcome:"promoted"},{id:"a5",type:"note",title:"Internal Note",description:"Client mentioned they are evaluating 2 other competitors. Need to emphasize our global coverage.",date:new Date().toISOString(),user:{name:"Sarah Wilson",avatar:"https://i.pravatar.cc/150?u=u1"}}],className:"w-[600px]"}},o={render:t=>e.jsx("div",{className:"w-[600px]",children:e.jsx(ee,{count:3})})},n={render:t=>e.jsx("div",{className:"w-[600px]",children:e.jsxs(te,{variant:"destructive",children:[e.jsx(re,{children:"Failed to load activities"}),e.jsx(se,{children:"We encountered an error fetching interaction history. Please retry."})]})})},c={render:t=>e.jsx("div",{dir:"rtl",className:"w-[600px]",children:e.jsx(l,{...t,activities:m})})};var u,x,h;s.parameters={...s.parameters,docs:{...(u=s.parameters)==null?void 0:u.docs,source:{originalSource:`{
  args: {
    activities: typedMockActivities,
    className: 'w-[600px]'
  }
}`,...(h=(x=s.parameters)==null?void 0:x.docs)==null?void 0:h.source}}};var g,f,v;a.parameters={...a.parameters,docs:{...(g=a.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    activities: [],
    className: 'w-[600px]'
  }
}`,...(v=(f=a.parameters)==null?void 0:f.docs)==null?void 0:v.source}}};var w,y,j;i.parameters={...i.parameters,docs:{...(w=i.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    activities: [...typedMockActivities, {
      id: 'a4',
      type: 'status_change',
      title: 'Stage Changed',
      description: 'Moved from "New" to "Qualification"',
      date: new Date().toISOString(),
      user: {
        name: 'System'
      },
      outcome: 'promoted'
    }, {
      id: 'a5',
      type: 'note',
      title: 'Internal Note',
      description: 'Client mentioned they are evaluating 2 other competitors. Need to emphasize our global coverage.',
      date: new Date().toISOString(),
      user: {
        name: 'Sarah Wilson',
        avatar: 'https://i.pravatar.cc/150?u=u1'
      }
    }],
    className: 'w-[600px]'
  }
}`,...(j=(y=i.parameters)==null?void 0:y.docs)==null?void 0:j.source}}};var b,N,A;o.parameters={...o.parameters,docs:{...(b=o.parameters)==null?void 0:b.docs,source:{originalSource:`{
  render: args => <div className="w-[600px]">
      <SkeletonCards count={3} />
    </div>
}`,...(A=(N=o.parameters)==null?void 0:N.docs)==null?void 0:A.source}}};var S,C,M;n.parameters={...n.parameters,docs:{...(S=n.parameters)==null?void 0:S.docs,source:{originalSource:`{
  render: args => <div className="w-[600px]">
      <Alert variant="destructive">
        <AlertTitle>Failed to load activities</AlertTitle>
        <AlertDescription>We encountered an error fetching interaction history. Please retry.</AlertDescription>
      </Alert>
    </div>
}`,...(M=(C=n.parameters)==null?void 0:C.docs)==null?void 0:M.source}}};var T,D,I;c.parameters={...c.parameters,docs:{...(T=c.parameters)==null?void 0:T.docs,source:{originalSource:`{
  render: args => <div dir="rtl" className="w-[600px]">
      <InteractionTimeline {...args} activities={typedMockActivities} />
    </div>
}`,...(I=(D=c.parameters)==null?void 0:D.docs)==null?void 0:I.source}}};const at=["Default","Empty","WithMixedTypes","Loading","Error","RTL"];export{s as Default,a as Empty,n as Error,o as Loading,c as RTL,i as WithMixedTypes,at as __namedExportsOrder,st as default};
