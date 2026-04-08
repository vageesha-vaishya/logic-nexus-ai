import{j as e}from"./iframe-CsWugpTQ.js";import{C as b}from"./CustomerSegmentation-D2hjoVhT.js";import{a as N}from"./skeleton-table-BmcC6f3N.js";import{E as f,e as z}from"./empty-state-DAxTEE4w.js";import"./preload-helper-C1FmrZbK.js";import"./card-DElVqdz_.js";import"./select-Bos0K022.js";import"./index-BdQq_4o_.js";import"./index-BMNU2nVA.js";import"./index-DutRtgoX.js";import"./chevron-down-KegWGprN.js";import"./check-CREjJjm4.js";import"./chevron-up-Bu-ihN1g.js";import"./tabs-ftHSrWj8.js";import"./index-lk_7jC7R.js";import"./badge-CieB6EZu.js";import"./scroll-area-Kvq7oySz.js";import"./generateCategoricalChart-D6LNj-1x.js";import"./index-DbKEobXu.js";import"./PieChart-JX3fj5Fy.js";import"./BarChart-HdtpnzAR.js";import"./YAxis-BOOrmHjf.js";import"./table-CwdJlCEK.js";import"./chevrons-up-down-CYGPMSC2.js";import"./button-hQwFhXKy.js";import"./circle-alert-C3SUhW_I.js";import"./search-BUAN7JnB.js";import"./plus-GiGrk20-.js";const ee={title:"CRM/CustomerSegmentation",component:b,parameters:{layout:"padded",docs:{description:{component:"Customer segmentation visualization with multiple criteria (demographic, behavioral, geographic), distribution charts, and breakdown analysis."}}},tags:["autodocs"]},E=[{id:"s1",name:"Enterprise Ops",size:420,color:"#3b82f6",demographic:{industry:"Logistics",title:"Ops",company_size:"1000+"},behavioral:{email_opens:230,site_visits:510},geographic:{region:"NA",country:"US"}},{id:"s2",name:"Growth Startups",size:280,color:"#10b981",demographic:{industry:"E-commerce",title:"Founder",company_size:"1-50"},behavioral:{email_opens:180,site_visits:240},geographic:{region:"EU",country:"DE"}},{id:"s3",name:"Government",size:120,color:"#f59e0b",demographic:{industry:"Gov",title:"Procurement",company_size:"2000+"},behavioral:{email_opens:75,site_visits:100},geographic:{region:"APAC",country:"SG"}},{id:"s4",name:"SMB Retail",size:360,color:"#8b5cf6",demographic:{industry:"Retail",title:"Owner",company_size:"50-250"},behavioral:{email_opens:210,site_visits:330},geographic:{region:"LATAM",country:"BR"}}],r={args:{segments:E,className:"h-[600px]"}},s={args:{segments:[],className:"h-[600px]"}},o={render:()=>e.jsx("div",{className:"h-[600px] p-6",children:e.jsx(N,{count:6})})},t={render:()=>e.jsx("div",{className:"h-[600px] p-6",children:e.jsx(f,{...z.error("Unable to load segmentation data")})})},a={render:()=>e.jsx("div",{dir:"rtl",className:"h-[600px] p-6",children:e.jsx(b,{segments:E})})};var i,m,n;r.parameters={...r.parameters,docs:{...(i=r.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    segments,
    className: 'h-[600px]'
  }
}`,...(n=(m=r.parameters)==null?void 0:m.docs)==null?void 0:n.source}}};var p,c,d;s.parameters={...s.parameters,docs:{...(p=s.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    segments: [],
    className: 'h-[600px]'
  }
}`,...(d=(c=s.parameters)==null?void 0:c.docs)==null?void 0:d.source}}};var l,g,u;o.parameters={...o.parameters,docs:{...(l=o.parameters)==null?void 0:l.docs,source:{originalSource:`{
  render: () => <div className="h-[600px] p-6">
      <SkeletonCards count={6} />
    </div>
}`,...(u=(g=o.parameters)==null?void 0:g.docs)==null?void 0:u.source}}};var h,v,x;t.parameters={...t.parameters,docs:{...(h=t.parameters)==null?void 0:h.docs,source:{originalSource:`{
  render: () => <div className="h-[600px] p-6">
      <EmptyState {...emptyStates.error('Unable to load segmentation data')} />
    </div>
}`,...(x=(v=t.parameters)==null?void 0:v.docs)==null?void 0:x.source}}};var y,S,_;a.parameters={...a.parameters,docs:{...(y=a.parameters)==null?void 0:y.docs,source:{originalSource:`{
  render: () => <div dir="rtl" className="h-[600px] p-6">
      <CustomerSegmentation segments={segments} />
    </div>
}`,...(_=(S=a.parameters)==null?void 0:S.docs)==null?void 0:_.source}}};const re=["Default","Empty","Loading","Error","RTL"];export{r as Default,s as Empty,t as Error,o as Loading,a as RTL,re as __namedExportsOrder,ee as default};
