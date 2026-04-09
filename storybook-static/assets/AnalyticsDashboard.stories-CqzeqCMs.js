import{j as e}from"./iframe-BA3bigUR.js";import{P as t}from"./PipelineAnalytics-CrdCVeii.js";import{m as p}from"./mock-data-DrjS_GOJ.js";import"./preload-helper-C1FmrZbK.js";import"./card-CStZ5zmI.js";import"./differenceInDays-BUiEefYv.js";import"./differenceInCalendarDays-DMvB39OA.js";import"./constants-bFRL9H8z.js";import"./generateCategoricalChart-D4D77cAq.js";import"./index-6wTb7akG.js";import"./BarChart-KgBT9y_3.js";import"./YAxis-BCGIVxiq.js";import"./PieChart-DaOqSqt7.js";import"./addDays-D4f_g46w.js";import"./subDays-CwQESoEO.js";const D={title:"CRM/Analytics Dashboard",component:t,parameters:{layout:"padded"},tags:["autodocs"]},s={args:{leads:p},render:r=>e.jsxs("div",{className:"p-6 bg-slate-50 min-h-screen",children:[e.jsx("h1",{className:"text-2xl font-bold mb-6",children:"Pipeline Analytics"}),e.jsx(t,{...r})]})},a={args:{leads:[]},render:r=>e.jsxs("div",{className:"p-6 bg-slate-50 min-h-screen",children:[e.jsx("h1",{className:"text-2xl font-bold mb-6",children:"Pipeline Analytics (Empty)"}),e.jsx(t,{...r})]})};var n,i,o;s.parameters={...s.parameters,docs:{...(n=s.parameters)==null?void 0:n.docs,source:{originalSource:`{
  args: {
    leads: mockLeads
  },
  render: args => <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Pipeline Analytics</h1>
      <PipelineAnalytics {...args} />
    </div>
}`,...(o=(i=s.parameters)==null?void 0:i.docs)==null?void 0:o.source}}};var m,l,c;a.parameters={...a.parameters,docs:{...(m=a.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    leads: []
  },
  render: args => <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Pipeline Analytics (Empty)</h1>
      <PipelineAnalytics {...args} />
    </div>
}`,...(c=(l=a.parameters)==null?void 0:l.docs)==null?void 0:c.source}}};const k=["Default","EmptyState"];export{s as Default,a as EmptyState,k as __namedExportsOrder,D as default};
