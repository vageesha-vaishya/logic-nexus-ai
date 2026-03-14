import{j as t}from"./jsx-runtime-Z5uAzocK.js";import{T as _}from"./TaskScheduler-BBUXs8Rr.js";import{a as e}from"./mock-data-DBb6LiQI.js";import{E as f,e as D}from"./empty-state-1wPSDg_7.js";import{S as j}from"./skeleton-table-Dt9lzMpM.js";import{a as E,s as p}from"./subDays-CJp_3fXz.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./button-_friVzh6.js";import"./index-DXxPFvzQ.js";import"./utils-CytzSlOG.js";import"./card-DV47ztDp.js";import"./avatar-DiAhuSY3.js";import"./index-CuDmVINA.js";import"./index-DSMx10ar.js";import"./index-B1bLLDhJ.js";import"./index-DLHbBEj9.js";import"./index-C_BnrBF9.js";import"./badge-vqX98KDz.js";import"./tabs-DngPvJWg.js";import"./index-DW48STyt.js";import"./index-Cetd40Y1.js";import"./index-DHumPsSE.js";import"./index-CiCgAmAg.js";import"./index-DLuVoU5X.js";import"./index-7TLWIpSA.js";import"./index-DWAuYXNV.js";import"./scroll-area-DLGkcbDQ.js";import"./isSameDay-C8Ze1vER.js";import"./differenceInCalendarDays-Doit9xz1.js";import"./clock-Dw9zB7tS.js";import"./createLucideIcon-DEP7aKU9.js";import"./plus-BkGVcHzy.js";import"./circle-check-De-Q-auN.js";import"./calendar-y9rfTC-H.js";import"./format-C2JJGG0e.js";import"./circle-alert-CpVRAWZS.js";import"./search-C-UEa-iZ.js";import"./skeleton-DO16Kgig.js";import"./table-DzrnUcP1.js";import"./chevron-up-DGrNAj5y.js";import"./chevrons-up-down-ChP24vm-.js";const xt={title:"CRM/TaskScheduler",component:_,parameters:{layout:"centered",docs:{description:{component:"A task management component with tabs for upcoming, overdue, and completed tasks. Features priority indicators and assignment details."}}},tags:["autodocs"],argTypes:{onAddTask:{action:"add-task"},onCompleteTask:{action:"complete-task"}}},N=[{id:"t1",title:"Follow up with Acme Logistics",due_date:E(new Date,1).toISOString(),status:"pending",priority:"high",assigned_to:e[0],related_to:{type:"lead",id:"l1",name:"Acme Logistics"}},{id:"t2",title:"Prepare Q3 Proposal",due_date:new Date().toISOString(),status:"pending",priority:"medium",assigned_to:e[0],related_to:{type:"opportunity",id:"o1",name:"Global Trade Expansion"}},{id:"t3",title:"Send contract for review",due_date:p(new Date,2).toISOString(),status:"overdue",priority:"high",assigned_to:e[1],related_to:{type:"lead",id:"l3",name:"FastShip Delivery"}},{id:"t4",title:"Update contact details",due_date:p(new Date,5).toISOString(),status:"completed",priority:"low",assigned_to:e[2]}],r={args:{tasks:N,className:"w-[500px]"}},s={args:{tasks:[],className:"w-[500px]"}},a={render:()=>t.jsx("div",{className:"w-[500px] p-4",children:t.jsx(j,{count:3})})},o={render:()=>t.jsx("div",{className:"w-[500px] p-4",children:t.jsx(f,{...D.error("Unable to load tasks")})})},i={render:()=>t.jsx("div",{dir:"rtl",className:"w-[500px]",children:t.jsx(_,{tasks:N})})};var m,d,n;r.parameters={...r.parameters,docs:{...(m=r.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    tasks: mockTasks,
    className: 'w-[500px]'
  }
}`,...(n=(d=r.parameters)==null?void 0:d.docs)==null?void 0:n.source}}};var c,l,u;s.parameters={...s.parameters,docs:{...(c=s.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    tasks: [],
    className: 'w-[500px]'
  }
}`,...(u=(l=s.parameters)==null?void 0:l.docs)==null?void 0:u.source}}};var g,k,S;a.parameters={...a.parameters,docs:{...(g=a.parameters)==null?void 0:g.docs,source:{originalSource:`{
  render: () => <div className="w-[500px] p-4">
      <SkeletonCards count={3} />
    </div>
}`,...(S=(k=a.parameters)==null?void 0:k.docs)==null?void 0:S.source}}};var x,w,y;o.parameters={...o.parameters,docs:{...(x=o.parameters)==null?void 0:x.docs,source:{originalSource:`{
  render: () => <div className="w-[500px] p-4">
      <EmptyState {...emptyStates.error('Unable to load tasks')} />
    </div>
}`,...(y=(w=o.parameters)==null?void 0:w.docs)==null?void 0:y.source}}};var T,h,v;i.parameters={...i.parameters,docs:{...(T=i.parameters)==null?void 0:T.docs,source:{originalSource:`{
  render: () => <div dir="rtl" className="w-[500px]">
      <TaskScheduler tasks={mockTasks} />
    </div>
}`,...(v=(h=i.parameters)==null?void 0:h.docs)==null?void 0:v.source}}};const wt=["Default","NoTasks","Loading","Error","RTL"];export{r as Default,o as Error,a as Loading,s as NoTasks,i as RTL,wt as __namedExportsOrder,xt as default};
