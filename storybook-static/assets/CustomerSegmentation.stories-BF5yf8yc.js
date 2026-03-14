import{j as e}from"./jsx-runtime-Z5uAzocK.js";import{C as b}from"./CustomerSegmentation-Ddfy9n6L.js";import{S as N}from"./skeleton-table-Dt9lzMpM.js";import{E as f,e as z}from"./empty-state-1wPSDg_7.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-DV47ztDp.js";import"./utils-CytzSlOG.js";import"./select-Cd8M99ts.js";import"./index-DLHbBEj9.js";import"./index-7TLWIpSA.js";import"./index-DW48STyt.js";import"./index-DHumPsSE.js";import"./index-CuDmVINA.js";import"./index-DXxPFvzQ.js";import"./Combination-FaLM8ji1.js";import"./index-B1bLLDhJ.js";import"./index-DSMx10ar.js";import"./tslib.es6-CmEaCU22.js";import"./index-CiCgAmAg.js";import"./index-D9SpBz_a.js";import"./index-BO9nGImx.js";import"./createLucideIcon-DEP7aKU9.js";import"./index-DLuVoU5X.js";import"./index-WyfESzTi.js";import"./chevron-up-DGrNAj5y.js";import"./tabs-DngPvJWg.js";import"./index-Cetd40Y1.js";import"./index-DWAuYXNV.js";import"./badge-vqX98KDz.js";import"./scroll-area-DLGkcbDQ.js";import"./PieChart-DTqpE8Y-.js";import"./tiny-invariant-CopsF_GD.js";import"./skeleton-DO16Kgig.js";import"./table-DzrnUcP1.js";import"./chevrons-up-down-ChP24vm-.js";import"./button-_friVzh6.js";import"./circle-alert-CpVRAWZS.js";import"./search-C-UEa-iZ.js";import"./plus-BkGVcHzy.js";const le={title:"CRM/CustomerSegmentation",component:b,parameters:{layout:"padded",docs:{description:{component:"Customer segmentation visualization with multiple criteria (demographic, behavioral, geographic), distribution charts, and breakdown analysis."}}},tags:["autodocs"]},E=[{id:"s1",name:"Enterprise Ops",size:420,color:"#3b82f6",demographic:{industry:"Logistics",title:"Ops",company_size:"1000+"},behavioral:{email_opens:230,site_visits:510},geographic:{region:"NA",country:"US"}},{id:"s2",name:"Growth Startups",size:280,color:"#10b981",demographic:{industry:"E-commerce",title:"Founder",company_size:"1-50"},behavioral:{email_opens:180,site_visits:240},geographic:{region:"EU",country:"DE"}},{id:"s3",name:"Government",size:120,color:"#f59e0b",demographic:{industry:"Gov",title:"Procurement",company_size:"2000+"},behavioral:{email_opens:75,site_visits:100},geographic:{region:"APAC",country:"SG"}},{id:"s4",name:"SMB Retail",size:360,color:"#8b5cf6",demographic:{industry:"Retail",title:"Owner",company_size:"50-250"},behavioral:{email_opens:210,site_visits:330},geographic:{region:"LATAM",country:"BR"}}],r={args:{segments:E,className:"h-[600px]"}},o={args:{segments:[],className:"h-[600px]"}},t={render:()=>e.jsx("div",{className:"h-[600px] p-6",children:e.jsx(N,{count:6})})},s={render:()=>e.jsx("div",{className:"h-[600px] p-6",children:e.jsx(f,{...z.error("Unable to load segmentation data")})})},a={render:()=>e.jsx("div",{dir:"rtl",className:"h-[600px] p-6",children:e.jsx(b,{segments:E})})};var i,m,p;r.parameters={...r.parameters,docs:{...(i=r.parameters)==null?void 0:i.docs,source:{originalSource:`{
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
}`,...(_=(S=a.parameters)==null?void 0:S.docs)==null?void 0:_.source}}};const ge=["Default","Empty","Loading","Error","RTL"];export{r as Default,o as Empty,s as Error,t as Loading,a as RTL,ge as __namedExportsOrder,le as default};
