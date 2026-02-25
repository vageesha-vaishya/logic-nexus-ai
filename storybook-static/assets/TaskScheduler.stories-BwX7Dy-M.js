import{j as t}from"./jsx-runtime-DF2Pcvd1.js";import{T as _}from"./TaskScheduler-DrLDhqHJ.js";import{a as e}from"./mock-data-DBb6LiQI.js";import{E as f,e as D}from"./empty-state-bzU-iTlr.js";import{S as j}from"./skeleton-table-CJFt9Koo.js";import{a as E,s as p}from"./subDays-CJp_3fXz.js";import"./index-B2-qRKKC.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./button-Cpm3eO9b.js";import"./index-Bh3JKd2m.js";import"./utils-CytzSlOG.js";import"./card-DDgMyP-I.js";import"./avatar-CKOC-HN5.js";import"./index-DRfMV7qj.js";import"./index-ciuW_uyV.js";import"./index-BmZbFD_3.js";import"./index-CFX93qP1.js";import"./index-CMMd_KE_.js";import"./badge-BlxpgidI.js";import"./tabs-BcAn1uNm.js";import"./index-DW48STyt.js";import"./index-ekFeoJ-_.js";import"./index-Z75IbNXa.js";import"./index-DK19BPjP.js";import"./createLucideIcon-DapQ2WKf.js";import"./index-CGh0mKBy.js";import"./index-BVTljfQg.js";import"./scroll-area-BZ8Y1bzI.js";import"./isSameDay-C8Ze1vER.js";import"./differenceInCalendarDays-Doit9xz1.js";import"./clock-OHWEuncF.js";import"./plus-B4oY7sqh.js";import"./circle-check-CWSHkN_P.js";import"./calendar-B5drNOPx.js";import"./format-C2JJGG0e.js";import"./circle-alert--OSf2GYc.js";import"./search-BWHVy4X8.js";import"./skeleton-BeHfpXA5.js";import"./table-Cv58sP-0.js";import"./chevrons-up-down-DLg14hCS.js";const kt={title:"CRM/TaskScheduler",component:_,parameters:{layout:"centered",docs:{description:{component:"A task management component with tabs for upcoming, overdue, and completed tasks. Features priority indicators and assignment details."}}},tags:["autodocs"],argTypes:{onAddTask:{action:"add-task"},onCompleteTask:{action:"complete-task"}}},N=[{id:"t1",title:"Follow up with Acme Logistics",due_date:E(new Date,1).toISOString(),status:"pending",priority:"high",assigned_to:e[0],related_to:{type:"lead",id:"l1",name:"Acme Logistics"}},{id:"t2",title:"Prepare Q3 Proposal",due_date:new Date().toISOString(),status:"pending",priority:"medium",assigned_to:e[0],related_to:{type:"opportunity",id:"o1",name:"Global Trade Expansion"}},{id:"t3",title:"Send contract for review",due_date:p(new Date,2).toISOString(),status:"overdue",priority:"high",assigned_to:e[1],related_to:{type:"lead",id:"l3",name:"FastShip Delivery"}},{id:"t4",title:"Update contact details",due_date:p(new Date,5).toISOString(),status:"completed",priority:"low",assigned_to:e[2]}],r={args:{tasks:N,className:"w-[500px]"}},s={args:{tasks:[],className:"w-[500px]"}},a={render:()=>t.jsx("div",{className:"w-[500px] p-4",children:t.jsx(j,{count:3})})},o={render:()=>t.jsx("div",{className:"w-[500px] p-4",children:t.jsx(f,{...D.error("Unable to load tasks")})})},i={render:()=>t.jsx("div",{dir:"rtl",className:"w-[500px]",children:t.jsx(_,{tasks:N})})};var m,d,n;r.parameters={...r.parameters,docs:{...(m=r.parameters)==null?void 0:m.docs,source:{originalSource:`{
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
}`,...(v=(h=i.parameters)==null?void 0:h.docs)==null?void 0:v.source}}};const St=["Default","NoTasks","Loading","Error","RTL"];export{r as Default,o as Error,a as Loading,s as NoTasks,i as RTL,St as __namedExportsOrder,kt as default};
