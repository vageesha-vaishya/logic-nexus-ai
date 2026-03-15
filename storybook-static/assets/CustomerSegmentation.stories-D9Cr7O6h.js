import{j as r}from"./jsx-runtime-Z5uAzocK.js";import{C as b}from"./CustomerSegmentation-B0yRdfCK.js";import{S as N}from"./skeleton-table-B7UYLiTh.js";import{E as f,e as z}from"./empty-state-BkTwSWnX.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-BRH59LJj.js";import"./utils-mOyDzkE6.js";import"./select-DnAFOhuz.js";import"./index-DLHbBEj9.js";import"./index-7TLWIpSA.js";import"./index-DW48STyt.js";import"./index-WQoRFki_.js";import"./index-CuDmVINA.js";import"./index-CyLt0tHj.js";import"./index-DyZtt5qy.js";import"./index-BzXjCyLi.js";import"./index-DSMx10ar.js";import"./index-CiCgAmAg.js";import"./index-DvPxE0jW.js";import"./index-CTbEET-J.js";import"./index-DLuVoU5X.js";import"./index-WyfESzTi.js";import"./index-hrYVS3HY.js";import"./chevron-down-D-nzWkjq.js";import"./createLucideIcon-DEP7aKU9.js";import"./check--MVdLoPp.js";import"./chevron-up-BYJQeOkQ.js";import"./tabs-CIODxbyA.js";import"./index-1nVOT-6P.js";import"./index-Bk-1lDEB.js";import"./badge-BazqNHwJ.js";import"./scroll-area-CNxhw6Ms.js";import"./generateCategoricalChart-CUJPUrbO.js";import"./tiny-invariant-CopsF_GD.js";import"./index-CpCSUgdU.js";import"./PieChart-C-QDou4j.js";import"./BarChart-DtfbwV-5.js";import"./YAxis-6cut2Ze9.js";import"./skeleton-JqcMxz8I.js";import"./table-B7y9fgOD.js";import"./chevrons-up-down-ChP24vm-.js";import"./button-SB7iZ1uz.js";import"./circle-alert-CpVRAWZS.js";import"./search-C-UEa-iZ.js";import"./plus-BkGVcHzy.js";const yr={title:"CRM/CustomerSegmentation",component:b,parameters:{layout:"padded",docs:{description:{component:"Customer segmentation visualization with multiple criteria (demographic, behavioral, geographic), distribution charts, and breakdown analysis."}}},tags:["autodocs"]},E=[{id:"s1",name:"Enterprise Ops",size:420,color:"#3b82f6",demographic:{industry:"Logistics",title:"Ops",company_size:"1000+"},behavioral:{email_opens:230,site_visits:510},geographic:{region:"NA",country:"US"}},{id:"s2",name:"Growth Startups",size:280,color:"#10b981",demographic:{industry:"E-commerce",title:"Founder",company_size:"1-50"},behavioral:{email_opens:180,site_visits:240},geographic:{region:"EU",country:"DE"}},{id:"s3",name:"Government",size:120,color:"#f59e0b",demographic:{industry:"Gov",title:"Procurement",company_size:"2000+"},behavioral:{email_opens:75,site_visits:100},geographic:{region:"APAC",country:"SG"}},{id:"s4",name:"SMB Retail",size:360,color:"#8b5cf6",demographic:{industry:"Retail",title:"Owner",company_size:"50-250"},behavioral:{email_opens:210,site_visits:330},geographic:{region:"LATAM",country:"BR"}}],e={args:{segments:E,className:"h-[600px]"}},o={args:{segments:[],className:"h-[600px]"}},t={render:()=>r.jsx("div",{className:"h-[600px] p-6",children:r.jsx(N,{count:6})})},s={render:()=>r.jsx("div",{className:"h-[600px] p-6",children:r.jsx(f,{...z.error("Unable to load segmentation data")})})},i={render:()=>r.jsx("div",{dir:"rtl",className:"h-[600px] p-6",children:r.jsx(b,{segments:E})})};var a,m,p;e.parameters={...e.parameters,docs:{...(a=e.parameters)==null?void 0:a.docs,source:{originalSource:`{
  args: {
    segments,
    className: 'h-[600px]'
  }
}`,...(p=(m=e.parameters)==null?void 0:m.docs)==null?void 0:p.source}}};var n,c,d;o.parameters={...o.parameters,docs:{...(n=o.parameters)==null?void 0:n.docs,source:{originalSource:`{
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
}`,...(x=(v=s.parameters)==null?void 0:v.docs)==null?void 0:x.source}}};var y,S,_;i.parameters={...i.parameters,docs:{...(y=i.parameters)==null?void 0:y.docs,source:{originalSource:`{
  render: () => <div dir="rtl" className="h-[600px] p-6">
      <CustomerSegmentation segments={segments} />
    </div>
}`,...(_=(S=i.parameters)==null?void 0:S.docs)==null?void 0:_.source}}};const Sr=["Default","Empty","Loading","Error","RTL"];export{e as Default,o as Empty,s as Error,t as Loading,i as RTL,Sr as __namedExportsOrder,yr as default};
