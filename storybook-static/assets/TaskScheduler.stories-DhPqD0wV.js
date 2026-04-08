import{j as e}from"./iframe-CsWugpTQ.js";import{T as _}from"./TaskScheduler-BYujIsi1.js";import{b as t}from"./mock-data-DrjS_GOJ.js";import{E as N,e as D}from"./empty-state-DAxTEE4w.js";import{a as j}from"./skeleton-table-BmcC6f3N.js";import{a as E}from"./addDays-D4f_g46w.js";import{s as p}from"./subDays-CwQESoEO.js";import"./preload-helper-C1FmrZbK.js";import"./button-hQwFhXKy.js";import"./card-DElVqdz_.js";import"./avatar-Csdu7tz0.js";import"./index-QPA-lWnS.js";import"./badge-CieB6EZu.js";import"./tabs-ftHSrWj8.js";import"./index-lk_7jC7R.js";import"./index-BMNU2nVA.js";import"./scroll-area-Kvq7oySz.js";import"./index-BdQq_4o_.js";import"./constants-bFRL9H8z.js";import"./constructNow-BiE0R8Ui.js";import"./isSameDay-KQeiiOkx.js";import"./differenceInCalendarDays-DMvB39OA.js";import"./clock-BSz9FQKJ.js";import"./plus-GiGrk20-.js";import"./circle-check-CH6On4E-.js";import"./calendar-DYeQ2xKn.js";import"./format-DKwulfn1.js";import"./circle-alert-C3SUhW_I.js";import"./search-BUAN7JnB.js";import"./table-CwdJlCEK.js";import"./chevron-up-Bu-ihN1g.js";import"./chevron-down-KegWGprN.js";import"./chevrons-up-down-CYGPMSC2.js";const me={title:"CRM/TaskScheduler",component:_,parameters:{layout:"centered",docs:{description:{component:"A task management component with tabs for upcoming, overdue, and completed tasks. Features priority indicators and assignment details."}}},tags:["autodocs"],argTypes:{onAddTask:{action:"add-task"},onCompleteTask:{action:"complete-task"}}},f=[{id:"t1",title:"Follow up with Acme Logistics",due_date:E(new Date,1).toISOString(),status:"pending",priority:"high",assigned_to:t[0],related_to:{type:"lead",id:"l1",name:"Acme Logistics"}},{id:"t2",title:"Prepare Q3 Proposal",due_date:new Date().toISOString(),status:"pending",priority:"medium",assigned_to:t[0],related_to:{type:"opportunity",id:"o1",name:"Global Trade Expansion"}},{id:"t3",title:"Send contract for review",due_date:p(new Date,2).toISOString(),status:"overdue",priority:"high",assigned_to:t[1],related_to:{type:"lead",id:"l3",name:"FastShip Delivery"}},{id:"t4",title:"Update contact details",due_date:p(new Date,5).toISOString(),status:"completed",priority:"low",assigned_to:t[2]}],r={args:{tasks:f,className:"w-[500px]"}},s={args:{tasks:[],className:"w-[500px]"}},a={render:()=>e.jsx("div",{className:"w-[500px] p-4",children:e.jsx(j,{count:3})})},o={render:()=>e.jsx("div",{className:"w-[500px] p-4",children:e.jsx(N,{...D.error("Unable to load tasks")})})},i={render:()=>e.jsx("div",{dir:"rtl",className:"w-[500px]",children:e.jsx(_,{tasks:f})})};var m,d,n;r.parameters={...r.parameters,docs:{...(m=r.parameters)==null?void 0:m.docs,source:{originalSource:`{
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
}`,...(v=(h=i.parameters)==null?void 0:h.docs)==null?void 0:v.source}}};const de=["Default","NoTasks","Loading","Error","RTL"];export{r as Default,o as Error,a as Loading,s as NoTasks,i as RTL,de as __namedExportsOrder,me as default};
