import{j as e}from"./jsx-runtime-DF2Pcvd1.js";import{A as O,a as P,b as W}from"./avatar-CKOC-HN5.js";import{B as v}from"./button-Cpm3eO9b.js";import{C as q,a as V,b as H,d as B}from"./card-DDgMyP-I.js";import{D as Q,a as $,E as G,b as J,c as y}from"./dropdown-menu-BzCYYBU3.js";import{S as K}from"./scroll-area-BZ8Y1bzI.js";import{P as U}from"./plus-B4oY7sqh.js";import{c as X}from"./createLucideIcon-DapQ2WKf.js";import{C as Y}from"./circle-check-CWSHkN_P.js";import{F as Z}from"./file-text-DWtP77Hy.js";import{C as ee}from"./calendar-B5drNOPx.js";import{M as te}from"./mail-CKCv9G4h.js";import{P as re}from"./phone-sJuwEHFR.js";import{f as se}from"./format-C2JJGG0e.js";import{b as ae}from"./mock-data-DBb6LiQI.js";import{S as ie}from"./skeleton-table-CJFt9Koo.js";import{r as m}from"./index-B2-qRKKC.js";import{c as oe}from"./index-Bh3JKd2m.js";import{c as p}from"./utils-CytzSlOG.js";import"./index-DRfMV7qj.js";import"./index-ciuW_uyV.js";import"./index-BmZbFD_3.js";import"./index-CFX93qP1.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./index-CMMd_KE_.js";import"./index-DW48STyt.js";import"./index-DK19BPjP.js";import"./index-Z75IbNXa.js";import"./index-CGh0mKBy.js";import"./Combination-uNsERWH7.js";import"./index-Bz0SC8DB.js";import"./index-BVTljfQg.js";import"./index-ekFeoJ-_.js";import"./chevron-right-Bf89TUQQ.js";import"./differenceInCalendarDays-Doit9xz1.js";import"./subDays-CJp_3fXz.js";import"./skeleton-BeHfpXA5.js";import"./table-Cv58sP-0.js";import"./chevrons-up-down-DLg14hCS.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ne=X("MessageSquare",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}]]),ce=t=>{switch(t){case"call":return e.jsx(re,{className:"h-4 w-4"});case"email":return e.jsx(te,{className:"h-4 w-4"});case"meeting":return e.jsx(ee,{className:"h-4 w-4"});case"note":return e.jsx(Z,{className:"h-4 w-4"});case"status_change":return e.jsx(Y,{className:"h-4 w-4"});default:return e.jsx(ne,{className:"h-4 w-4"})}},le=t=>{switch(t){case"call":return"bg-blue-100 text-blue-600";case"email":return"bg-yellow-100 text-yellow-600";case"meeting":return"bg-purple-100 text-purple-600";case"note":return"bg-gray-100 text-gray-600";case"status_change":return"bg-green-100 text-green-600";default:return"bg-slate-100 text-slate-600"}};function u({activities:t,onAddActivity:s,className:a}){return e.jsxs(q,{className:a,children:[e.jsxs(V,{className:"flex flex-row items-center justify-between pb-4 space-y-0",children:[e.jsx(H,{className:"text-base font-semibold",children:"Interaction History"}),e.jsxs(v,{size:"sm",onClick:s,children:[e.jsx(U,{className:"h-4 w-4 mr-2"}),"Log Activity"]})]}),e.jsx(B,{children:e.jsx(K,{className:"h-[400px] pr-4",children:e.jsx("div",{className:"relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent",children:t.map(r=>e.jsxs("div",{className:"relative flex items-start group",children:[e.jsx("div",{className:`absolute left-0 flex items-center justify-center w-10 h-10 rounded-full ring-8 ring-white ${le(r.type)}`,children:ce(r.type)}),e.jsxs("div",{className:"ml-16 w-full",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between mb-1",children:[e.jsx("span",{className:"text-sm font-semibold text-slate-900",children:r.title}),e.jsx("time",{className:"text-xs text-slate-500 whitespace-nowrap",children:se(new Date(r.date),"MMM d, yyyy h:mm a")})]}),e.jsxs("div",{className:"bg-slate-50 rounded-lg p-3 border border-slate-100 group-hover:border-slate-200 transition-colors",children:[e.jsx("p",{className:"text-sm text-slate-600 mb-2",children:r.description}),e.jsxs("div",{className:"flex items-center justify-between mt-3",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(O,{className:"h-5 w-5",children:[e.jsx(P,{src:r.user.avatar}),e.jsx(W,{children:r.user.name[0]})]}),e.jsx("span",{className:"text-xs text-slate-500",children:r.user.name})]}),r.outcome&&e.jsx("span",{className:"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600",children:r.outcome})]})]})]}),e.jsx("div",{className:"absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity",children:e.jsxs(Q,{children:[e.jsx($,{asChild:!0,children:e.jsx(v,{variant:"ghost",size:"icon",className:"h-8 w-8","aria-label":"Open menu",children:e.jsx(G,{className:"h-4 w-4"})})}),e.jsxs(J,{align:"end",children:[e.jsx(y,{children:"Edit Details"}),e.jsx(y,{children:"Delete Activity"})]})]})})]},r.id))})})})]})}u.__docgenInfo={description:"",methods:[],displayName:"InteractionTimeline",props:{activities:{required:!0,tsType:{name:"Array",elements:[{name:"Activity"}],raw:"Activity[]"},description:""},onAddActivity:{required:!1,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},className:{required:!1,tsType:{name:"string"},description:""}}};const de=oe("relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",{variants:{variant:{default:"bg-background text-foreground",destructive:"border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive"}},defaultVariants:{variant:"default"}}),x=m.forwardRef(({className:t,variant:s,...a},r)=>e.jsx("div",{ref:r,role:"alert",className:p(de({variant:s}),t),...a}));x.displayName="Alert";const g=m.forwardRef(({className:t,...s},a)=>e.jsx("h5",{ref:a,className:p("mb-1 font-medium leading-none tracking-tight",t),...s}));g.displayName="AlertTitle";const h=m.forwardRef(({className:t,...s},a)=>e.jsx("div",{ref:a,className:p("text-sm [&_p]:leading-relaxed",t),...s}));h.displayName="AlertDescription";x.__docgenInfo={description:"",methods:[],displayName:"Alert"};g.__docgenInfo={description:"",methods:[],displayName:"AlertTitle"};h.__docgenInfo={description:"",methods:[],displayName:"AlertDescription"};const Ue={title:"CRM/InteractionTimeline",component:u,parameters:{layout:"centered",docs:{description:{component:"A vertical timeline component for tracking interactions (calls, emails, meetings) with leads and customers. Features collapsible details, activity types, and user attribution."}}},tags:["autodocs"],argTypes:{onAddActivity:{action:"add-activity"}}},f=ae.map(t=>({...t,type:t.type})),i={args:{activities:f,className:"w-[600px]"}},o={args:{activities:[],className:"w-[600px]"}},n={args:{activities:[...f,{id:"a4",type:"status_change",title:"Stage Changed",description:'Moved from "New" to "Qualification"',date:new Date().toISOString(),user:{name:"System"},outcome:"promoted"},{id:"a5",type:"note",title:"Internal Note",description:"Client mentioned they are evaluating 2 other competitors. Need to emphasize our global coverage.",date:new Date().toISOString(),user:{name:"Sarah Wilson",avatar:"https://i.pravatar.cc/150?u=u1"}}],className:"w-[600px]"}},c={render:t=>e.jsx("div",{className:"w-[600px]",children:e.jsx(ie,{count:3})})},l={render:t=>e.jsx("div",{className:"w-[600px]",children:e.jsxs(x,{variant:"destructive",children:[e.jsx(g,{children:"Failed to load activities"}),e.jsx(h,{children:"We encountered an error fetching interaction history. Please retry."})]})})},d={render:t=>e.jsx("div",{dir:"rtl",className:"w-[600px]",children:e.jsx(u,{...t,activities:f})})};var b,w,N;i.parameters={...i.parameters,docs:{...(b=i.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    activities: typedMockActivities,
    className: 'w-[600px]'
  }
}`,...(N=(w=i.parameters)==null?void 0:w.docs)==null?void 0:N.source}}};var j,A,S;o.parameters={...o.parameters,docs:{...(j=o.parameters)==null?void 0:j.docs,source:{originalSource:`{
  args: {
    activities: [],
    className: 'w-[600px]'
  }
}`,...(S=(A=o.parameters)==null?void 0:A.docs)==null?void 0:S.source}}};var C,M,T;n.parameters={...n.parameters,docs:{...(C=n.parameters)==null?void 0:C.docs,source:{originalSource:`{
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
}`,...(T=(M=n.parameters)==null?void 0:M.docs)==null?void 0:T.source}}};var D,I,k;c.parameters={...c.parameters,docs:{...(D=c.parameters)==null?void 0:D.docs,source:{originalSource:`{
  render: args => <div className="w-[600px]">
      <SkeletonCards count={3} />
    </div>
}`,...(k=(I=c.parameters)==null?void 0:I.docs)==null?void 0:k.source}}};var _,E,R;l.parameters={...l.parameters,docs:{...(_=l.parameters)==null?void 0:_.docs,source:{originalSource:`{
  render: args => <div className="w-[600px]">
      <Alert variant="destructive">
        <AlertTitle>Failed to load activities</AlertTitle>
        <AlertDescription>We encountered an error fetching interaction history. Please retry.</AlertDescription>
      </Alert>
    </div>
}`,...(R=(E=l.parameters)==null?void 0:E.docs)==null?void 0:R.source}}};var z,F,L;d.parameters={...d.parameters,docs:{...(z=d.parameters)==null?void 0:z.docs,source:{originalSource:`{
  render: args => <div dir="rtl" className="w-[600px]">
      <InteractionTimeline {...args} activities={typedMockActivities} />
    </div>
}`,...(L=(F=d.parameters)==null?void 0:F.docs)==null?void 0:L.source}}};const Xe=["Default","Empty","WithMixedTypes","Loading","Error","RTL"];export{i as Default,o as Empty,l as Error,c as Loading,d as RTL,n as WithMixedTypes,Xe as __namedExportsOrder,Ue as default};
