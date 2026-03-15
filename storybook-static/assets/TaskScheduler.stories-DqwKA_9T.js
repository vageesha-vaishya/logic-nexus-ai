import{j as t}from"./jsx-runtime-Z5uAzocK.js";import{T as _}from"./TaskScheduler-C2uTpR1O.js";import{a as r}from"./mock-data-i6hjpj77.js";import{E as N,e as D}from"./empty-state-BkTwSWnX.js";import{S as j}from"./skeleton-table-B7UYLiTh.js";import{a as E}from"./addDays-B7SrYi78.js";import{s as p}from"./subDays-CUZy8QfG.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./button-SB7iZ1uz.js";import"./index-CyLt0tHj.js";import"./utils-mOyDzkE6.js";import"./card-BRH59LJj.js";import"./avatar-CzFMJ_Ps.js";import"./index-CuDmVINA.js";import"./index-DSMx10ar.js";import"./index-BzXjCyLi.js";import"./index-DLHbBEj9.js";import"./index-C_BnrBF9.js";import"./badge-BazqNHwJ.js";import"./tabs-CIODxbyA.js";import"./index-DW48STyt.js";import"./index-1nVOT-6P.js";import"./index-WQoRFki_.js";import"./index-CiCgAmAg.js";import"./index-DLuVoU5X.js";import"./index-7TLWIpSA.js";import"./index-Bk-1lDEB.js";import"./scroll-area-CNxhw6Ms.js";import"./constants-DrTc0T0L.js";import"./constructNow-cn4LJ2Qw.js";import"./isSameDay-Cllw39J9.js";import"./differenceInCalendarDays-DBTEEzZ7.js";import"./getTimezoneOffsetInMilliseconds-DY_9x7Xo.js";import"./clock-Dw9zB7tS.js";import"./createLucideIcon-DEP7aKU9.js";import"./plus-BkGVcHzy.js";import"./circle-check-De-Q-auN.js";import"./calendar-y9rfTC-H.js";import"./format-DS4ckFgI.js";import"./en-US-ClfMaaVW.js";import"./circle-alert-CpVRAWZS.js";import"./search-C-UEa-iZ.js";import"./skeleton-JqcMxz8I.js";import"./table-B7y9fgOD.js";import"./chevron-up-BYJQeOkQ.js";import"./chevron-down-D-nzWkjq.js";import"./chevrons-up-down-ChP24vm-.js";const _t={title:"CRM/TaskScheduler",component:_,parameters:{layout:"centered",docs:{description:{component:"A task management component with tabs for upcoming, overdue, and completed tasks. Features priority indicators and assignment details."}}},tags:["autodocs"],argTypes:{onAddTask:{action:"add-task"},onCompleteTask:{action:"complete-task"}}},f=[{id:"t1",title:"Follow up with Acme Logistics",due_date:E(new Date,1).toISOString(),status:"pending",priority:"high",assigned_to:r[0],related_to:{type:"lead",id:"l1",name:"Acme Logistics"}},{id:"t2",title:"Prepare Q3 Proposal",due_date:new Date().toISOString(),status:"pending",priority:"medium",assigned_to:r[0],related_to:{type:"opportunity",id:"o1",name:"Global Trade Expansion"}},{id:"t3",title:"Send contract for review",due_date:p(new Date,2).toISOString(),status:"overdue",priority:"high",assigned_to:r[1],related_to:{type:"lead",id:"l3",name:"FastShip Delivery"}},{id:"t4",title:"Update contact details",due_date:p(new Date,5).toISOString(),status:"completed",priority:"low",assigned_to:r[2]}],e={args:{tasks:f,className:"w-[500px]"}},s={args:{tasks:[],className:"w-[500px]"}},o={render:()=>t.jsx("div",{className:"w-[500px] p-4",children:t.jsx(j,{count:3})})},a={render:()=>t.jsx("div",{className:"w-[500px] p-4",children:t.jsx(N,{...D.error("Unable to load tasks")})})},i={render:()=>t.jsx("div",{dir:"rtl",className:"w-[500px]",children:t.jsx(_,{tasks:f})})};var m,d,n;e.parameters={...e.parameters,docs:{...(m=e.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    tasks: mockTasks,
    className: 'w-[500px]'
  }
}`,...(n=(d=e.parameters)==null?void 0:d.docs)==null?void 0:n.source}}};var c,l,u;s.parameters={...s.parameters,docs:{...(c=s.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    tasks: [],
    className: 'w-[500px]'
  }
}`,...(u=(l=s.parameters)==null?void 0:l.docs)==null?void 0:u.source}}};var g,k,S;o.parameters={...o.parameters,docs:{...(g=o.parameters)==null?void 0:g.docs,source:{originalSource:`{
  render: () => <div className="w-[500px] p-4">
      <SkeletonCards count={3} />
    </div>
}`,...(S=(k=o.parameters)==null?void 0:k.docs)==null?void 0:S.source}}};var x,w,y;a.parameters={...a.parameters,docs:{...(x=a.parameters)==null?void 0:x.docs,source:{originalSource:`{
  render: () => <div className="w-[500px] p-4">
      <EmptyState {...emptyStates.error('Unable to load tasks')} />
    </div>
}`,...(y=(w=a.parameters)==null?void 0:w.docs)==null?void 0:y.source}}};var T,h,v;i.parameters={...i.parameters,docs:{...(T=i.parameters)==null?void 0:T.docs,source:{originalSource:`{
  render: () => <div dir="rtl" className="w-[500px]">
      <TaskScheduler tasks={mockTasks} />
    </div>
}`,...(v=(h=i.parameters)==null?void 0:h.docs)==null?void 0:v.source}}};const ft=["Default","NoTasks","Loading","Error","RTL"];export{e as Default,a as Error,o as Loading,s as NoTasks,i as RTL,ft as __namedExportsOrder,_t as default};
