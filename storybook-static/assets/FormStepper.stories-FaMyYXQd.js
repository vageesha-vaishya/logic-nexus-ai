import{F as p}from"./FormStepper-CxkkQkGf.js";import"./iframe-CsWugpTQ.js";import"./preload-helper-C1FmrZbK.js";import"./button-hQwFhXKy.js";const u={title:"System/FormStepper",component:p,parameters:{a11y:{disable:!1},viewport:{defaultViewport:"desktop"}},argTypes:{activeId:{control:"text",description:"Active step id"}}},n=[{id:"basics",label:"Basics"},{id:"contact",label:"Contact"},{id:"review",label:"Review"}],e={args:{steps:n,activeId:"basics"}},t={args:{steps:n,activeId:"contact",onPrev:()=>{},onNext:()=>{}}};var s,a,r;e.parameters={...e.parameters,docs:{...(s=e.parameters)==null?void 0:s.docs,source:{originalSource:`{
  args: {
    steps,
    activeId: "basics"
  }
}`,...(r=(a=e.parameters)==null?void 0:a.docs)==null?void 0:r.source}}};var o,c,i;t.parameters={...t.parameters,docs:{...(o=t.parameters)==null?void 0:o.docs,source:{originalSource:`{
  args: {
    steps,
    activeId: "contact",
    onPrev: () => {},
    onNext: () => {}
  }
}`,...(i=(c=t.parameters)==null?void 0:c.docs)==null?void 0:i.source}}};const b=["Basic","WithActions"];export{e as Basic,t as WithActions,b as __namedExportsOrder,u as default};
