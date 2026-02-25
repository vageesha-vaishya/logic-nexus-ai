import{j as e}from"./jsx-runtime-DF2Pcvd1.js";import{C as b}from"./CustomerSegmentation-D8yaBKc2.js";import{S as N}from"./skeleton-table-CJFt9Koo.js";import{E as f,e as z}from"./empty-state-bzU-iTlr.js";import"./index-B2-qRKKC.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-DDgMyP-I.js";import"./utils-CytzSlOG.js";import"./select-CbrB-pmO.js";import"./index-CFX93qP1.js";import"./index-CGh0mKBy.js";import"./index-DW48STyt.js";import"./index-Z75IbNXa.js";import"./index-DRfMV7qj.js";import"./index-Bh3JKd2m.js";import"./Combination-uNsERWH7.js";import"./index-BmZbFD_3.js";import"./index-ciuW_uyV.js";import"./index-Bz0SC8DB.js";import"./createLucideIcon-DapQ2WKf.js";import"./index-DK19BPjP.js";import"./index-_AbP6Uzr.js";import"./tabs-BcAn1uNm.js";import"./index-ekFeoJ-_.js";import"./index-BVTljfQg.js";import"./badge-BlxpgidI.js";import"./scroll-area-BZ8Y1bzI.js";import"./PieChart-Z7NiK8FN.js";import"./tiny-invariant-CopsF_GD.js";import"./skeleton-BeHfpXA5.js";import"./table-Cv58sP-0.js";import"./chevrons-up-down-DLg14hCS.js";import"./button-Cpm3eO9b.js";import"./circle-alert--OSf2GYc.js";import"./search-BWHVy4X8.js";import"./plus-B4oY7sqh.js";const pe={title:"CRM/CustomerSegmentation",component:b,parameters:{layout:"padded",docs:{description:{component:"Customer segmentation visualization with multiple criteria (demographic, behavioral, geographic), distribution charts, and breakdown analysis."}}},tags:["autodocs"]},E=[{id:"s1",name:"Enterprise Ops",size:420,color:"#3b82f6",demographic:{industry:"Logistics",title:"Ops",company_size:"1000+"},behavioral:{email_opens:230,site_visits:510},geographic:{region:"NA",country:"US"}},{id:"s2",name:"Growth Startups",size:280,color:"#10b981",demographic:{industry:"E-commerce",title:"Founder",company_size:"1-50"},behavioral:{email_opens:180,site_visits:240},geographic:{region:"EU",country:"DE"}},{id:"s3",name:"Government",size:120,color:"#f59e0b",demographic:{industry:"Gov",title:"Procurement",company_size:"2000+"},behavioral:{email_opens:75,site_visits:100},geographic:{region:"APAC",country:"SG"}},{id:"s4",name:"SMB Retail",size:360,color:"#8b5cf6",demographic:{industry:"Retail",title:"Owner",company_size:"50-250"},behavioral:{email_opens:210,site_visits:330},geographic:{region:"LATAM",country:"BR"}}],r={args:{segments:E,className:"h-[600px]"}},o={args:{segments:[],className:"h-[600px]"}},t={render:()=>e.jsx("div",{className:"h-[600px] p-6",children:e.jsx(N,{count:6})})},s={render:()=>e.jsx("div",{className:"h-[600px] p-6",children:e.jsx(f,{...z.error("Unable to load segmentation data")})})},a={render:()=>e.jsx("div",{dir:"rtl",className:"h-[600px] p-6",children:e.jsx(b,{segments:E})})};var i,m,p;r.parameters={...r.parameters,docs:{...(i=r.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    segments,
    className: 'h-[600px]'
  }
}`,...(p=(m=r.parameters)==null?void 0:m.docs)==null?void 0:p.source}}};var n,c,d;o.parameters={...o.parameters,docs:{...(n=o.parameters)==null?void 0:n.docs,source:{originalSource:`{
  args: {
    segments: [],
    className: 'h-[600px]'
  }
}`,...(d=(c=o.parameters)==null?void 0:c.docs)==null?void 0:d.source}}};var l,g,u;t.parameters={...t.parameters,docs:{...(l=t.parameters)==null?void 0:l.docs,source:{originalSource:`{
  render: () => <div className="h-[600px] p-6">
      <SkeletonCards count={6} />
    </div>
}`,...(u=(g=t.parameters)==null?void 0:g.docs)==null?void 0:u.source}}};var h,v,x;s.parameters={...s.parameters,docs:{...(h=s.parameters)==null?void 0:h.docs,source:{originalSource:`{
  render: () => <div className="h-[600px] p-6">
      <EmptyState {...emptyStates.error('Unable to load segmentation data')} />
    </div>
}`,...(x=(v=s.parameters)==null?void 0:v.docs)==null?void 0:x.source}}};var y,S,_;a.parameters={...a.parameters,docs:{...(y=a.parameters)==null?void 0:y.docs,source:{originalSource:`{
  render: () => <div dir="rtl" className="h-[600px] p-6">
      <CustomerSegmentation segments={segments} />
    </div>
}`,...(_=(S=a.parameters)==null?void 0:S.docs)==null?void 0:_.source}}};const ne=["Default","Empty","Loading","Error","RTL"];export{r as Default,o as Empty,s as Error,t as Loading,a as RTL,ne as __namedExportsOrder,pe as default};
